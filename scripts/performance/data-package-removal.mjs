import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Supply a baseline packages/data/src directory from a pinned checkout or git show.
const root = resolve(import.meta.dirname, '../..');
const baseline = process.argv[2];
if (!baseline) { throw new Error('Usage: node --expose-gc scripts/performance/data-package-removal.mjs BASELINE_SOURCE_DIRECTORY'); }
if (typeof globalThis.gc !== 'function') { throw new Error('Run with --expose-gc to apply the benchmark method.'); }
registerHooks({
  resolve(specifier, context, nextResolve) {
    // Recorded pre-scope baselines still import the old name. Keep this
    // benchmark-only mapping while those historical comparisons remain supported.
    if (specifier === '@mnjs/utils' || specifier === '@marionette/utils') {
      return { url: pathToFileURL(resolve(root, 'packages/utils/src/index.ts')).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  }
});
const variants = {
  before: await import(pathToFileURL(resolve(baseline, 'index.ts')).href),
  after: await import(pathToFileURL(resolve(root, 'packages/data/src/index.ts')).href)
};
const cases = [];
for (const count of [1000, 10000]) {
  for (const input of ['models', 'ids', 'single']) {
    const samples = { before: [], after: [] };
    for (let trial = -2; trial < 9; trial++) {
      const order = trial % 2 ? ['before', 'after'] : ['after', 'before'];
      for (const name of order) {
        const { Model, Collection } = variants[name];
        const models = Array.from({ length: count }, (_, id) => new Model({ id }));
        const collection = new Collection(models);
        const candidates = input === 'models' ? models : input === 'ids' ? models.map(model => model.id) : models[0];
        globalThis.gc();
        const start = performance.now();
        const removed = collection.remove(candidates, { silent: true });
        const elapsed = performance.now() - start;
        if (trial >= 0) { samples[name].push(elapsed); }
        assert.equal(collection.length, input === 'single' ? count - 1 : 0);
        assert.equal(input === 'single' ? removed : removed.length, input === 'single' ? models[0] : count);
        collection.destroy();
      }
    }
    const median = values => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
    const beforeMs = median(samples.before);
    const afterMs = median(samples.after);
    cases.push({ count, input, beforeMs, afterMs, speedup: beforeMs / afterMs, samples });
  }
}
console.log(JSON.stringify({
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  baseline: resolve(baseline),
  current: root,
  explicitGc: typeof globalThis.gc === 'function',
  method: 'Two warmups and nine measured samples per variant; alternating order; construction and cleanup excluded; silent removal; median milliseconds.',
  cases
}, null, 2));
