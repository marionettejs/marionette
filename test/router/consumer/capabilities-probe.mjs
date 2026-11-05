import assert from 'node:assert/strict';
import { boot, missingRouterCapabilities } from './bootstrap.mjs';

for (const [owner, property, name] of [
  [globalThis, 'URLPattern', 'URLPattern'], [AbortSignal, 'any', 'AbortSignal.any'],
  [Promise, 'withResolvers', 'Promise.withResolvers'], [URL, 'canParse', 'URL.canParse'],
]) {
  const descriptor = Object.getOwnPropertyDescriptor(owner, property);
  try {
    Object.defineProperty(owner, property, { configurable: true, value: undefined });
    let loaded = false;
    const outcome = await boot(() => { loaded = true; return import('./eager-router.mjs'); }, { native: false });
    assert.deepEqual(outcome, { status: 'unsupported', missing: [name] });
    assert.equal(loaded, false, `${name}: eager application must not be imported`);
    const api = await import('@mnjs/router'); // Importing optional tools itself is safe.
    if (name === 'URLPattern') {
      assert.throws(() => new api.Router({ driver: api.memoryDriver({ url: 'https://desk.example/' }), routes: { home: { path: '/' } } }), /URLPattern/);
    }
  } finally {
    Object.defineProperty(owner, property, descriptor);
  }
}
assert.ok(missingRouterCapabilities().includes('Navigation API'));
assert.deepEqual(await boot(() => { throw new Error('must not load native app'); }), { status: 'unsupported', missing: ['Navigation API'] });
assert.deepEqual(missingRouterCapabilities({ native: false }), []);
const { app } = await boot(() => import('./eager-router.mjs'), { native: false });
assert.deepEqual(await app.getInitialDispatch(), { status: 'unmatched' });
app.destroy();
console.log('Installed capability bootstrap: missing capabilities block eager construction; package import remains safe.');
