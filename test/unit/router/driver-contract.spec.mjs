import { test, onTestFinished } from 'vitest';
import assert from 'node:assert/strict';
import { createRoutes, createRouter, createMemoryHistory, createBrowserHistory } from '@mnjs/router';

const routes = createRoutes({ home: '/', item: '/item/:id' });
function fixture(dispatch = () => {}, options = {}) {
  const history = createMemoryHistory('https://example.test/');
  const router = createRouter({ routes, history, dispatch, ...options });
  onTestFinished(() => router.dispose());
  return { router, history };
}

test('route grammar rejects unsupported patterns and builds parameterless destinations', () => {
  for (const path of ['relative', '/optional/:id?', '/files/*', '/./item', '/../item']) {
    assert.throws(() => createRoutes({ item: path }), TypeError);
  }
  assert.equal(routes.href({ name: 'home' }), '/');
  assert.equal(routes.match('/item/'), null);
  assert.throws(() => routes.href({ name: 'absent' }), TypeError);
});

test('native history adopts null state, reuses owned keys, and rejects incompatible host state', () => {
  const calls = [];
  const host = {
    location: { href: 'https://example.test/' },
    history: {
      state: null,
      replaceState(state, title, href) { this.state = state; host.location.href = href; calls.push('replace'); },
      pushState(state, title, href) { this.state = state; host.location.href = href; calls.push('push'); },
      go(delta) { calls.push(delta); },
    },
  };
  const first = createBrowserHistory(host);
  const key = first.read().key;
  const second = createBrowserHistory(host);
  assert.equal(second.read().key, key);
  assert.deepEqual(calls, ['replace']);
  second.go(-1);
  assert.equal(calls.at(-1), -1);
  host.history.state = {};
  first.write('https://example.test/replaced', { replace: true });
  assert.notEqual(first.read().key, null);
  for (const state of [3, [], new Date()]) {
    host.history.state = state;
    assert.throws(() => createBrowserHistory(host), TypeError);
  }
});

test('start is idempotent and an ended owner makes all navigation inert', async() => {
  const { router, history } = fixture();
  await router.start();
  assert.equal((await router.start()).status, 'unchanged');
  assert.equal(history.inspect().subscriptions, 1);
  router.dispose();
  assert.equal((await router.start()).status, 'disposed');
  assert.equal((await router.refresh()).status, 'disposed');
  router.go(-1);
  assert.equal(history.inspect().subscriptions, 0);
  const controller = new AbortController();
  controller.abort();
  const ended = fixture(() => assert.fail('ended owner dispatched'), { signal: controller.signal });
  assert.equal((await ended.router.start()).status, 'disposed');
  assert.equal(ended.history.inspect().subscriptions, 0);
});

test('equal-URL state updates preserve identity and yield to synchronous host redirects', async() => {
  const seen = [];
  const { router, history } = fixture(context => seen.push(context));
  await router.start();
  const href = router.location.href;
  const key = router.location.key;
  assert.equal((await router.navigate(href, { state: { selected: 'one' } })).status, 'handled');
  assert.equal(router.location.key, key);
  assert.deepEqual(router.location.state, { selected: 'one' });
  const write = history.write;
  history.write = (destination, options) => {
    const entry = write(destination, options);
    if (options.state?.redirect) { void router.navigate({ name: 'item', params: { id: 'next' } }); }
    return entry;
  };
  assert.equal((await router.navigate(href, { state: { redirect: true } })).status, 'superseded');
  assert.equal(seen.at(-1).match.params.id, 'next');
});
