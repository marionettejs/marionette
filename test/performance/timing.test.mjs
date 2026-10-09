import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  assertHarnessRevision,
  changePercent,
  createReport,
  harnessRevisionFor,
  measure,
  percentile,
  summarize,
} from '../../scripts/performance/timing.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('hosted timing report math', () => {
  test('calculates deterministic median and nearest-rank p95 values', () => {
    assert.deepEqual(summarize([3, 100, 1, 2]), {
      medianNanoseconds: 2.5,
      p95Nanoseconds: 100,
      minNanoseconds: 1,
      maxNanoseconds: 100,
    });
    assert.equal(percentile([1, 2, 3, 4, 5], 0.95), 5);
  });

  test('calculates percentage changes including a zero baseline', () => {
    assert.equal(changePercent(100, 105), 5);
    assert.equal(changePercent(0, 0), 100);
  });

  test('compares only matched workloads and omits removed cases', async() => {
    const directory = await mkdtemp(join(tmpdir(), 'marionette-timing-report-'));
    const baseFile = join(directory, 'base.json');
    const currentFile = join(directory, 'current.json');
    const report = {
      schemaVersion: 2, harnessSchemaVersion: 1, harnessRevision: 'abc',
      measurement: { environment: 'jsdom', sampleCount: 20, warmupBatches: 5 },
      environment: { node: '24', platform: 'linux', architecture: 'x64' },
      warningThresholdPercent: 10,
      cases: [{ id: 'render', iterationsPerSample: 10, sampleCount: 20,
        medianNanoseconds: 100, p95Nanoseconds: 200 }],
    };
    try {
      await writeFile(baseFile, JSON.stringify(report));
      const current = structuredClone(report);
      current.cases[0].medianNanoseconds = 120;
      await writeFile(currentFile, JSON.stringify(current));
      assert.match(await createReport(baseFile, currentFile), /120 ns \(\+20.00%\)/);
      assert.match(await createReport(baseFile, currentFile), /exceeded/);
      for (const mutate of [
        value => { value.harnessRevision = 'changed'; },
        value => { delete value.harnessRevision; },
        value => { value.schemaVersion = 1; },
        value => { value.measurement.warmupBatches = 2; },
        value => { value.environment.node = '26'; },
        value => { value.cases[0].iterationsPerSample = 20; },
        value => { value.cases[0].sampleCount = 5; },
      ]) {
        const changed = structuredClone(current);
        mutate(changed);
        await writeFile(currentFile, JSON.stringify(changed));
        const text = await createReport(baseFile, currentFile);
        assert.match(text, /Non-comparable/);
        assert.doesNotMatch(text, /\+20.00%|exceeded the/);
      }
      current.cases[0].id = 'new-workload';
      await writeFile(currentFile, JSON.stringify(current));
      const text = await createReport(baseFile, currentFile);
      assert.match(text, /new-workload \| New/);
      assert.doesNotMatch(text, /\| render \|/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('accepts only the pinned harness revision', () => {
    const source = Buffer.from('fixed harness source');
    const revision = harnessRevisionFor(source);

    assert.equal(assertHarnessRevision(source, revision), revision);
    assert.throws(
      () => assertHarnessRevision(source, 'not-the-revision'),
      /Timing harness revision .* does not match not-the-revision/
    );
  });

  test('matches the committed harness revision', async() => {
    const [source, contract] = await Promise.all([
      readFile(new URL('../../scripts/performance/timing.mjs', import.meta.url)),
      readFile(new URL('../../config/performance.json', import.meta.url), 'utf8')
        .then(JSON.parse),
    ]);

    assert.equal(
      harnessRevisionFor(source),
      contract.timing.harnessRevision
    );
  });

  test('restores DOM globals when loading the runtime fails', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-runtime-'));
    const configPath = fileURLToPath(new URL('../../config/performance.json', import.meta.url));
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      await assert.rejects(
        measure({ root: fixtureRoot, configPath, dependencyRoot: root }),
        /dist\/marionette\.js|packages\/adapters\/dist\/backbone\.js/
      );
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), windowDescriptor);
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'document'), documentDescriptor);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('restores DOM globals after a successful measurement', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-timing-'));
    const contract = JSON.parse(await readFile(new URL('../../config/performance.json', import.meta.url)));
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    contract.timing.cases = contract.timing.cases.map(entry => ({ ...entry, iterationsPerSample: 1 }));
    contract.timing.sampleCount = 1;
    contract.timing.warmupBatches = 1;

    try {
      const configPath = join(fixtureRoot, 'performance.json');
      await writeFile(configPath, JSON.stringify(contract));
      const result = await measure({ root, configPath });

      assert.equal(result.cases.length, 8);
      assert.ok(result.cases.every(entry => Number.isFinite(entry.medianNanoseconds)));
      assert.equal(result.measurement.environment, 'jsdom');
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), windowDescriptor);
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'document'), documentDescriptor);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('restores DOM globals when timing case construction fails', async() => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'marionette-performance-runtime-'));
    const configPath = fileURLToPath(new URL('../../config/performance.json', import.meta.url));
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');

    try {
      await Promise.all([
        mkdir(join(fixtureRoot, 'dist'), { recursive: true }),
        mkdir(join(fixtureRoot, 'packages/adapters/dist'), { recursive: true }),
        mkdir(join(fixtureRoot, 'packages/data/dist'), { recursive: true }),
      ]);
      await writeFile(join(fixtureRoot, 'package.json'), '{"type":"module"}\n');
      await writeFile(
        join(fixtureRoot, 'dist/marionette.js'),
        'export function createMarionette() { throw new Error("Timing case construction failed"); }\n'
      );
      await writeFile(
        join(fixtureRoot, 'packages/adapters/dist/backbone.js'),
        'export default {};\n'
      );
      await writeFile(join(fixtureRoot, 'packages/data/dist/index.js'), 'export const DataApi = {};');
      await assert.rejects(
        measure({
          root: fixtureRoot,
          configPath,
          dependencyRoot: root,
        }),
        /Timing case construction failed/
      );
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'window'), windowDescriptor);
      assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'document'), documentDescriptor);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
