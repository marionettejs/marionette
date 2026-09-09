import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, platform, arch } from 'node:os';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { serveFixture } from './browser.mjs';

const root = resolve(import.meta.dirname, '../..');
const { values } = parseArgs({ options: {
  output: { type: 'string', default: 'test/tmp/performance/retention.json' },
  batches: { type: 'string', default: '6' },
  cycles: { type: 'string', default: '50' }
} });
const batches = Number(values.batches);
const cycles = Number(values.cycles);
if (!Number.isInteger(batches) || batches < 1 || batches > 10 ||
    !Number.isInteger(cycles) || cycles < 1 || cycles > 100) {
  throw new Error('Retention requires 1–10 batches and 1–100 cycles per batch.');
}
const output = resolve(values.output);
const files = ['scripts/performance/retention.mjs', 'scripts/performance/browser.mjs',
  'benchmarks/browser-performance/retention/workloads.js', 'config/release-profile.json',
  'package.json', 'package-lock.json', 'dist/marionette.js',
  'packages/data/dist/index.js', 'packages/radio/dist/index.js', 'packages/utils/dist/index.js'];
async function inputs() {
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    dirty: Boolean(execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' }).trim()),
    sha256: Object.fromEntries(await Promise.all(files.map(async file =>
      [file, createHash('sha256').update(await readFile(resolve(root, file))).digest('hex')])))
  };
}

async function main() {
  execFileSync(process.execPath, ['scripts/checks/browser-profile.mjs'], { cwd: root, stdio: 'pipe' });
  const report = {
    schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
    source: await inputs(),
    profile: { browser: 'chromium', headless: true, accessibilityInstrumentation: false,
      monitorViewEvents: true, batches, cyclesPerBatch: cycles, warmupBatches: 2,
      deadlineMilliseconds: 120000, garbageCollection: 'CDP HeapProfiler.collectGarbage, twice per observation' },
    host: { platform: platform(), architecture: arch(), cpuModel: cpus()[0]?.model, node: process.version },
    samples: [],
    limits: ['Only the selected successful public lifecycles are observed.',
      'Live external inputs remain reachable during owner collection; then inputs are released and collected.',
      'Heap and DOM counters are contextual measurements, not portable leak thresholds or a timing baseline.',
      'No private framework fields or production instrumentation are used.']
  };
  let browser;
  let server;
  let deadline;
  try {
    server = await serveFixture(resolve(root, 'benchmarks/browser-performance/retention/workloads.js'));
    browser = await chromium.launch({ headless: true });
    report.browserVersion = browser.version();
    const page = await browser.newPage();
    await page.goto(server.url);
    const cdp = await page.context().newCDPSession(page);
    const call = (method, arg) => page.evaluate(async({ methodName, argument }) => {
      const workload = await import('/workloads.js');
      return workload[methodName](argument);
    }, { methodName: method, argument: arg });
    const collect = async() => {
      // A separate browser job releases WeakRef's current-job keep-alive.
      await page.evaluate(() => new Promise(resolveTask => setTimeout(resolveTask, 0)));
      await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('HeapProfiler.collectGarbage');
    };
    const measure = async() => {
      await call('holdControl');
      await collect();
      const held = await call('controlAlive');
      await call('releaseControl');
      await collect();
      const released = await call('controlAlive');
      report.positiveControl = { held, released };
      if (!held || released) { throw new Error('Retention positive/release control failed'); }
      for (let index = -2; index < batches; index++) {
        const batch = await call('runBatch', cycles);
        await collect();
        const withLiveInputs = await call('countAlive');
        await call('releaseInputs');
        await collect();
        const afterInputRelease = await call('countAlive');
        const sample = { phase: index < 0 ? 'warmup' : 'sample', index, ...batch,
          withLiveInputs, afterInputRelease,
          heap: await cdp.send('Runtime.getHeapUsage'), dom: await cdp.send('Memory.getDOMCounters') };
        report.samples.push(sample);
        process.stdout.write(`${JSON.stringify(sample)}\n`);
        if (Object.entries(withLiveInputs).some(([kind, count]) => kind !== 'input' && count > 0) ||
            withLiveInputs.input !== batch.retainedInputs || Object.keys(afterInputRelease).length) {
          throw new Error(`Unexpected retention in ${sample.phase} ${index}`);
        }
        await call('clearProbes');
      }
      if (JSON.stringify(report.source) !== JSON.stringify(await inputs())) {
        throw new Error('Retention source or runtime artifacts changed during measurement');
      }
    };
    await Promise.race([measure(), new Promise((resolveDeadline, reject) => {
      deadline = setTimeout(() => reject(new Error('Retention exceeded 120000 ms')), 120000);
    })]);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.stack || error.message;
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    try { await browser?.close(); } finally { await server?.close(); }
    report.completedAt = new Date().toISOString();
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`Retention ${report.status}: ${output}\n`);
  if (report.error) { process.stderr.write(`${report.error}\n`); }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
