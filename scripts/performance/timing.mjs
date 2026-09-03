import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { loadBackboneRuntime } from './load-runtime.mjs';

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
    const { Backbone, Marionette } = await loadBackboneRuntime(root, dependencyRoot);

    return { Backbone, Marionette, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

function createCases({ Backbone, Marionette }) {
  const { Behavior, CollectionView, Region, View } = Marionette;
  const PlainView = View.extend({ template: false });
  const RenderView = View.extend({
    template: data => `<span>${data.value || ''}</span>`,
    templateContext: { value: 'benchmark' },
  });
  const EventView = View.extend({
    events: {
      'click button': 'onClick'
    },
    onClick() {},
    template: false,
  });
  const TimedBehavior = Behavior.extend({
    events: {
      'click button': 'onClick'
    },
    onClick() {},
  });
  const BehaviorView = View.extend({
    behaviors: [TimedBehavior],
    template: false,
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
    ['view-set-element-destroy', iterations => {
      for (let index = 0; index < iterations; index += 1) {
        const view = new EventView();
        view.setElement(view.el);
        view.destroy();
      }
    }],
    ['behavior-view-set-element-destroy', iterations => {
      for (let index = 0; index < iterations; index += 1) {
        const view = new BehaviorView();
        view.setElement(view.el);
        view.destroy();
      }
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
        ...summarize(samples),
      });
    }
  } finally {
    runtime.cleanup();
  }

  const report = {
    schemaVersion: 1,
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

  for (const result of current.cases) {
    const baseResult = baseCases.get(result.id);
    if (!baseResult) {
      rows.push(`| ${result.id} | New | ${formatTime(result.medianNanoseconds)} | New | ${formatTime(result.p95Nanoseconds)} |`);
      continue;
    }

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
    '| Case | Base median | PR median | Base p95 | PR p95 |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    warnings.length ? `Warnings: ${warnings.join('; ')}.` : 'No hosted timing warning threshold was exceeded.',
    '',
    'Hosted timing is reporting-only and never decides merge or release eligibility. Controlled-runner baselines and enforcement remain #127 PR B.'
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
