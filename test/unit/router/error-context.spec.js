import assert from 'node:assert/strict';
import { it } from 'vitest';
import { Router, memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const origin = 'https://errors.example';

it('adds originating info without changing existing error, Match, hook or listener arguments', async() => {
  const error = new Error('request failed');
  const info = { caller: {} };
  const hooks = [];
  const oldListeners = [];
  const events = [];
  const Routes = Router.extend({ onRouteError(...args) { hooks.push(args); } });
  const router = new Routes({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
    home: { path: '/home' }, fail: { path: '/fail', handler() { throw error; } },
  } });
  router.on('route:error', (reason, match) => oldListeners.push([reason, match]));
  router.on('route:error', (...args) => events.push(args));
  try {
    await router.start(); await router.getInitialDispatch();
    await assert.rejects(router.navigate('fail', {}, { info }).finished, reason => reason === error);
    const match = router.getCurrent();
    assert.deepEqual(oldListeners, [[error, match]]);
    assert.equal(hooks.length, 1);
    assert.deepEqual(events, hooks);
    assert.equal(events[0][2].info, info);
    assert.equal(match.info, info);
  } finally { router.destroy(); }
});

it('exposes info for planning failure without a Match', async() => {
  const error = new Error('policy failed');
  const info = { caller: {} };
  const events = [];
  const router = createRouter({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
    home: { path: '/home' }, fail: { path: '/fail' },
  }, intercept(url) { if (url.pathname === '/fail') { throw error; } return true; } });
  router.on('route:error', (...args) => events.push(args));
  await router.start(); await router.getInitialDispatch();
  await assert.rejects(router.navigate('fail', {}, { info }).finished, reason => reason === error);
  assert.equal(events.length, 1);
  assert.equal(events[0][0], error);
  assert.equal(events[0][1], null);
  assert.equal(events[0][2].info, info);
});

for (const asynchronous of [false, true]) {
  for (const beforeMatch of [false, true]) {
    it(`preserves info through ${asynchronous ? 'async' : 'sync'} redirects to ${beforeMatch ? 'planning' : 'handler'} failure`, async() => {
      const error = new DOMException('independent request failed', 'AbortError');
      const info = { caller: {} };
      const events = [];
      const router = createRouter({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
        home: { path: '/home' },
        old: { path: '/old', redirect: () => asynchronous ? Promise.resolve('/middle') : '/middle' },
        middle: { path: '/middle', redirect: () => ({ name: 'fail', hash: '#details' }) },
        fail: { path: '/fail', handler() { throw error; } },
      }, intercept(url) { if (beforeMatch && url.pathname === '/fail') { throw error; } return true; } });
      router.on('route:error', (...args) => events.push(args));
      await router.start(); await router.getInitialDispatch();
      await assert.rejects(router.navigate('old', {}, { info }).finished, reason => reason === error);
      assert.equal(events.length, 1);
      assert.equal(events[0][0], error);
      assert.equal(events[0][1]?.name ?? null, beforeMatch ? null : 'fail');
      assert.equal(events[0][2].info, info);
    });
  }
}

it('keeps per-attempt info through synchronous error-hook reentry with a shared Error', async() => {
  const shared = new Error('same error instance');
  const firstInfo = { caller: 'first' };
  const secondInfo = { caller: 'second' };
  const hooks = [];
  const events = [];
  let second;
  const Routes = Router.extend({ onRouteError(error, match, context) {
    hooks.push([error, match, context]);
    if (hooks.length === 1) { second = this.navigate('second', {}, { info: secondInfo }); }
  } });
  const router = new Routes({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
    home: { path: '/home' }, first: { path: '/first' }, second: { path: '/second', handler() { throw shared; } },
  }, intercept(url) { if (url.pathname === '/first') { throw shared; } return true; } });
  router.on('route:error', (...args) => events.push(args));
  try {
    await router.start(); await router.getInitialDispatch();
    const first = router.navigate('first', {}, { info: firstInfo });
    assert.equal(await first.finished, false, 'Reentry still cancels the first driver transition');
    await assert.rejects(second.finished, reason => reason === shared);
    assert.equal(events.length, 2);
    assert.equal(events[0][0], shared); assert.equal(events[1][0], shared);
    assert.equal(events[0][1], null); assert.equal(events[1][1].name, 'second');
    assert.equal(events[0][2].info, firstInfo); assert.equal(events[1][2].info, secondInfo);
    assert.notEqual(events[0][2], events[1][2]);
    assert.deepEqual(hooks, events);
  } finally { router.destroy(); }
});

for (const operation of ['initial', 'refresh']) {
  for (const beforeMatch of [false, true]) {
    it(`uses undefined info for ${operation} ${beforeMatch ? 'planning' : 'handler'} failure`, async() => {
      const error = new Error('failed');
      let failing = operation === 'initial';
      const events = [];
      const router = createRouter({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
        home: { path: '/home', handler() { if (failing && !beforeMatch) { throw error; } } },
      }, intercept() { if (failing && beforeMatch) { throw error; } return true; } });
      router.on('route:error', (...args) => events.push(args));
      await router.start();
      if (operation === 'initial') {
        const result = await router.getInitialDispatch();
        assert.equal(result.status, 'failed'); assert.equal(result.error, error);
      } else {
        await router.getInitialDispatch();
        await router.navigate('home', {}, { info: { previous: true } }).finished;
        failing = true;
        await assert.rejects(router.refresh(), reason => reason === error);
      }
      assert.equal(events.length, 1);
      assert.equal(events[0][0], error);
      assert.equal(events[0][1]?.name ?? null, beforeMatch ? null : 'home');
      assert.deepEqual(events[0][2], { info: undefined });
    });
  }
}

for (const mode of ['throw', 'reject']) {
  it(`does not emit route:error for a driver-only ${mode} failure`, async() => {
    const memory = memoryDriver({ url: `${origin}/home` });
    const error = new Error('driver failed before dispatch');
    const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, navigate() {
      if (mode === 'throw') { throw error; }
      return { committed: Promise.reject(error), finished: Promise.reject(error) };
    } };
    const events = [];
    const router = createRouter({ driver, routes: { home: { path: '/home' } } });
    router.on('route:error', (...args) => events.push(args));
    await router.start(); await router.getInitialDispatch();
    if (mode === 'throw') { assert.throws(() => router.navigate('home', {}, { info: {} }), reason => reason === error); } else {
      const result = router.navigate('home', {}, { info: {} });
      await assert.rejects(result.committed, reason => reason === error);
      await assert.rejects(result.finished, reason => reason === error);
    }
    assert.deepEqual(events, []);
  });
}

it('does not report abandoned route work after cancellation', async() => {
  const entered = Promise.withResolvers();
  const work = Promise.withResolvers();
  const events = [];
  const router = createRouter({ driver: memoryDriver({ url: `${origin}/home` }), routes: {
    home: { path: '/home' }, slow: { path: '/slow', handler() { entered.resolve(); return work.promise; } },
  } });
  router.on('route:error', (...args) => events.push(args));
  await router.start(); await router.getInitialDispatch();
  const pending = router.navigate('slow', {}, { info: {} }).finished;
  await entered.promise;
  await router.navigate('home').finished;
  assert.equal(await pending, false);
  work.reject(new Error('obsolete'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events, []);
});
