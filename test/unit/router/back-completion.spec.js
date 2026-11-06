import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const outcomes = ['fulfilled', 'error', 'abort-error', 'redirected', 'redirected-error', 'redirected-abort-error', 'stopped'];
for (const coalesced of [false, true]) {
  for (const outcome of outcomes) {
    it(`shares duplicate Back ${outcome} completion with ${coalesced ? 'coalesced raw results' : 'the memory driver'}`, async() => {
      const memory = memoryDriver({ url: 'https://routes.example/source' });
      let raw;
      const driver = coalesced ? { ...memory, get currentEntry() { return memory.currentEntry; }, back() {
        raw ??= memory.back();
        return raw;
      } } : memory;
      let gated = false;
      const redirected = outcome.startsWith('redirected');
      const entered = Promise.withResolvers();
      const presentation = Promise.withResolvers();
      const ready = [];
      const errors = [];
      const handler = () => {
        if (gated) { entered.resolve(); return presentation.promise; }
      };
      const router = createRouter({ driver, routes: {
        source: { path: '/source', redirect: () => gated && redirected ? Promise.resolve('/target') : undefined, handler },
        target: { path: '/target', handler }, next: { path: '/next' },
      } });
      router.on('route:ready', match => ready.push(match.name));
      router.on('route:error', error => errors.push(error));
      await router.start(); await router.getInitialDispatch();
      await router.navigate('next').finished;
      gated = true;
      const completion = { settled: 0 };
      const one = router.back();
      const two = router.back();
      for (const promise of [one, two]) { promise.then(() => { completion.settled++; }, () => { completion.settled++; }); }
      const results = Promise.allSettled([one, two]);
      await entered.promise;
      await turn();
      assert.equal(completion.settled, 0, 'Both callers await the held destination');
      const failure = outcome.includes('abort-error') ? new DOMException('independent target fetch aborted', 'AbortError') : new Error('independent target failure');
      if (outcome === 'stopped') { router.stop(); } else if (outcome.includes('error')) { presentation.reject(failure); } else { presentation.resolve(false); }
      const actual = await results;
      if (outcome.includes('error')) {
        assert.deepEqual(actual, [{ status: 'rejected', reason: failure }, { status: 'rejected', reason: failure }]);
        assert.deepEqual(errors, [failure]);
      } else {
        const value = outcome !== 'stopped';
        assert.deepEqual(actual, [{ status: 'fulfilled', value }, { status: 'fulfilled', value }]);
        assert.deepEqual(errors, []);
      }
      if (outcome === 'stopped') { presentation.resolve(); }
      assert.deepEqual(ready, ['source', 'next', ...(outcome === 'fulfilled' ? ['source'] : outcome === 'redirected' ? ['target'] : [])]);
    });
  }
}

it('keeps a settled current-entry traversal an immediate no-op', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/source' });
  const router = createRouter({ driver, routes: { source: { path: '/source' } } });
  let routes = 0;
  router.on('route', () => { routes++; });
  await router.start(); await router.getInitialDispatch();
  const current = driver.currentEntry;
  assert.equal(await driver.traverseTo(current.key).finished, current);
  assert.equal(routes, 1);
});
