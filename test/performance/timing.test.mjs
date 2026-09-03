import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  assertHarnessRevision,
  changePercent,
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
    contract.timing.cases = [];

    try {
      const configPath = join(fixtureRoot, 'performance.json');
      await writeFile(configPath, JSON.stringify(contract));
      const result = await measure({ root, configPath });

      assert.deepEqual(result.cases, []);
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
      ]);
      await writeFile(join(fixtureRoot, 'package.json'), '{"type":"module"}\n');
      await writeFile(
        join(fixtureRoot, 'dist/marionette.js'),
        'export function setDataApi() {}\n' +
        'export function setStateApi() {}\n' +
        'export const View = { extend() { throw new Error("Timing case construction failed"); } };\n' +
        'export const Behavior = {};\n' +
        'export const CollectionView = {};\n' +
        'export const Region = {};\n'
      );
      await writeFile(
        join(fixtureRoot, 'packages/adapters/dist/backbone.js'),
        'export default {};\n'
      );
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
