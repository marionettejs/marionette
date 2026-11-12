import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { it } from 'vitest';
import { memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

// Observe the native DriverEvent boundary without host-level thrown errors in
// unit tests. The real browser suite verifies the corresponding exception.
function nativeBoundary(memory, invalid) {
  return { ...memory, get currentEntry() { return memory.currentEntry; }, addEventListener(type, listener, options) {
    memory.addEventListener(type, event => listener({
      ...event,
      get defaultPrevented() { return event.defaultPrevented; },
      intercept(settings) {
        if (event.signal.aborted || event.defaultPrevented) { invalid.push(event.destination.url); return; }
        event.intercept(settings);
      },
    }), options);
  } };
}

it('rejects interception of a synchronously superseded memory DriverEvent like native', async() => {
  const driver = memoryDriver({ url: 'https://routes.example/home' });
  let newer;
  let failure;
  driver.addEventListener('navigate', event => {
    if (new URL(event.destination.url).pathname === '/source') {
      newer = driver.navigate('/next');
      try { event.intercept(); } catch (error) { failure = error; }
    } else { event.intercept(); }
  });
  await assert.rejects(driver.navigate('/source').finished, { name: 'AbortError' });
  await newer.finished;
  assert.equal(failure?.name, 'InvalidStateError');
});

for (const phase of ['redirect', 'owns-matched', 'owns-missing']) {
  for (const outcome of ['ready', 'failed', 'stopped']) {
    it(`preserves the newer ${outcome} navigation from synchronous ${phase} planning`, async() => {
      const invalid = [];
      const handlers = [];
      const errors = [];
      const failure = new DOMException('independent newer request', 'AbortError');
      const memory = memoryDriver({ url: 'https://routes.example/home' });
      let router;
      let newer;
      const reenter = () => { newer = router.navigate('/next'); };
      router = createRouter({ driver: nativeBoundary(memory, invalid), routes: {
        '/home': { name: 'home' }, '/next': { name: 'next' },
        ...(phase === 'owns-missing' ? {} : { '/source': { name: 'source', redirect: phase === 'redirect' ? reenter : undefined } }),
      }, owns(url) { if (phase.startsWith('owns') && url.pathname === '/source') { reenter(); } return true; },
      notFound: 'missing',
      handler(match) {
        handlers.push(match.name);
        if (match.name === 'next' && outcome === 'failed') { throw failure; }
        if (match.name === 'next' && outcome === 'stopped') { router.stop(); }
      } });
      router.on('route:error', (error, match) => errors.push([error, match.name]));
      await router.start(); await router.getInitialDispatch();
      const obsolete = router.navigate('/source');
      assert.equal(await obsolete.finished, false);
      assert.equal(await newer.committed, true);
      if (outcome === 'failed') {
        await assert.rejects(newer.finished, error => error === failure);
        assert.deepEqual(errors, [[failure, 'next']]);
        assert.equal(router.getCurrent().signal.aborted, false);
      } else {
        assert.equal(await newer.finished, outcome === 'ready');
        assert.deepEqual(errors, []);
      }
      assert.equal(router.getCurrent().name, 'next');
      assert.equal(memory.currentEntry.url, 'https://routes.example/next');
      assert.deepEqual(handlers, ['home', 'next']);
      assert.deepEqual(invalid, []);
    });
  }

  it(`claims a navigation canceled by Router stop during ${phase} planning without document fallback`, async() => {
    const invalid = [];
    const handlers = [];
    const memory = memoryDriver({ url: 'https://routes.example/home' });
    let router;
    const stop = () => { router.stop(); };
    router = createRouter({ driver: nativeBoundary(memory, invalid), routes: {
      '/home': { name: 'home' },
      ...(phase === 'owns-missing' ? {} : { '/source': { name: 'source', redirect: phase === 'redirect' ? stop : undefined } }),
    }, owns(url) { if (phase.startsWith('owns') && url.pathname === '/source') { stop(); } return true; },
    notFound: 'missing',
    handler(match) { handlers.push(match.name); } });
    await router.start(); await router.getInitialDispatch();
    assert.equal(await router.navigate('/source').finished, false);
    assert.equal(router.isRunning(), false);
    assert.equal(memory.currentEntry.url, 'https://routes.example/source');
    assert.deepEqual(memory.documentNavigations, []);
    assert.deepEqual(handlers, ['home']);
    assert.deepEqual(invalid, []);
  });
}

it('rechecks driver authority after aborting initial work whose abort callback navigates', async() => {
  const invalid = [];
  const memory = memoryDriver({ url: 'https://routes.example/home' });
  const initialWork = Promise.withResolvers();
  const handlers = [];
  let newer;
  const router = createRouter({ driver: nativeBoundary(memory, invalid), routes: {
    '/home': { name: 'home' }, '/source': { name: 'source' }, '/next': { name: 'next' },
  }, handler(match) {
    handlers.push(match.name);
    if (match.name === 'home') {
      match.signal.addEventListener('abort', () => { newer = router.navigate('/next'); }, { once: true });
      return initialWork.promise;
    }
  } });
  await router.start();
  const initial = router.getInitialDispatch();
  assert.equal(await router.navigate('/source').finished, false);
  assert.equal(await newer.finished, true);
  assert.deepEqual(await initial, { status: 'cancelled' });
  initialWork.reject(new Error('obsolete initial request'));
  await turn();
  assert.deepEqual(handlers, ['home', 'next']);
  assert.deepEqual(invalid, []);
});

for (const phase of ['redirect-hop', 'redirect-continue', 'owns-matched', 'owns-missing']) {
  it(`does not execute cancelled initial ${phase} planning after a newer navigation`, async() => {
    const memory = memoryDriver({ url: 'https://routes.example/source' });
    const handlers = [];
    let router;
    let newer;
    const reenter = () => { newer = router.navigate('/next'); };
    router = createRouter({ driver: memory, routes: {
      '/next': { name: 'next' }, '/stale': { name: 'stale' },
      ...(phase === 'owns-missing' ? {} : { '/source': { name: 'source', redirect: phase.startsWith('redirect') ? () => {
        reenter(); return phase === 'redirect-hop' ? '/stale' : undefined;
      } : undefined } }),
    }, owns(url) { if (phase.startsWith('owns') && url.pathname === '/source') { reenter(); } return true; },
    notFound: 'missing',
    handler(match) { handlers.push(match.name); } });
    await router.start();
    assert.deepEqual(await router.getInitialDispatch(), { status: 'cancelled' });
    assert.equal(await newer.finished, true);
    assert.deepEqual(handlers, ['next']);
    assert.equal(router.getCurrent().name, 'next');
    assert.equal(router.getCurrent().signal.aborted, false);
    assert.equal(memory.currentEntry.url, 'https://routes.example/next');
  });
}

it('retiring a planned registration still cancels initial work without document fallback', async() => {
  const work = Promise.withResolvers();
  const invalid = [];
  const memory = memoryDriver({ url: 'https://routes.example/home' });
  const handlers = [];
  const router = createRouter({ driver: nativeBoundary(memory, invalid), routes: {
    '/home': { name: 'home' },
  }, handler(match) { handlers.push(match.name); return work.promise; } });
  await router.start();
  const initial = router.getInitialDispatch();
  const unmount = router.mount({ '/source': { name: 'source', redirect() { unmount(); } } });
  assert.equal(await router.navigate('/source').finished, false);
  assert.deepEqual(await initial, { status: 'cancelled' });
  assert.equal(memory.currentEntry.url, 'https://routes.example/source');
  assert.deepEqual(memory.documentNavigations, []);
  assert.deepEqual(handlers, ['home']);
  assert.deepEqual(invalid, []);
  work.reject(new Error('obsolete initial request'));
  await turn();
});
