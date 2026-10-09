import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

function getArgument(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(file), 'utf8'));
}

export function percentile(sortedValues, percentileValue) {
  const index = Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1);
  return sortedValues[index];
}

export function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ?
    sorted[middle] :
    (sorted[middle - 1] + sorted[middle]) / 2;

  return {
    medianNanoseconds: median,
    p95Nanoseconds: percentile(sorted, 0.95),
    minNanoseconds: sorted[0],
    maxNanoseconds: sorted.at(-1),
  };
}

function sourceCommit(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function formatTime(nanoseconds) {
  if (nanoseconds < 1000) {
    return `${nanoseconds.toFixed(0)} ns`;
  }
  if (nanoseconds < 1000000) {
    return `${(nanoseconds / 1000).toFixed(2)} μs`;
  }
  return `${(nanoseconds / 1000000).toFixed(2)} ms`;
}

function formatPercent(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function changePercent(base, current) {
  return base === 0 ? 100 : (current - base) / base * 100;
}

export function harnessRevisionFor(source) {
  return createHash('sha256').update(source).digest('hex');
}

export function assertHarnessRevision(source, expectedRevision) {
  const actualRevision = harnessRevisionFor(source);
  if (actualRevision !== expectedRevision) {
    throw new Error(`Timing harness revision ${actualRevision} does not match ${expectedRevision}`);
  }

  return actualRevision;
}

async function loadRuntime(root, dependencyRoot) {
  const requireFromRoot = createRequire(resolve(dependencyRoot, 'package.json'));
  const { JSDOM } = requireFromRoot('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;

  const cleanup = () => {
    if (previousWindow) {
      Object.defineProperty(globalThis, 'window', previousWindow);
    } else {
      delete globalThis.window;
    }
    if (previousDocument) {
      Object.defineProperty(globalThis, 'document', previousDocument);
    } else {
      delete globalThis.document;
    }
    dom.window.close();
  };

  try {
    const [{ createMarionette }, { default: BackboneApi }, data] = await Promise.all([
      import(pathToFileURL(resolve(root, 'dist/marionette.js')).href),
      import(pathToFileURL(resolve(root, 'packages/adapters/dist/backbone.js')).href),
      import(pathToFileURL(resolve(root, 'packages/data/dist/index.js')).href),
    ]);
    const Marionette = createMarionette();
    Marionette.setDataApi(BackboneApi);
    Marionette.setStateApi(BackboneApi);
    const native = createMarionette();
    native.setDataApi(data.DataApi);
    native.setStateApi(data.StateApi);
    return { Backbone: requireFromRoot('backbone'), Marionette, native, data, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

function createCases({ Backbone, Marionette, native, data }) {
  const { CollectionView, Region, View } = Marionette;
  const PlainView = View.extend({ template: false });
  const RenderView = View.extend({
    template: context => `<span>${context.value || ''}</span>`,
    templateContext: { value: 'benchmark' },
  });
  const ChildView = View.extend({
    tagName: 'li',
    template: false,
  });
  const collectionModels = Array.from({ length: 10 }, (_, id) => ({ id }));
  const probeCollection = new Backbone.Collection();
  const probeView = new CollectionView({ childView: ChildView, collection: probeCollection });
  probeView.render();
  const probeModel = probeCollection.add({ id: 'probe' });
  if (probeView.children.length !== 1) {
    throw new Error('Timing harness did not observe a Backbone collection addition');
  }
  probeCollection.remove(probeModel);
  if (probeView.children.length !== 0) {
    throw new Error('Timing harness did not observe a Backbone collection removal');
  }
  probeView.destroy();

  return new Map([
    ['view-construct-destroy', iterations => {
      for (let index = 0; index < iterations; index += 1) {
        new PlainView().destroy();
      }
    }],
    ['view-render-rerender', iterations => {
      for (let index = 0; index < iterations; index += 1) {
        const view = new RenderView();
        view.render();
        view.render();
        view.destroy();
      }
    }],
    ['behavior-mount-event-destroy', iterations => {
      let callbacks = 0;
      const ClickBehavior = native.Behavior.extend({
        events: { 'click button': () => { callbacks += 1; } },
      });
      const BehaviorView = native.View.extend({
        template: () => '<button>Run</button>',
        behaviors: [ClickBehavior],
      });
      for (let index = 0; index < iterations; index += 1) {
        const view = new BehaviorView();
        view.render();
        document.body.append(view.el);
        const button = view.el.querySelector('button');
        button.click();
        assert.equal(callbacks, index + 1);
        view.destroy();
        button.click();
        assert.equal(callbacks, index + 1);
        assert.equal(view.el.isConnected, false);
      }
    }],
    ['native-collection-view-render-destroy', iterations => {
      const NativeChild = native.View.extend({ tagName: 'li', template: false });
      for (let index = 0; index < iterations; index += 1) {
        const models = collectionModels.map(model => new data.Model(model));
        const collection = new data.Collection(models);
        const view = new native.CollectionView({ childView: NativeChild, collection });
        view.render();
        assert.equal(view.el.children.length, models.length);
        view.destroy();
        collection.destroy();
        models.forEach(model => model.destroy());
      }
    }],
    ['native-collection-view-add-remove', iterations => {
      const NativeChild = native.View.extend({ tagName: 'li', template: false });
      const collection = new data.Collection();
      const view = new native.CollectionView({ childView: NativeChild, collection });
      view.render();
      for (let index = 0; index < iterations; index += 1) {
        const model = new data.Model({ id: index });
        collection.add(model);
        assert.equal(view.el.children.length, 1);
        collection.remove(model);
        assert.equal(view.el.children.length, 0);
        model.destroy();
      }
      view.destroy();
      collection.destroy();
    }],
    ['region-show-empty', iterations => {
      const region = new Region({ el: document.createElement('div') });
      for (let index = 0; index < iterations; index += 1) {
        region.show(new PlainView());
        region.empty();
      }
      region.destroy();
    }],
    ['collection-view-render-destroy', iterations => {
      for (let index = 0; index < iterations; index += 1) {
        const collectionView = new CollectionView({
          childView: ChildView,
          collection: new Backbone.Collection(collectionModels),
        });
        collectionView.render();
        collectionView.destroy();
      }
    }],
    ['collection-view-add-remove', iterations => {
      const collection = new Backbone.Collection();
      const collectionView = new CollectionView({ childView: ChildView, collection });
      collectionView.render();
      for (let index = 0; index < iterations; index += 1) {
        const model = collection.add({ id: index });
        collection.remove(model);
      }
      collectionView.destroy();
    }],
  ]);
}

export async function measure({
  root = '.',
  configPath = 'config/performance.json',
  dependencyRoot = root,
} = {}) {
  const resolvedRoot = resolve(root);
  const resolvedDependencyRoot = resolve(dependencyRoot);
  const contract = await readJson(configPath);
  assertHarnessRevision(await readFile(new URL(import.meta.url)), contract.timing.harnessRevision);
  const runtime = await loadRuntime(resolvedRoot, resolvedDependencyRoot);
  const results = [];

  try {
    const cases = createCases(runtime);
    for (const caseConfig of contract.timing.cases) {
      const run = cases.get(caseConfig.id);
      if (!run) {
        throw new Error(`No timing case implements ${caseConfig.id}`);
      }

      for (let index = 0; index < contract.timing.warmupBatches; index += 1) {
        run(caseConfig.iterationsPerSample);
        document.body.textContent = '';
      }

      const samples = [];
      for (let index = 0; index < contract.timing.sampleCount; index += 1) {
        const start = process.hrtime.bigint();
        run(caseConfig.iterationsPerSample);
        const elapsed = process.hrtime.bigint() - start;
        samples.push(Number(elapsed) / caseConfig.iterationsPerSample);
        document.body.textContent = '';
      }

      results.push({
        id: caseConfig.id,
        iterationsPerSample: caseConfig.iterationsPerSample,
        sampleCount: contract.timing.sampleCount,
        samplesNanoseconds: samples,
        ...summarize(samples),
      });
    }
  } finally {
    runtime.cleanup();
  }

  const report = {
    schemaVersion: 2,
    mode: 'hosted-reporting-only',
    sourceCommit: sourceCommit(resolvedRoot),
    harnessSchemaVersion: contract.timing.harnessSchemaVersion,
    harnessRevision: contract.timing.harnessRevision,
    environment: {
      node: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      runnerImage: process.env.ImageOS || null,
      runnerImageVersion: process.env.ImageVersion || null,
    },
    measurement: {
      environment: 'jsdom',
      jsdom: createRequire(resolve(resolvedDependencyRoot, 'package.json'))('jsdom/package.json').version,
      backbone: createRequire(resolve(resolvedDependencyRoot, 'package.json'))('backbone/package.json').version,
      warmupBatches: contract.timing.warmupBatches,
      sampleCount: contract.timing.sampleCount,
    },
    warningThresholdPercent: contract.thresholds.hostedTimingWarningPercent,
    cases: results,
  };

  return report;
}

export async function createReport(baseFile, currentFile) {
  const base = await readJson(baseFile);
  const current = await readJson(currentFile);
  const baseCases = new Map(base.cases.map(result => [result.id, result]));
  const rows = [];
  const warnings = [];
  let comparableCount = 0;

  for (const result of current.cases) {
    const baseResult = baseCases.get(result.id);
    if (!baseResult) {
      rows.push(`| ${result.id} | New | ${formatTime(result.medianNanoseconds)} | New | ${formatTime(result.p95Nanoseconds)} |`);
      continue;
    }

    const comparable = base.schemaVersion === current.schemaVersion &&
      Boolean(current.harnessRevision) && base.harnessRevision === current.harnessRevision &&
      base.harnessSchemaVersion === current.harnessSchemaVersion &&
      isDeepStrictEqual(base.measurement, current.measurement) &&
      isDeepStrictEqual(base.environment, current.environment) &&
      baseResult.iterationsPerSample === result.iterationsPerSample &&
      baseResult.sampleCount === result.sampleCount;
    if (!comparable) {
      rows.push(`| ${result.id} | ${formatTime(baseResult.medianNanoseconds)} | ${formatTime(result.medianNanoseconds)} (Non-comparable) | ${formatTime(baseResult.p95Nanoseconds)} | ${formatTime(result.p95Nanoseconds)} (Non-comparable) |`);
      continue;
    }

    comparableCount += 1;
    const medianChange = changePercent(baseResult.medianNanoseconds, result.medianNanoseconds);
    const p95Change = changePercent(baseResult.p95Nanoseconds, result.p95Nanoseconds);
    if (medianChange > current.warningThresholdPercent || p95Change > current.warningThresholdPercent) {
      warnings.push(`${result.id} exceeded the ${current.warningThresholdPercent}% hosted warning threshold`);
    }
    rows.push(`| ${result.id} | ${formatTime(baseResult.medianNanoseconds)} | ${formatTime(result.medianNanoseconds)} (${formatPercent(medianChange)}) | ${formatTime(baseResult.p95Nanoseconds)} | ${formatTime(result.p95Nanoseconds)} (${formatPercent(p95Change)}) |`);
  }

  return [
    '<!-- performance-timing-report -->',
    '## Hosted timing report ⏱️',
    '',
    'Environment: jsdom (no browser layout or paint). Unprefixed collection cases use Backbone; native-prefixed cases use @mnjs/data.',
    'Durations are per iteration, including the setup, assertions, and cleanup inside each workload. Changed harness, environment, or sampling settings are non-comparable.',
    '',
    '| Case | Base median | PR median | Base p95 | PR p95 |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    warnings.length ? `Warnings: ${warnings.join('; ')}.` : comparableCount ?
      'No warning threshold was exceeded among comparable workloads.' :
      'No comparable existing workloads; no timing warnings evaluated.',
    '',
    'Hosted timing is reporting-only and never decides merge or release eligibility. Investigate changes with repeated matched runs; shared-host noise is not a proven regression.'
  ].join('\n');
}

export async function main(args = process.argv.slice(2)) {
  const reportIndex = args.indexOf('--report');
  if (reportIndex === -1) {
    const report = await measure({
      root: getArgument(args, '--root', '.'),
      configPath: getArgument(args, '--config', 'config/performance.json'),
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      for (const result of report.cases) {
        console.log(`${result.id}: median ${formatTime(result.medianNanoseconds)}, p95 ${formatTime(result.p95Nanoseconds)}`);
      }
    }
  } else {
    console.log(await createReport(args[reportIndex + 1], args[reportIndex + 2]));
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryUrl === import.meta.url) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
