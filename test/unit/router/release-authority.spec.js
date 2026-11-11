import assert from 'node:assert/strict';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

it('settles initial cancellation when a driver state read stops the owner', async() => {
  const memory = memoryDriver({ url: 'https://routes.example/a' });
  let stopping = true;
  const driver = { ...memory, get currentEntry() {
    const entry = memory.currentEntry;
    return { ...entry, getState() {
      if (stopping) { stopping = false; router.stop(); }
      return entry.getState();
    } };
  } };
  const router = createRouter({ driver, routes: { a: { path: '/a' } } });
  await router.start();
  assert.deepEqual(await router.getInitialDispatch(), { status: 'cancelled' });
  assert.equal(router.isRunning(), false);
  await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'matched');
  assert.deepEqual(memory.documentNavigations, []);
});

for (const action of ['navigate', 'veto', 'prior-veto', 'stop']) {
  it(`does not dispatch a stale refresh after preflight ${action}`, async() => {
    const driver = memoryDriver({ url: 'https://routes.example/a' });
    const handled = [];
    let enabled = false;
    let newer;
    const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } },
      intercept(url) {
        if (enabled && url.pathname === '/a') {
          enabled = false;
          if (action === 'stop') { router.stop(); } else { newer = router.navigate('b'); }
        }
        return true;
      }, handler(match) { handled.push(match.name); } });
    if (action === 'prior-veto') {
      driver.addEventListener('navigate', event => { if (new URL(event.destination.url).pathname === '/b') { event.preventDefault(); } });
    }
    await router.start(); await router.getInitialDispatch();
    if (action === 'veto') {
      driver.addEventListener('navigate', event => { if (new URL(event.destination.url).pathname === '/b') { event.preventDefault(); } });
    }
    enabled = true;
    assert.equal(await router.refresh(), false);
    if (newer) { assert.equal(await newer.finished, action === 'navigate'); }
    assert.equal(driver.currentEntry.url, `https://routes.example/${action === 'navigate' ? 'b' : 'a'}`);
    assert.deepEqual(handled, action === 'navigate' ? ['a', 'b'] : ['a']);
    assert.deepEqual(driver.documentNavigations, []);
    assert.equal(router.isRunning(), action !== 'stop');
  });
}

for (const action of ['navigate', 'stop']) {
  it(`does not report an obsolete preflight error after ${action}`, async() => {
    const driver = memoryDriver({ url: 'https://routes.example/a' });
    let enabled = false;
    let newer;
    const errors = [];
    const failure = new Error('obsolete refresh policy');
    const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } }, intercept() {
      if (enabled) {
        enabled = false;
        if (action === 'stop') { router.stop(); } else { newer = router.navigate('b'); }
        throw failure;
      }
      return true;
    } });
    router.on('route:error', error => errors.push(error));
    await router.start(); await router.getInitialDispatch();
    enabled = true;
    assert.equal(await router.refresh(), false);
    if (newer) { assert.equal(await newer.finished, true); }
    assert.deepEqual(errors, []);
  });
}

it('keeps a navigation from an initial marking observer authoritative', async() => {
  const memory = memoryDriver({ url: 'https://routes.example/a' });
  let newer;
  let notify = true;
  const handled = [];
  const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, updateCurrentEntry(options) {
    memory.updateCurrentEntry(options);
    if (notify) { notify = false; newer = router.navigate('b'); }
  } };
  const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } },
    handler(match) { handled.push(match.name); } });
  await router.start();
  assert.deepEqual(await router.getInitialDispatch(), { status: 'cancelled' });
  assert.equal(await newer.finished, true);
  assert.equal(router.getCurrent().name, 'b');
  assert.equal(router.getCurrent().signal.aborted, false);
  assert.equal(memory.currentEntry.url, 'https://routes.example/b');
  assert.deepEqual(handled, ['b']);
});

it('does not overwrite a replacement match from a state-update observer', async() => {
  const memory = memoryDriver({ url: 'https://routes.example/a' });
  let notify = false;
  let newer;
  const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, updateCurrentEntry(options) {
    memory.updateCurrentEntry(options);
    if (notify) { notify = false; newer = router.navigate('b', {}, { history: 'replace', state: { resource: 'b' } }); }
  } };
  const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } } });
  await router.start(); await router.getInitialDispatch();
  notify = true;
  assert.equal(router.updateState({ tab: 'a' }), true);
  assert.equal(await newer.finished, true);
  assert.equal(router.getCurrent().name, 'b');
  assert.deepEqual(router.getCurrent().state, { resource: 'b' });
});

for (const matched of [true, false]) {
  it(`preserves ${matched ? 'owned' : 'unowned'} entry status against supplied reserved state`, async() => {
    const driver = memoryDriver({ url: `https://routes.example/${matched ? 'a' : 'outside'}` });
    const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } } });
    await router.start(); await router.getInitialDispatch();
    assert.equal(router.updateState({ '@mnjs/router': !matched, tab: 'details' }), true);
    if (matched) { assert.deepEqual(router.getCurrent().state, { tab: 'details' }); }
    await router.navigate('b').finished;
    assert.equal(router.canGoBack(), matched);
    assert.equal(await router.back(), matched);
    assert.equal(router.getCurrent().name, matched ? 'a' : 'b');
    if (matched) { assert.deepEqual(router.getCurrent().state, { tab: 'details' }); }
  });
}

for (const initial of [false, true]) {
  it(`reads the final stored state after a nested ${initial ? 'marking' : 'update'} observer`, async() => {
    const memory = memoryDriver({ url: 'https://routes.example/a' });
    let notify = initial;
    const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, updateCurrentEntry(options) {
      memory.updateCurrentEntry(options);
      if (notify) { notify = false; router.updateState({ fromObserver: true }); }
    } };
    const router = createRouter({ driver, routes: { a: { path: '/a' } } });
    await router.start(); await router.getInitialDispatch();
    if (!initial) { notify = true; router.updateState({ outer: true }); }
    assert.deepEqual(router.getCurrent().state, initial ? { fromObserver: true } : { outer: true, fromObserver: true });
  });
}

for (const action of ['navigate', 'stop']) {
  it(`abandons refresh after a successful state read reenters ${action}`, async() => {
    const memory = memoryDriver({ url: 'https://routes.example/a' });
    let notify = false;
    let newer;
    const driver = { ...memory, get currentEntry() {
      const entry = memory.currentEntry;
      return { ...entry, getState() {
        if (notify) {
          notify = false;
          if (action === 'stop') { router.stop(); } else { newer = router.navigate('b'); }
        }
        return entry.getState();
      } };
    } };
    const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } } });
    await router.start(); await router.getInitialDispatch();
    notify = true;
    assert.equal(await router.refresh(), false);
    if (newer) { assert.equal(await newer.finished, true); assert.equal(router.getCurrent().name, 'b'); }
    assert.deepEqual(memory.documentNavigations, []);
  });
}

for (const phase of ['mark', 'update', 'refresh']) {
  it(`skips obsolete entry reads after ${phase} already navigated elsewhere`, async() => {
    const memory = memoryDriver({ url: 'https://routes.example/a' });
    let enabled = phase === 'mark';
    let armed = false;
    let newer;
    let stale;
    const driver = { ...memory, get currentEntry() {
      const entry = memory.currentEntry;
      return { ...entry, getState() {
        if (armed && entry.url.endsWith('/a')) { armed = false; stale = router.navigate('c'); }
        return entry.getState();
      } };
    }, updateCurrentEntry(options) {
      memory.updateCurrentEntry(options);
      if (enabled && phase !== 'refresh') { enabled = false; newer = router.navigate('b'); armed = true; }
    } };
    const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' } }, intercept() {
      if (enabled && phase === 'refresh') { enabled = false; newer = router.navigate('b'); armed = true; }
      return true;
    } });
    await router.start(); await router.getInitialDispatch();
    if (phase !== 'mark') {
      enabled = true;
      if (phase === 'refresh') { assert.equal(await router.refresh(), false); } else { router.updateState({ outer: true }); }
    }
    assert.equal(await newer.finished, true);
    assert.equal(stale, undefined);
    assert.equal(router.getCurrent().name, 'b');
  });
}

it('does not overwrite a newer match when the final state read navigates', async() => {
  const memory = memoryDriver({ url: 'https://routes.example/a' });
  let enabled = false;
  let reading = false;
  let newer;
  const driver = { ...memory, get currentEntry() {
    const entry = memory.currentEntry;
    return { ...entry, getState() {
      if (reading) { reading = false; newer = router.navigate('b', {}, { state: { page: 'b' } }); }
      return entry.getState();
    } };
  }, updateCurrentEntry(options) { memory.updateCurrentEntry(options); if (enabled) { enabled = false; reading = true; } } };
  const router = createRouter({ driver, routes: { a: { path: '/a' }, b: { path: '/b' } } });
  await router.start(); await router.getInitialDispatch(); enabled = true;
  router.updateState({ outer: true });
  assert.equal(await newer.finished, true);
  assert.equal(router.getCurrent().name, 'b');
  assert.deepEqual(router.getCurrent().state, { page: 'b' });
});
