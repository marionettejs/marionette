import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const sourceRoot = process.argv[2];
assert.ok(sourceRoot, 'Pass the source checkout path');
const sourceUrl = path => pathToFileURL(resolve(sourceRoot, path)).href;
const aliases = new Map([
  ['@mnjs/utils', sourceUrl('packages/utils/src/index.ts')],
  ['@mnjs/radio', sourceUrl('packages/radio/src/index.ts')],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(aliases.get(specifier) || specifier, context);
  },
});
const { Application } = await import(sourceUrl('src/index.ts'));
let completedSignal;
const completed = new (Application.extend({
  prepareStart(options, { signal }) { completedSignal = signal; },
}))();
assert.equal(await completed.start(), true);
assert.equal(completedSignal.aborted, false);
assert.equal(await completed.stop(), true);
assert.equal(completedSignal.aborted, false, 'Completed readiness signal does not become a run-lifetime signal');
assert.equal(await completed.destroy(), true);
assert.equal(completedSignal.aborted, false);

let pendingSignal;
let finishPreparation;
const pending = new (Application.extend({
  prepareStart(options, { signal }) {
    pendingSignal = signal;
    return new Promise(resolve => { finishPreparation = resolve; });
  },
}))();
const starting = pending.start();
assert.equal(pendingSignal.aborted, false);
const stopping = pending.stop();
assert.equal(pendingSignal.aborted, true, 'Pending readiness is aborted by stop');
finishPreparation();
assert.equal(await starting, false);
assert.equal(await stopping, true);
assert.equal(pending.isRunning(), false);
await pending.destroy();
console.log('PASS: completed readiness remains un-aborted after stop/destroy; pending readiness is aborted and cannot activate after stop.');
