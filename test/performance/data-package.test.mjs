import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Collection, Model } from '../../packages/data/src/index.ts';

test('removal benchmark rejects missing explicit GC before emitting measurements', () => {
  const script = fileURLToPath(new URL('../../scripts/performance/data-package-removal.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, 'unused-baseline'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Run with --expose-gc/);
  assert.equal(result.stdout, '');
});

test('native bulk removal resolves identities in linear work', () => {
  const count = 1000;
  const models = Array.from({ length: count }, (_, id) => new Model({ id }));
  const collection = new Collection(models);
  const reads = { id: 0 };
  for (const model of models) {
    const id = model.id;
    Object.defineProperty(model, 'id', { get() { reads.id++; return id; } });
  }
  const removed = collection.remove(models, { silent: true });
  assert.deepEqual(removed, models);
  assert.equal(collection.length, 0);
  assert.ok(reads.id <= count * 2, `Expected at most two id reads per member, got ${reads.id}`);
  collection.destroy();
});
