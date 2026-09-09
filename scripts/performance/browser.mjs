import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { cpus, hostname, totalmem } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = resolve(import.meta.dirname, '../..');
const contractPath = resolve(root, 'benchmarks/browser-performance/contract.json');
const browserNames = ['chromium', 'firefox', 'webkit'];
const runtimeAssets = {
  '@mnjs/data': 'packages/data/dist/index.js',
  '@mnjs/radio': 'packages/radio/dist/index.js',
  '@mnjs/utils': 'packages/utils/dist/index.js',
  marionette: 'dist/marionette.js'
};

function getArgument(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) { return fallback; }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) { throw new Error(`Missing value for ${name}`); }
  return value;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer; received ${value}`);
  }
  return parsed;
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256(file) {
  return sha256Text(await readFile(file));
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function sameStrings(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    actual.every((value, index) => value === expected[index]);
}

export function validateBrowserPerformanceContract({ contract, manifest, manifestText, entryRevision }) {
  const violations = [];
  if (contract?.schemaVersion !== 1 || contract.status !== 'reporting') {
    violations.push('Browser performance contract must use reporting schema 1');
  }
  if (contract?.fixture?.version !== 'v1' ||
      contract.fixture.path !== 'benchmarks/browser-performance/v1/manifest.json') {
    violations.push('Browser performance contract must identify the v1 fixture');
  }
  if (contract?.fixture?.sha256 !== sha256Text(manifestText)) {
    violations.push('Browser performance fixture SHA-256 does not match its contract');
  }
  if (manifest?.schemaVersion !== 1 || manifest.fixtureVersion !== contract?.fixture?.version) {
    violations.push('Browser performance manifest does not match its contract version');
  }
  if (manifest?.entry !== 'workloads.js' || manifest.entrySha256 !== entryRevision) {
    violations.push('Browser performance workload SHA-256 does not match its manifest');
  }
  if (!Number.isInteger(manifest?.workloadTimeoutMilliseconds) ||
      manifest.workloadTimeoutMilliseconds < 1) {
    violations.push('Browser performance workload timeout is invalid');
  }
  const workloadIds = Object.keys(manifest?.workloads || {});
  if (!sameStrings(manifest?.runOrder, [
    'native-data-list-mutations',
    'application-async-lifecycle',
    'state-mount-destroy'
  ]) || !sameStrings([...workloadIds].sort(), [...manifest.runOrder].sort())) {
    violations.push('Browser performance workload inventory is incomplete or reordered');
  }
  for (const profileName of ['validation', 'baseline']) {
    const profile = manifest?.profiles?.[profileName];
    if (!Number.isInteger(profile?.warmups) || profile.warmups < 1 ||
        !Number.isInteger(profile?.samples) || profile.samples < 1) {
      violations.push(`Browser performance ${profileName} profile is invalid`);
    }
  }
  if (contract?.browser?.name !== 'chromium' || contract.browser.headless !== true ||
      contract?.runtime?.accessibilityInstrumentation !== false ||
      contract.runtime.monitorViewEvents !== true) {
    violations.push('Browser performance canonical runner settings changed');
  }
  return violations;
}

export function summarize(samples) {
  const values = samples.map(({ durationMilliseconds }) => durationMilliseconds)
    .sort((left, right) => left - right);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return {
    medianMilliseconds: median,
    p95Milliseconds: values[Math.max(0, Math.ceil(values.length * 0.95) - 1)],
    minMilliseconds: values[0],
    maxMilliseconds: values.at(-1)
  };
}

function sourceCommit() {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function sourceDirty() {
  try {
    return Boolean(execFileSync('git', ['-C', root, 'status', '--porcelain=v1'], {
      encoding: 'utf8'
    }).trim());
  } catch {
    return null;
  }
}

function observedNpmVersion() {
  try {
    return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function sameMeasurementInputs(before, after) {
  return isDeepStrictEqual(before, after);
}

async function serveFixture(entryPath) {
  const routes = new Map([
    ['/workloads.js', entryPath],
    ...Object.entries(runtimeAssets).map(([specifier, file]) => [`/${specifier}.js`, resolve(root, file)])
  ]);
  const imports = Object.fromEntries(
    Object.keys(runtimeAssets).map(specifier => [specifier, `/${specifier}.js`])
  );
  const html = `<!doctype html><html><head><script type="importmap">${JSON.stringify({ imports })}</script></head><body></body></html>`;
  const server = createServer(async(request, response) => {
    try {
      if (request.url === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8');
        response.end(html);
        return;
      }
      const asset = routes.get(request.url);
      if (!asset) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.setHeader('content-type', 'text/javascript; charset=utf-8');
      response.end(await readFile(asset));
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done, reject) =>
      server.close(error => error ? reject(error) : done()))
  };
}

async function runWorkload(page, id, configuration, timeoutMilliseconds) {
  let timeout;
  const result = page.evaluate(async({ workloadId, workloadConfiguration }) => {
    const { workloads } = await import('/workloads.js');
    const workload = workloads[workloadId];
    if (!workload) { throw new Error(`Missing browser workload ${workloadId}`); }
    return workload(workloadConfiguration);
  }, { workloadId: id, workloadConfiguration: configuration });
  try {
    return await Promise.race([
      result,
      new Promise((resolvePromise, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Browser workload ${id} exceeded ${timeoutMilliseconds} ms`));
        }, timeoutMilliseconds);
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function artifactRevisions(manifestPath, entryPath) {
  const files = [
    relative(root, contractPath),
    relative(root, manifestPath),
    relative(root, entryPath),
    'scripts/performance/browser.mjs',
    'package.json',
    'package-lock.json',
    ...Object.values(runtimeAssets)
  ];
  return Object.fromEntries(await Promise.all(files.map(async file => [file, await sha256(resolve(root, file))])));
}

export async function measureBrowserPerformance({
  browserName,
  headless,
  output,
  profileName,
  runnerNote,
  samples: sampleOverride,
  warmups: warmupOverride
}) {
  const contract = await readJson(contractPath);
  const manifestPath = resolve(root, contract.fixture.path);
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const entryPath = resolve(dirname(manifestPath), manifest.entry);
  const entryRevision = await sha256(entryPath);
  const violations = validateBrowserPerformanceContract({
    contract,
    manifest,
    manifestText,
    entryRevision
  });
  if (violations.length) { throw new Error(violations.join('; ')); }

  const profile = manifest.profiles[profileName];
  if (!profile) { throw new Error(`Unknown browser performance profile ${profileName}`); }
  const samples = sampleOverride || profile.samples;
  const warmups = warmupOverride || profile.warmups;
  const { [browserName]: browserType } = await import('@playwright/test');
  if (!browserType || !browserNames.includes(browserName)) {
    throw new Error(`Unsupported browser ${browserName}; expected ${browserNames.join(', ')}`);
  }

  const source = { commit: sourceCommit(), dirty: sourceDirty() };
  const artifacts = await artifactRevisions(manifestPath, entryPath);
  const measurementInputs = { source, artifacts };
  const startedAt = new Date().toISOString();
  const fixtureServer = await serveFixture(entryPath);
  let browser;
  try {
    browser = await browserType.launch({ headless });
    const page = await browser.newPage();
    await page.goto(fixtureServer.url);
    const environment = await page.evaluate(() => ({
      deviceMemoryGiB: navigator.deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      userAgent: navigator.userAgent
    }));
    const workloadReports = [];
    for (const id of manifest.runOrder) {
      const configuration = manifest.workloads[id];
      const warmupResults = [];
      for (let index = 0; index < warmups; index += 1) {
        warmupResults.push(await runWorkload(
          page, id, configuration, manifest.workloadTimeoutMilliseconds
        ));
      }
      const rawSamples = [];
      for (let index = 0; index < samples; index += 1) {
        rawSamples.push(await runWorkload(
          page, id, configuration, manifest.workloadTimeoutMilliseconds
        ));
      }
      const workloadReport = {
        id,
        configuration,
        warmupDurationsMilliseconds: warmupResults.map(result => result.durationMilliseconds),
        samples: rawSamples,
        summary: summarize(rawSamples)
      };
      workloadReports.push(workloadReport);
      process.stdout.write(`${JSON.stringify({ id, summary: workloadReport.summary })}\n`);
    }

    const completedInputs = {
      source: { commit: sourceCommit(), dirty: sourceDirty() },
      artifacts: await artifactRevisions(manifestPath, entryPath)
    };
    if (!sameMeasurementInputs(measurementInputs, completedInputs)) {
      throw new Error('Browser performance inputs changed during measurement');
    }
    const canonicalSettings = profileName === 'baseline' &&
      browserName === contract.browser.name && headless === contract.browser.headless &&
      samples === profile.samples && warmups === profile.warmups &&
      source.dirty === false && Boolean(runnerNote);
    const packageJson = await readJson(resolve(root, 'package.json'));
    const playwrightPackage = await readJson(resolve(root, 'node_modules/@playwright/test/package.json'));
    const report = {
      schemaVersion: 1,
      status: contract.status,
      profile: profileName,
      baselineEligible: canonicalSettings,
      operatorRunnerNote: runnerNote || null,
      source,
      fixture: {
        version: manifest.fixtureVersion,
        manifestSha256: sha256Text(manifestText),
        entrySha256: entryRevision
      },
      artifacts,
      runner: {
        startedAt,
        completedAt: new Date().toISOString(),
        browser: browserName,
        browserVersion: browser.version(),
        headless,
        accessibilityInstrumentation: contract.runtime.accessibilityInstrumentation,
        monitorViewEvents: contract.runtime.monitorViewEvents,
        runOrder: manifest.runOrder,
        workloadTimeoutMilliseconds: manifest.workloadTimeoutMilliseconds,
        samples,
        warmups,
        node: process.version,
        packageManager: packageJson.packageManager,
        npmVersion: observedNpmVersion(),
        playwright: playwrightPackage.version,
        host: {
          architecture: process.arch,
          cpuCount: cpus().length,
          cpuModel: cpus()[0]?.model || null,
          hostname: hostname(),
          platform: process.platform,
          totalMemoryBytes: totalmem()
        },
        browserEnvironment: environment
      },
      workloads: workloadReports,
      notes: [
        'Durations are report-only and are not pass/fail gates.',
        'Public lifecycle and consumer-owned resource observations establish cleanup, not garbage collection.',
        'Baseline interpretation requires an operator-confirmed exclusive quiet-host run.'
      ]
    };
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    try {
      await browser?.close();
    } finally {
      await fixtureServer.close();
    }
  }
}

async function main(args) {
  const profileName = getArgument(args, '--profile', 'validation');
  const browserName = getArgument(args, '--browser', 'chromium');
  const headless = !args.includes('--headed');
  const output = resolve(getArgument(args, '--output', 'test/tmp/performance/browser-report.json'));
  const sampleValue = getArgument(args, '--samples', null);
  const warmupValue = getArgument(args, '--warmups', null);
  const report = await measureBrowserPerformance({
    browserName,
    headless,
    output,
    profileName,
    runnerNote: getArgument(args, '--runner-note', null),
    samples: sampleValue ? positiveInteger(sampleValue, '--samples') : null,
    warmups: warmupValue ? positiveInteger(warmupValue, '--warmups') : null
  });
  process.stdout.write(`${JSON.stringify({
    output,
    profile: report.profile,
    baselineEligible: report.baselineEligible,
    source: report.source,
    workloads: report.workloads.map(({ id, summary }) => ({ id, ...summary }))
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
