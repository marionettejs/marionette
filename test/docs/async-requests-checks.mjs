export const assertions = {
  'guides-async-requests-1': `
const calls = [];
const preview = new Preview({ loadPreview(input, { signal }) {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  calls.push({ input, signal, resolve, reject });
  return promise; // Deliberately ignores abort to verify result suppression independently.
} });
const firstInput = { id: 'first', language: 'en' };
const first = preview.load(firstInput);
firstInput.id = 'mutated';
assert.deepEqual(calls[0].input, { id: 'first', language: 'en' });
assert.equal(Object.isFrozen(calls[0].input), true);
const second = preview.load({ id: 'second', language: 'fr' });
assert.equal(calls[0].signal.aborted, true);
calls[1].resolve({ title: 'Second result' });
assert.equal(await second, true);
calls[0].resolve({ title: 'Obsolete first result' });
assert.equal(await first, false);
assert.equal(preview.el.querySelector('h2').textContent, 'Second result');
const oldFailure = preview.load({ id: 'old', language: 'en' });
const newer = preview.load({ id: 'new', language: 'en' });
calls[3].resolve({ title: 'Newer result' });
await newer;
calls[2].reject(new Error('Obsolete failure'));
assert.equal(await oldFailure, false);
assert.equal(preview.el.querySelector('[role=status]').textContent, 'Ready');
assert.equal(preview.el.querySelector('h2').textContent, 'Newer result');
const currentFailure = preview.load({ id: 'retry', language: 'en' });
const rejected = assert.rejects(currentFailure, /Unavailable/);
calls[4].reject(new Error('Unavailable'));
await rejected;
assert.equal(preview.el.querySelector('[role=status]').textContent, 'Could not load. Try again.');
const retry = preview.load({ id: 'retry', language: 'en' });
calls[5].resolve({ title: 'Recovered' });
assert.equal(await retry, true);
const pending = preview.load({ id: 'late', language: 'en' });
const element = preview.el;
const pendingRevision = preview.revision;
preview.on('before:destroy', () => {
  assert.equal(preview.isDestroyed(), false);
  assert.equal(preview.revision, pendingRevision + 1);
  assert.equal(calls[6].signal.aborted, true);
});
preview.destroy();
const destroyedContents = element.textContent;
assert.equal(calls[6].signal.aborted, true);
calls[6].resolve({ title: 'Too late' });
assert.equal(await pending, false);
assert.equal(element.textContent, destroyedContents);
assert.equal(await preview.load({ id: 'after', language: 'en' }), false);
assert.equal(calls.length, 7);
let rejectAfterDestroy;
const failedAfterDestroy = new Preview({ loadPreview() {
  return new Promise((resolve, reject) => { rejectAfterDestroy = reject; });
} });
const lateFailure = failedAfterDestroy.load({ id: 'late', language: 'en' });
failedAfterDestroy.destroy();
rejectAfterDestroy(new Error('Late rejection'));
assert.equal(await lateFailure, false);
const overlapCalls = [];
const overlap = new Preview({ loadPreview(input, { signal }) {
  return new Promise((resolve, reject) => { overlapCalls.push({ signal, resolve, reject }); });
} });
const older = overlap.load({ id: 'a', language: 'en' });
const stillPending = overlap.load({ id: 'b', language: 'en' });
overlapCalls[0].resolve({ title: 'Stale while newer is pending' });
assert.equal(await older, false);
assert.equal(overlap.el.querySelector('[role=status]').textContent, 'Loading…');
const current = overlap.load({ id: 'c', language: 'en' });
assert.equal(overlapCalls[1].signal.aborted, true); // Old finally did not clear the newer controller.
overlapCalls[1].reject(new Error('Stale while current is pending'));
assert.equal(await stillPending, false);
assert.equal(overlap.el.querySelector('[role=status]').textContent, 'Loading…');
overlapCalls[2].resolve({ title: 'Current' });
assert.equal(await current, true);
assert.equal(overlap.el.querySelector('h2').textContent, 'Current');
overlap.destroy();
`,
  'guides-async-requests-2': `
const calls = [];
const cache = createReadCache(key => new Promise((resolve, reject) => {
  calls.push({ key, resolve, reject });
}));
const first = cache.read('same');
assert.equal(cache.read('same'), first);
await Promise.resolve();
assert.equal(calls.length, 1);
const rejected = assert.rejects(first, /Temporary/);
calls[0].reject(new Error('Temporary'));
await rejected;
const retry = cache.read('same');
assert.notEqual(retry, first);
await Promise.resolve();
calls[1].resolve({ title: 'Recovered' });
assert.deepEqual(await retry, { title: 'Recovered' });
assert.equal(cache.read('same'), retry);
cache.invalidate('same');
const obsolete = cache.read('same');
await Promise.resolve();
cache.invalidate('same');
const replacement = cache.read('same');
await Promise.resolve();
const oldRejected = assert.rejects(obsolete, /Old failure/);
calls[2].reject(new Error('Old failure'));
await oldRejected;
assert.equal(cache.read('same'), replacement);
calls[3].resolve({ title: 'Replacement survives' });
assert.deepEqual(await replacement, { title: 'Replacement survives' });
assert.equal(calls.length, 4);
let attempts = 0;
const syncFailure = createReadCache(() => {
  if (++attempts === 1) { throw new Error('Synchronous failure'); }
  return 42;
});
await assert.rejects(syncFailure.read('key'), /Synchronous failure/);
assert.equal(await syncFailure.read('key'), 42);
assert.equal(attempts, 2);
`,
};
