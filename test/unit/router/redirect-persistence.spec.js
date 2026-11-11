import assert from 'node:assert/strict';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

for (const asynchronous of [false, true]) {
  for (const initial of [false, true]) {
    it(`uses redirect-match persistence for ${initial ? 'initial' : 'subsequent'} ${asynchronous ? 'async' : 'sync'} named redirects`, async() => {
      const driver = memoryDriver({ url: `https://routes.example/${initial ? 'red' : 'blue/catalog'}` });
      const entered = Promise.withResolvers();
      const work = Promise.withResolvers();
      let paused = initial;
      const router = createRouter({ driver, persistParams: ['desk'], routes: {
        desk: { path: '/:desk', redirect() {
          const target = { name: 'catalog' };
          return asynchronous ? Promise.resolve(target) : target;
        } }, catalog: { path: '/:desk/catalog', handler(match) {
          if (paused) { entered.resolve(match); return work.promise; }
        } },
      } });
      await router.start();
      if (!initial) { await router.getInitialDispatch(); paused = true; }
      const completion = initial ? router.getInitialDispatch() : router.navigate('/red?drop=1#old').finished;
      let settled = false;
      completion.then(() => { settled = true; });
      const first = await Promise.race([entered.promise.then(match => ({ match })), completion.then(value => ({ value }))]);
      assert.equal(first.match?.params.desk, 'red');
      assert.equal(driver.currentEntry.url, 'https://routes.example/red/catalog');
      assert.equal(settled, false, 'Redirect completion must await destination presentation');
      work.resolve();
      const result = await completion;
      assert.equal(initial ? result.status : result, initial ? 'matched' : true);
      assert.equal(router.getCurrent().name, 'catalog');
    });
  }

  it(`keeps explicit params authoritative in ${asynchronous ? 'async' : 'sync'} redirects`, async() => {
    const router = createRouter({ driver: memoryDriver({ url: 'https://routes.example/red' }), persistParams: ['desk'], routes: {
      desk: { path: '/:desk', redirect() {
        const target = { name: 'catalog', params: { desk: 'green' } };
        return asynchronous ? Promise.resolve(target) : target;
      } }, catalog: { path: '/:desk/catalog' },
    } });
    await router.start();
    assert.equal((await router.getInitialDispatch()).status, 'matched');
    assert.equal(router.getCurrent().params.desk, 'green');
  });

  it(`does not borrow missing redirect params from the departing route with ${asynchronous ? 'async' : 'sync'} targets`, async() => {
    const router = createRouter({ driver: memoryDriver({ url: 'https://routes.example/blue/catalog' }), persistParams: ['desk'], routes: {
      legacy: { path: '/legacy', redirect() {
        const target = { name: 'catalog' };
        return asynchronous ? Promise.resolve(target) : target;
      } }, catalog: { path: '/:desk/catalog' },
    } });
    await router.start(); await router.getInitialDispatch();
    await assert.rejects(router.navigate('legacy').finished, /missing param "desk"/);
  });

  it(`preserves explicit param clearing in ${asynchronous ? 'async' : 'sync'} redirects`, async() => {
    const router = createRouter({ driver: memoryDriver({ url: 'https://routes.example/red' }), persistParams: ['desk'], routes: {
      desk: { path: '/:desk', redirect() {
        const target = { name: 'catalog', params: { desk: undefined } };
        return asynchronous ? Promise.resolve(target) : target;
      } }, catalog: { path: '/:desk/catalog' },
    } });
    await router.start();
    const initial = await router.getInitialDispatch();
    assert.equal(initial.status, 'failed');
    assert.match(initial.error.message, /missing param "desk"/);
  });
}
