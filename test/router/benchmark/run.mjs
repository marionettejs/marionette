import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { candidateOutput, inspectRouterArchive, validatePreparationReceipt } from '../artifact.mjs';
import { workloads } from './workloads.mjs';

const root = resolve(import.meta.dirname, '../../..');
const { values } = parseArgs({ options: { artifact: { type: 'string' }, sha256: { type: 'string' },
  output: { type: 'string' }, native: { type: 'boolean', default: false }, 'chromium-executable': { type: 'string' } } });
assert.ok(values.output, '--output is required');
const output = candidateOutput(root, values.output);
const consumer = join(output, 'consumer');
const reportFile = join(output, values.native ? 'native.json' : 'cpu.json');
assert.ok(!existsSync(reportFile), 'Never overwrite a previous invocation');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
export function shuffle(items, seed) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const other = seed % (index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
export function summarize(rows) {
  const groups = Object.groupBy(rows.filter(row => row.phase === 'measured' && row.success), row => row.workload);
  return Object.fromEntries(Object.entries(groups).map(([name, samples]) => {
    const sorted = samples.map(row => row.value).sort((a, b) => a - b);
    const at = fraction => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
    const middle = Math.floor(sorted.length / 2);
    return [name, { samples: sorted.length, unit: samples[0].unit,
      median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
      p25: at(0.25), p75: at(0.75), p95: at(0.95), min: sorted[0], max: sorted.at(-1) }];
  }));
}
const report = { schemaVersion: 1, phase: values.native ? 'native' : 'cpu', started: new Date().toISOString(),
  harnessCommit: git(['rev-parse', 'HEAD']), harnessDirty: Boolean(git(['status', '--porcelain'])),
  harnessFiles: Object.fromEntries(['run.mjs', 'workloads.mjs', 'native.mjs'].map(file => [file, hash(readFileSync(join(import.meta.dirname, file)))])),
  environment: { node: process.version, platform: os.platform(), release: os.release(), arch: os.arch(),
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, availableParallelism: os.availableParallelism(),
    memory: os.totalmem(), cpuQuota: existsSync('/sys/fs/cgroup/cpu.max') ? readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim() : null,
    memoryLimit: existsSync('/sys/fs/cgroup/memory.max') ? readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim() : null, loadBefore: os.loadavg() },
  protocol: { warmupBlocks: values.native ? 3 : 5, sampleBlocks: values.native ? 12 : 20, seed: 1729,
    statistic: 'batch mean per public operation; quantiles across batches, not per-operation tails',
    retries: 0, exclusions: 0, comparison: 'single current-contract arm' },
  rows: [], status: 'running' };
mkdirSync(output, { recursive: true });
const save = () => writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
save();
try {
  if (!values.native) {
    assert.ok(values.artifact && values.sha256, '--artifact and --sha256 are required');
    report.archive = inspectRouterArchive(resolve(values.artifact), values.sha256);
    const preparation = JSON.parse(readFileSync(join(dirname(resolve(values.artifact)), 'router-candidate.json')));
    report.archiveSourceCommit = validatePreparationReceipt(preparation, report.archive, preparation.sourceCommit);
    const npm = process.env.npm_execpath;
    assert.ok(npm, 'Run through npm run performance:router');
    report.npm = execFileSync(process.execPath, [npm, '--version'], { encoding: 'utf8' }).trim();
    mkdirSync(consumer);
    writeFileSync(join(consumer, 'package.json'), '{"name":"router-benchmark-consumer","private":true,"type":"module"}\n');
    execFileSync(process.execPath, [npm, 'install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund',
      '--registry=https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=20000',
      '--cache', join(output, 'npm-cache'), resolve(values.artifact), 'marionette@5.0.1', '@mnjs/utils@5.0.1'],
    { cwd: consumer, stdio: 'inherit' });
    const lockBytes = readFileSync(join(consumer, 'package-lock.json'));
    const lock = JSON.parse(lockBytes);
    report.lockSha256 = hash(lockBytes);
    report.peers = ['marionette', '@mnjs/utils', '@mnjs/radio'].map(name => {
      const entry = lock.packages[`node_modules/${name}`];
      assert.equal(entry.version, '5.0.1');
      assert.ok(entry.resolved.startsWith('https://registry.npmjs.org/'));
      assert.ok(entry.integrity);
      return { name, version: entry.version, resolved: entry.resolved, integrity: entry.integrity };
    });
    report.runtimeHashes = Object.fromEntries(['dist/index.js', 'dist/index.cjs'].map(file =>
      [file, hash(readFileSync(join(consumer, 'node_modules/@mnjs/router', file)))]));
    assert.equal(report.runtimeHashes['dist/index.js'], report.archive.browserModuleSha256);
    // Load the installed public import condition, never checkout/source aliases.
    const load = name => {
      const directory = join(consumer, 'node_modules', name);
      const manifest = JSON.parse(readFileSync(join(directory, 'package.json')));
      return import(pathToFileURL(join(directory, manifest.exports['.'].import.default)).href);
    };
    const esm = await load('@mnjs/router');
    const marionette = await load('marionette');
    const cases = await workloads({ ...esm, Application: marionette.Application });
    report.workloads = cases.map(({ id, iterations, unit }) => ({ id, iterations, unit }));
    try {
      // Public outcomes, route round trips and lifecycle counts must hold before timing.
      for (const entry of cases) { await entry.run(1); entry.verify(1); }
      report.correctness = 'all workload prechecks passed; each batch verified after timing';
      for (const phase of ['warmup', 'measured']) {
        const blocks = phase === 'warmup' ? report.protocol.warmupBlocks : report.protocol.sampleBlocks;
        for (let block = 0; block < blocks; block++) {
          const order = shuffle(cases, report.protocol.seed + block + (phase === 'measured' ? 1000 : 0));
          for (let position = 0; position < order.length; position++) {
            const entry = order[position];
            const row = { phase, block, order: position, workload: entry.id, iterations: entry.iterations,
              timestamp: new Date().toISOString(), unit: entry.unit, success: false };
            report.rows.push(row);
            const before = performance.now();
            await entry.run(entry.iterations);
            row.value = (performance.now() - before) * 1000 / entry.iterations;
            entry.verify(entry.iterations);
            row.success = true;
            save();
          }
          save();
        }
      }
    } finally { for (const entry of cases) { entry.close(); } }
    report.summary = summarize(report.rows);
  } else {
    const cpu = JSON.parse(readFileSync(join(output, 'cpu.json')));
    assert.equal(cpu.status, 'passed');
    const archive = inspectRouterArchive(cpu.archive.file, cpu.archive.sha256);
    assert.equal(hash(readFileSync(join(consumer, 'node_modules/@mnjs/router/dist/index.js'))), archive.browserModuleSha256);
    report.archive = archive; report.archiveSourceCommit = cpu.archiveSourceCommit;
    report.lockSha256 = hash(readFileSync(join(consumer, 'package-lock.json')));
    assert.equal(report.lockSha256, cpu.lockSha256);
    const { runNative } = await import('./native.mjs');
    await runNative({ consumer, output, executable: values['chromium-executable'], report, save, shuffle, summarize });
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack ?? String(error);
  throw error;
} finally { report.finished = new Date().toISOString(); report.environment.loadAfter = os.loadavg(); save(); }
console.log(JSON.stringify({ status: report.status, phase: report.phase, summary: report.summary }, null, 2));
