import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import {
  assertHarnessRevision,
  changePercent,
  harnessRevisionFor,
  percentile,
  summarize,
} from '../../benchmarks/performance.mjs';

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
      readFile(new URL('../../benchmarks/performance.mjs', import.meta.url)),
      readFile(new URL('../../config/performance.json', import.meta.url), 'utf8')
        .then(JSON.parse),
    ]);

    assert.equal(
      harnessRevisionFor(source),
      contract.timing.harnessRevision
    );
  });
});
