import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import {
  sameMeasurementInputs,
  summarize,
  validateBrowserPerformanceContract
} from '../../scripts/performance/browser.mjs';

const root = resolve(import.meta.dirname, '../..');

async function canonicalInputs() {
  const contract = JSON.parse(await readFile(
    resolve(root, 'benchmarks/browser-performance/contract.json'), 'utf8'
  ));
  const manifestPath = resolve(root, contract.fixture.path);
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const entry = await readFile(resolve(manifestPath, '..', manifest.entry));
  return {
    contract,
    manifest,
    manifestText,
    entryRevision: createHash('sha256').update(entry).digest('hex')
  };
}

describe('browser performance evidence', () => {
  test('binds the reporting contract to the complete versioned workload fixture', async() => {
    assert.deepEqual(validateBrowserPerformanceContract(await canonicalInputs()), []);
  });

  test('fails closed when workload content or inventory changes', async() => {
    const inputs = await canonicalInputs();
    const changedEntry = { ...inputs, entryRevision: '0'.repeat(64) };
    assert.match(validateBrowserPerformanceContract(changedEntry).join('; '), /workload SHA-256/);

    inputs.manifest.runOrder = inputs.manifest.runOrder.slice(1);
    assert.match(validateBrowserPerformanceContract(inputs).join('; '), /inventory/);

    inputs.manifest.workloadTimeoutMilliseconds = 0;
    assert.match(validateBrowserPerformanceContract(inputs).join('; '), /timeout/);
  });

  test('detects source or artifact drift during a run', () => {
    const before = { source: { commit: 'abc', dirty: false }, artifacts: { 'dist/a.js': '123' } };
    assert.equal(sameMeasurementInputs(before, structuredClone(before)), true);
    assert.equal(sameMeasurementInputs(before, {
      ...before,
      artifacts: { 'dist/a.js': '456' }
    }), false);
  });

  test('retains raw-distribution summary boundaries', () => {
    assert.deepEqual(summarize([
      { durationMilliseconds: 5 },
      { durationMilliseconds: 1 },
      { durationMilliseconds: 2 },
      { durationMilliseconds: 4 }
    ]), {
      medianMilliseconds: 3,
      p95Milliseconds: 5,
      minMilliseconds: 1,
      maxMilliseconds: 5
    });
  });
});
