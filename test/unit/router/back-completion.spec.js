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
        '/source': { name: 'source', redirect: () => gated && redirected ? Promise.resolve('/target') : undefined, handler },
        '/target': { name: 'target', handler }, '/next': { name: 'next' },
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
  const router = createRouter({ driver, routes: { '/source': { name: 'source' } } });
  let routes = 0;
  router.on('route', () => { routes++; });
  await router.start(); await router.getInitialDispatch();
  const current = driver.currentEntry;
  assert.equal(await driver.traverseTo(current.key).finished, current);
  assert.equal(routes, 1);
});

it('keeps genuinely distinct Back destinations independent after the first commits', async() => {
  const entered = { first: Promise.withResolvers(), second: Promise.withResolvers() };
  const work = { first: Promise.withResolvers(), second: Promise.withResolvers() };
  let gated = false;
  const errors = [];
  const driver = memoryDriver({ url: 'https://routes.example/first' });
  const router = createRouter({ driver, routes: {
    '/first': { name: 'first' }, '/second': { name: 'second' }, '/third': { name: 'third' },
  }, handler(match) {
    if (gated) { entered[match.name].resolve(); return work[match.name].promise; }
  } });
  router.on('route:error', error => errors.push(error));
  await router.start(); await router.getInitialDispatch();
  await router.navigate('second').finished; await router.navigate('third').finished;
  gated = true;
  const second = router.back();
  await entered.second.promise;
  const first = router.back();
  await entered.first.promise;
  assert.equal(await second, false);
  work.first.resolve();
  assert.equal(await first, true);
  work.second.reject(new Error('obsolete second destination'));
  await turn();
  assert.deepEqual(errors, []);
  assert.equal(router.getCurrent().name, 'first');
});

for (const history of ['replace', 'push']) {
  it(`coalesces queued Back before synchronous unrelated ${history} navigation supersedes it`, async() => {
    const work = Promise.withResolvers();
    const driver = memoryDriver({ url: 'https://routes.example/a' });
    let gated = false;
    let replaced = false;
    let unrelated;
    const router = createRouter({ driver, routes: {
      '/a': { name: 'a', handler() {
        if (gated && !replaced) { replaced = true; unrelated = router.navigate('c', {}, { history }); }
      } },
      '/b': { name: 'b' }, '/c': { name: 'c', handler: () => work.promise },
    } });
    await router.start(); await router.getInitialDispatch();
    await router.navigate('b').finished;
    gated = true;
    const one = router.back();
    const two = router.back();
    let cancelled;
    Promise.all([one, two]).then(values => { cancelled = values; });
    await turn();
    // Both traversals have already been canceled, independently of C's gate.
    assert.deepEqual(cancelled, [false, false]);
    assert.equal(driver.currentEntry.url, 'https://routes.example/c');
    work.resolve();
    assert.equal(await unrelated.finished, true);
  });
}
