import { describe, it, vi } from 'vitest';
import assert from 'node:assert/strict';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const base = 'https://example.test/home';

function setup(lookup, initial = '/home') {
  const driver = memoryDriver({ url: new URL(initial, base).href });
  const handled = [];
  const routed = [];
  const errors = [];
  let router;
  const forward = (name, match, params = match.params) => router.url(name, params, { query: match.query }) + match.url.hash;
  router = createRouter({ driver, routes: [
    { name: 'home', path: '/home' },
    { name: 'item', path: '/workspaces/:workspace/items/:itemId' },
    { name: 'oldDetails', path: '/legacy/:legacyId/details', redirect: match => forward('oldItem', match) },
    { name: 'oldItem', path: '/legacy/:legacyId', redirect: async(match, { signal }) => {
      const params = await lookup(match.params.legacyId, { signal });
      return forward('item', match, params);
    } },
  ], handler: match => handled.push(match.name) });
  router.on('route', match => routed.push(match));
  router.on('route:error', (error, match) => errors.push({ error, match }));
  return { router, driver, handled, routed, errors };
}

describe('Application-owned bookmark redirects', () => {
  it('uses a synchronous redirect with explicit query/hash forwarding and replacement history', async() => {
    const driver = memoryDriver({ url: base });
    let router;
    const handled = [];
    router = createRouter({ driver, routes: [
      { name: 'home', path: '/home' }, { name: 'item', path: '/items/:id' },
      { name: 'oldItem', path: '/old/:id', redirect: match => router.url('item', match.params, { query: match.query }) + match.url.hash },
    ], handler: match => handled.push(match.name) });
    assert.equal(router.match('/old/7?q=one#details').name, 'oldItem');
    assert.deepEqual(handled, []);
    await router.start();
    handled.length = 0;
    assert.equal(await router.navigate('/old/7?q=one#details').finished, true);
    assert.equal(driver.currentEntry.url, 'https://example.test/items/7?q=one#details');
    assert.deepEqual(handled, ['item']);
    assert.equal(driver.entries().length, 2);
    assert.equal(router.url('oldItem', { id: '7' }), '/old/7');
    assert.equal(await router.back(), true);
    assert.equal(router.getCurrent().name, 'home');
  });

  it('forwards query only when the callback requests it and does not inherit a hash for named targets', async() => {
    const driver = memoryDriver({ url: base });
    const router = createRouter({ driver, routes: [
      { name: 'home', path: '/home' }, { name: 'item', path: '/items/:id' },
      { name: 'oldItem', path: '/old/:id', redirect: ({ params, query }) => ({ name: 'item', params, query }) },
    ] });
    await router.start();
    await router.navigate('/old/7?q=one#details').finished;
    assert.equal(driver.currentEntry.url, 'https://example.test/items/7?q=one');
  });

  for (const initial of [false, true]) {
    it(`observes a two-hop bookmark lookup during ${ initial ? 'initial routing' : 'navigate' }`, async() => {
      const pending = Promise.withResolvers();
      const entered = Promise.withResolvers();
      const lookup = vi.fn((id, context) => { entered.resolve(context); return pending.promise; });
      const context = setup(lookup, initial ? '/legacy/old-7/details?q=one#details' : '/home');
      const { router, driver, routed, handled } = context;
      if (!initial) { await router.start(); routed.length = 0; handled.length = 0; }
      const initialReady = initial ? new Promise(resolve => router.once('route:ready', resolve)) : null;
      const ready = initial ? initialReady : router.navigate('/legacy/old-7/details?q=one#details').finished;
      if (initial) { assert.equal(await router.start(), true); }
      const signal = (await entered.promise).signal;
      assert.equal(signal.aborted, false);
      assert.equal(lookup.mock.calls[0][0], 'old-7');
      assert.equal(driver.currentEntry.url, 'https://example.test/legacy/old-7?q=one#details');
      assert.deepEqual(routed.map(match => match.name), ['oldItem']);
      assert.deepEqual(handled, []);
      pending.resolve({ workspace: 'w1', itemId: 'new-7' });
      const outcome = await ready;
      if (initial) { assert.equal(outcome.name, 'item'); } else { assert.equal(outcome, true); }
      assert.deepEqual(routed.map(match => match.name), ['oldItem', 'item']);
      assert.deepEqual(handled, ['item']);
      assert.deepEqual(router.getCurrent().params, { workspace: 'w1', itemId: 'new-7' });
      assert.equal(driver.currentEntry.url, 'https://example.test/workspaces/w1/items/new-7?q=one#details');
      assert.equal(driver.entries().length, initial ? 1 : 2);
      assert.equal(router.getCurrent().initial, initial);
    });
  }

  it('ignores a stale async lookup result even when the application lookup ignores cancellation', async() => {
    const pending = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const { router, driver } = setup((_id, { signal }) => { entered.resolve(signal); return pending.promise; });
    await router.start();
    const old = router.navigate('/legacy/old-7/details').finished;
    const signal = await entered.promise;
    await router.navigate('/home').finished;
    assert.equal(signal.aborted, true);
    pending.resolve({ workspace: 'w1', itemId: 'new-7' });
    assert.equal(await old, false);
    assert.equal(router.getCurrent().name, 'home');
    assert.equal(driver.currentEntry.url, base);
  });

  it('reports lookup failures at the intermediate legacy URL', async() => {
    const failure = new Error('lookup failed');
    const { router, driver, errors, handled } = setup(async() => { throw failure; });
    await router.start();
    handled.length = 0;
    await assert.rejects(router.navigate('/legacy/old-7/details?q=one#details').finished, error => error === failure);
    assert.equal(driver.currentEntry.url, 'https://example.test/legacy/old-7?q=one#details');
    assert.equal(router.getCurrent().name, 'oldItem');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, failure);
    assert.equal(errors[0].match.name, 'oldItem');
    assert.deepEqual(handled, []);
  });
});
