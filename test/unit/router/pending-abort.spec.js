import assert from 'node:assert/strict';
import { it } from 'vitest';
import { Application } from 'marionette';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

it('does not commit an obsolete request reentered before the Router listener', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  const handled = [];
  let newer;
  driver.addEventListener('navigate', event => {
    if (new URL(event.destination.url).pathname === '/b') { newer = router.navigate('c'); }
  });
  const router = createRouter({ driver, routes: { '/b': { name: 'b' }, '/c': { name: 'c' } }, handler(match) { handled.push(match.name); } });
  await router.start(); await router.getInitialDispatch();
  const b = router.navigate('b');
  assert.equal(await b.committed, false);
  assert.equal(await b.finished, false);
  assert.equal(await newer.finished, true);
  assert.deepEqual(handled, ['c']);
  assert.equal(driver.currentEntry.url, 'https://routes.example/c');
});

it('does not let an already-aborted Driver event invalidate queued work', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  let direct;
  let queued;
  driver.addEventListener('navigate', event => {
    if (new URL(event.destination.url).pathname === '/b') { direct = driver.navigate('/d'); }
  });
  const work = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const router = createRouter({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' }, '/d': { name: 'd' } }, handler(match) {
    if (match.name === 'a') {
      match.signal.addEventListener('abort', () => { queued = router.navigate('c'); }, { once: true });
      entered.resolve(); return work.promise;
    }
  } });
  await router.start(); await router.getInitialDispatch();
  const a = router.navigate('a'); await entered.promise;
  const b = router.navigate('b');
  // This mixed raw-call stack has no promised D-versus-C winner. Its already
  // aborted B notification must still leave the queued operation observable.
  await direct.finished.catch(() => {});
  assert.deepEqual(await Promise.all([a.finished, b.finished, queued.finished]), [false, false, true]);
  assert.equal(router.getCurrent().name, 'c');
  assert.equal(router.getCurrent().signal.aborted, false);
  work.resolve();
});

it('lets a later live hash navigation supersede queued work while staying native', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  const work = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const handled = [];
  let queued;
  const router = createRouter({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' } }, handler(match) {
    handled.push(match.name);
    if (match.name === 'a') {
      match.signal.addEventListener('abort', () => { queued = router.navigate('c'); }, { once: true });
      entered.resolve(); return work.promise;
    }
  } });
  await router.start(); await router.getInitialDispatch();
  const a = router.navigate('a'); await entered.promise;
  const b = router.navigate('b');
  const fragment = driver.navigate('/a#details');
  assert.deepEqual(await Promise.all([a.finished, b.finished, queued.finished, fragment.finished.then(() => true)]), [false, false, false, true]);
  assert.equal(driver.currentEntry.url, 'https://routes.example/a#details');
  assert.deepEqual(handled, ['a']);
  work.resolve();
});

for (const initial of [false, true]) {
  it(`lets a later Driver event supersede deferred work after ${initial ? 'initial' : 'intercepted'} preparation`, async() => {
    const driver = memoryDriver({ url: `https://routes.example/${initial ? 'a' : 'outside'}` });
    const work = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const handled = [];
    let newer;
    const router = createRouter({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' }, '/d': { name: 'd' } }, handler(match) {
      handled.push(match.name);
      if (match.name === 'a') {
        match.signal.addEventListener('abort', () => { newer = router.navigate('c'); }, { once: true });
        entered.resolve(); return work.promise;
      }
    } });
    await router.start();
    const a = initial ? router.getInitialDispatch().then(result => result.status) : router.navigate('a').finished;
    await entered.promise;
    const b = router.navigate('b');
    const latest = driver.navigate('/d');
    assert.deepEqual(await Promise.all([a, b.finished, newer.finished, latest.finished.then(() => true, () => false)]),
      [initial ? 'cancelled' : false, false, false, true]);
    assert.equal(router.getCurrent().name, 'd');
    assert.deepEqual(handled, ['a', 'd']);
    work.resolve();
  });

  it(`intercepts canceled work on a noncancelable event during ${initial ? 'initial' : 'intercepted'} preparation`, async() => {
    const memory = memoryDriver({ url: `https://routes.example/${initial ? 'a' : 'outside'}` });
    // Native same-document traversal can be intercepted but not preventDefault'd.
    const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, addEventListener(type, listener, options) {
      memory.addEventListener(type, event => listener({ ...event, cancelable: false,
        get defaultPrevented() { return event.defaultPrevented; },
        preventDefault() { throw new Error('Noncancelable navigation cannot be vetoed'); },
      }), options);
    } };
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const handled = [];
    let newer;
    const router = createRouter({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' } }, handler(match) {
      handled.push(match.name);
      if (match.name === 'a') {
        match.signal.addEventListener('abort', () => { newer = router.navigate('c'); }, { once: true });
        entered.resolve(); return work.promise;
      }
    } });
    await router.start();
    const a = initial ? router.getInitialDispatch().then(result => result.status) : router.navigate('a').finished;
    await entered.promise;
    const b = router.navigate('b');
    assert.deepEqual(await Promise.all([a, b.finished, newer.finished]), [initial ? 'cancelled' : false, false, true]);
    assert.deepEqual(handled, ['a', 'c']);
    assert.deepEqual(memory.documentNavigations, []);
    work.resolve();
  });
}

it('lets queued public intent supersede refresh preflight before a DriverEvent exists', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  const entered = Promise.withResolvers();
  const work = Promise.withResolvers();
  const handled = [];
  let first = true;
  let enabled = false;
  let newer;
  let refreshing;
  const router = createRouter({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' } },
    owns(url) {
      if (enabled && url.pathname === '/a') { enabled = false; newer = router.navigate('c'); }
      return true;
    }, handler(match) {
      handled.push(match.name);
      if (match.name === 'a' && first) {
        first = false;
        match.signal.addEventListener('abort', () => { refreshing = router.refresh(); }, { once: true });
        entered.resolve(); return work.promise;
      }
    } });
  await router.start(); await router.getInitialDispatch();
  const a = router.navigate('a'); await entered.promise;
  enabled = true;
  const b = router.navigate('b');
  assert.deepEqual(await Promise.all([a.finished, b.finished, newer.finished, refreshing]), [false, false, true, false]);
  assert.equal(router.getCurrent().name, 'c');
  assert.deepEqual(handled, ['a', 'c']);
  work.resolve();
});

it('does not execute queued work superseded by coalesced Back callers', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/home' });
  const entered = Promise.withResolvers();
  const work = Promise.withResolvers();
  const handled = [];
  let newer;
  const router = createRouter({ driver, routes: { '/home': { name: 'home' }, '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' } },
    handler(match) {
      handled.push(match.name);
      if (match.name === 'a') {
        match.signal.addEventListener('abort', () => { newer = router.navigate('c'); }, { once: true });
        entered.resolve(); return work.promise;
      }
    } });
  await router.start(); await router.getInitialDispatch();
  const a = router.navigate('a'); await entered.promise;
  const b = router.navigate('b');
  const one = router.back(); const two = router.back();
  assert.deepEqual(await Promise.all([a.finished, b.finished, newer.finished, one, two]), [false, false, false, true, true]);
  assert.deepEqual(handled, ['home', 'a', 'home']);
  work.resolve();
});

it('keeps a queued destination when the outgoing feature retires its registration', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  const entered = Promise.withResolvers();
  const work = Promise.withResolvers();
  let newer;
  const router = createRouter({ driver, routes: { '/b': { name: 'b' }, '/c': { name: 'c' } } });
  const feature = router.addChildApp('feature', new Application());
  router.mount({ '/a': { name: 'a', handler(match) {
    match.signal.addEventListener('abort', () => { newer = router.navigate('c'); feature.destroy(); }, { once: true });
    entered.resolve(); return work.promise;
  } } }, { owner: feature });
  await router.start(); await router.getInitialDispatch();
  const a = router.navigate('a'); await entered.promise;
  const b = router.navigate('b');
  assert.deepEqual(await Promise.all([a.finished, b.finished, newer.finished]), [false, false, true]);
  assert.equal(router.hasRoute('a'), false);
  assert.equal(router.getCurrent().name, 'c');
  work.resolve();
});

for (const outcome of ['ready', 'error', 'abort-error', 'stop', 'last-caller', 'driver-error']) {
  it(`keeps pending-abort navigation authoritative with ${outcome}`, async() => {
    const memory = memoryDriver({ url: 'https://routes.example/outside' });
    const failure = outcome === 'abort-error' ? new DOMException('independent fetch abort', 'AbortError') : new Error('newer failure');
    const driver = { ...memory, get currentEntry() { return memory.currentEntry; }, navigate(url, options) {
      if (outcome === 'driver-error' && new URL(url, memory.currentEntry.url).pathname === '/c') { throw failure; }
      return memory.navigate(url, options);
    } };
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const handled = [];
    const errors = [];
    let newer;
    let latest;
    const info = { origin: 'abort-listener' };
    const router = createRouter({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' }, '/d': { name: 'd' } },
      handler(match) {
        handled.push(match.name);
        if (match.name === 'a') {
          match.signal.addEventListener('abort', () => {
            newer = router.navigate('c', {}, { info });
            if (outcome === 'last-caller') { latest = router.navigate('d'); }
          }, { once: true });
          entered.resolve(); return work.promise;
        }
        if (match.name === 'c' && (outcome === 'error' || outcome === 'abort-error')) { throw failure; }
      } });
    router.on('route:error', (error, match, context) => errors.push({ error, name: match.name, info: context.info }));
    await router.start(); await router.getInitialDispatch();
    const a = router.navigate('a'); await entered.promise;
    const b = router.navigate('b');
    if (outcome === 'stop') { router.stop(); }
    assert.equal(await a.finished, false);
    assert.equal(await b.finished, false);
    if (outcome.endsWith('error')) {
      if (outcome === 'driver-error') { await assert.rejects(newer.committed, error => error === failure); } else { assert.equal(await newer.committed, true); }
      await assert.rejects(newer.finished, error => error === failure);
      assert.deepEqual(errors, outcome === 'driver-error' ? [] : [{ error: failure, name: 'c', info }]);
    } else {
      assert.equal(await newer.finished, outcome === 'ready');
      if (latest) { assert.equal(await latest.finished, true); }
      assert.deepEqual(errors, []);
    }
    assert.deepEqual(handled, ['a', ...(outcome === 'stop' || outcome === 'driver-error' ? [] : [outcome === 'last-caller' ? 'd' : 'c'])]);
    assert.deepEqual(memory.documentNavigations, []);
    if (outcome !== 'stop' && outcome !== 'driver-error') {
      assert.equal(router.getCurrent().name, latest ? 'd' : 'c');
      assert.equal(router.getCurrent().signal.aborted, false);
    }
    work.reject(new Error('obsolete a work'));
  });
}
