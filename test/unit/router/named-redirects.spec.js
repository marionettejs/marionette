import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const origin = 'https://routes.example';
const fragments = [
  [undefined, '#old'], ['details', '#details'], ['#details', '#details'], ['', ''], ['#', '#'],
  ['café/雪?x=1#inner', '#caf%C3%A9/%E9%9B%AA?x=1#inner'], ['%E9%9B%AA', '#%E9%9B%AA'],
];

describe('named redirect fragments', () => {
  for (const asynchronous of [false, true]) {
    for (const [hash, suffix] of fragments) {
      it(`uses hash ${JSON.stringify(hash)} with ${asynchronous ? 'async' : 'sync'} lookup while forwarding omitted query`, async() => {
        const entered = Promise.withResolvers();
        const work = Promise.withResolvers();
        const ready = [];
        const driver = memoryDriver({ url: `${origin}/home` });
        const router = createRouter({ driver, routes: {
          '/home': { name: 'home' },
          '/legacy/:id': { name: 'source', redirect(match) {
            const target = { name: 'item', params: match.params, hash };
            return asynchronous ? Promise.resolve(target) : target;
          } },
          '/items/:id': { name: 'item', handler(match) { entered.resolve(match); return work.promise; } },
        } });
        router.on('route:ready', match => ready.push(match.name));
        await router.start(); await router.getInitialDispatch();
        const result = router.navigate('/legacy/42?old=1#old', { state: { selected: '42' } });
        const match = await entered.promise;
        assert.equal(match.url.href, `${origin}/items/42?old=1${suffix}`);
        assert.equal(match.query.get('old'), '1');
        assert.equal(match.signal.aborted, false);
        assert.deepEqual(match.state, { selected: '42' });
        assert.equal(driver.entries().length, 2);
        assert.deepEqual(ready, ['home']);
        let finished = false;
        result.finished.then(() => { finished = true; });
        await Promise.resolve();
        assert.equal(finished, false);
        work.resolve(false);
        assert.equal(await result.finished, true);
        assert.equal(await result.committed, true);
        assert.deepEqual(ready, ['home', 'item']);
        const destination = driver.currentEntry;
        assert.equal(await router.back(), true);
        assert.equal(router.getCurrent().name, 'home');
        await driver.traverseTo(destination.key).finished;
        assert.equal(router.getCurrent().url.href, `${origin}/items/42?old=1${suffix}`);
        assert.deepEqual(router.getCurrent().state, { selected: '42' });
      });
    }

    it(`awaits an initial same-path named fragment destination with ${asynchronous ? 'async' : 'sync'} lookup`, async() => {
      const entered = Promise.withResolvers();
      const work = Promise.withResolvers();
      const router = createRouter({ driver: memoryDriver({ url: `${origin}/page?discard=1` }), routes: {
        '/page': { name: 'page', redirect(match) {
          const target = match.url.hash ? undefined : { name: 'page', hash: '#details', query: { keep: 'one' } };
          return asynchronous ? Promise.resolve(target) : target;
        }, handler(match) { entered.resolve(match); return work.promise; } },
      } });
      await router.start();
      const completion = router.getInitialDispatch();
      const first = await Promise.race([entered.promise.then(match => ({ match })), completion.then(result => ({ result }))]);
      assert.ok(first.match, 'The destination handler must run before initial completion');
      const { match } = first;
      assert.equal(match.url.href, `${origin}/page?keep=one#details`);
      assert.equal(match.initial, true);
      work.resolve();
      assert.deepEqual(await completion, { status: 'matched', match });
    });

    it(`cancels held named redirect presentation with ${asynchronous ? 'async' : 'sync'} lookup`, async() => {
      const entered = Promise.withResolvers();
      const work = Promise.withResolvers();
      const ready = [];
      const errors = [];
      const router = createRouter({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
        '/home': { name: 'home' },
        '/source': { name: 'source', redirect() {
          const target = { name: 'item', hash: 'details', query: 'view=full' };
          return asynchronous ? Promise.resolve(target) : target;
        } },
        '/items': { name: 'item', handler(match) { entered.resolve(match); return work.promise; } },
      } });
      router.on('route:ready', match => ready.push(match.name));
      router.on('route:error', error => errors.push(error));
      await router.start(); await router.getInitialDispatch();
      const completion = router.navigate('source').finished;
      const match = await entered.promise;
      assert.equal(match.url.href, `${origin}/items?view=full#details`);
      await router.navigate('home').finished;
      assert.equal(await completion, false);
      assert.equal(match.signal.aborted, true);
      work.reject(new Error('obsolete presentation'));
      await work.promise.catch(() => {});
      assert.deepEqual(ready, ['home', 'home']);
      assert.deepEqual(errors, []);
    });
  }
});
