import assert from 'node:assert/strict';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

for (const initial of [false, true]) {
  for (const asynchronous of [false, true]) {
    it(`awaits the fragment redirect destination during ${initial ? 'initial dispatch' : 'navigation'} with ${asynchronous ? 'async' : 'sync'} lookup`, async() => {
      const entered = Promise.withResolvers();
      const presentation = Promise.withResolvers();
      const handlers = [];
      const ready = [];
      const driver = memoryDriver({ url: `https://routes.example/${initial ? 'page' : 'home'}` });
      const router = createRouter({ driver, routes: {
        '/home': { name: 'home' },
        '/page': { name: 'page', redirect(match) {
          const target = match.url.hash ? undefined : '#details';
          return asynchronous ? Promise.resolve(target) : target;
        }, handler(match) {
          handlers.push(match);
          entered.resolve();
          return presentation.promise;
        } },
      } });
      router.on('route:ready', match => ready.push(match.name));
      await router.start();
      if (!initial) { await router.getInitialDispatch(); }
      let settled = false;
      const completion = initial ? router.getInitialDispatch() : router.navigate('/page').finished;
      completion.finally(() => { settled = true; });
      // Both branches settle this observation without relying on a timeout:
      // successful dispatch enters the held handler; the bug completes instead.
      const first = await Promise.race([entered.promise.then(() => 'entered'), completion.then(() => 'completed')]);
      assert.equal(first, 'entered');
      assert.equal(settled, false);
      assert.equal(handlers.length, 1);
      assert.equal(handlers[0].url.href, 'https://routes.example/page#details');
      assert.equal(handlers[0].signal.aborted, false);
      assert.equal(driver.currentEntry.url, handlers[0].url.href);
      assert.deepEqual(ready, initial ? [] : ['home']);
      presentation.resolve(false);
      const result = await completion;
      if (initial) {
        assert.equal(result.status, 'matched');
        assert.equal(result.match, handlers[0]);
      } else { assert.equal(result, true); }
      assert.deepEqual(ready, initial ? ['page'] : ['home', 'page']);
    });
  }
}

for (const failure of ['operational', 'cancelled']) {
  it(`preserves ${failure} destination completion after a fragment redirect`, async() => {
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const errors = [];
    const ready = [];
    const router = createRouter({ driver: memoryDriver({ url: 'https://routes.example/home' }), routes: {
      '/home': { name: 'home' },
      '/page': { name: 'page', redirect: match => match.url.hash ? undefined : Promise.resolve('#details'), handler() {
        entered.resolve();
        return work.promise;
      } },
    } });
    router.on('route:error', (error, match) => errors.push([error, match.name]));
    router.on('route:ready', match => ready.push(match.name));
    await router.start(); await router.getInitialDispatch();
    const result = router.navigate('/page').finished;
    result.catch(() => {});
    assert.equal(await Promise.race([entered.promise.then(() => 'entered'), result.then(() => 'completed')]), 'entered');
    const error = new DOMException('independent destination request', 'AbortError');
    if (failure === 'cancelled') {
      router.stop();
      assert.equal(await result, false);
      work.reject(error);
      await work.promise.catch(() => {});
      assert.deepEqual(errors, []);
    } else {
      work.reject(error);
      await assert.rejects(result, reason => reason === error);
      assert.deepEqual(errors, [[error, 'page']]);
      assert.equal(router.getCurrent().signal.aborted, false);
    }
    assert.deepEqual(ready, ['home']);
  });
}

it('leaves ordinary fragment navigation native after a followed redirect completes', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/page' });
  const router = createRouter({ driver, routes: {
    '/page': { name: 'page', redirect: match => match.url.hash ? undefined : '#details' },
  } });
  const ready = [];
  router.on('route:ready', match => ready.push(match.url.hash));
  await router.start(); await router.getInitialDispatch();
  const current = router.getCurrent();
  const before = ready.length;
  await driver.navigate('#other').finished;
  assert.equal(driver.currentEntry.url, 'https://routes.example/page#other');
  assert.equal(router.getCurrent(), current);
  assert.equal(ready.length, before);
  assert.equal(driver.documentNavigations.at(-1), 'https://routes.example/page#other');
});
