import { afterEach, it } from 'vitest';
import assert from 'node:assert/strict';
import { Router, memoryDriver } from '@mnjs/router';

const owned = new Set();
function routerFor(options = {}) {
  const router = new Router({ driver: memoryDriver({ url: 'https://routes.example/initial' }), ...options });
  owned.add(router);
  return router;
}
afterEach(() => {
  for (const router of owned) {router.destroy();}
  owned.clear();
});

it('exposes initial matched readiness separately from running and publishes the promise before route notifications', async() => {
  const work = Promise.withResolvers();
  let calls = 0;
  const router = routerFor({ routes: { initial: { path: '/initial', handler() {calls++; return work.promise;} } } });
  assert.equal(router.getInitialDispatch(), null);
  let observed;
  router.on('route', () => {observed = router.getInitialDispatch();});
  assert.equal(await router.start(), true);
  const pending = router.getInitialDispatch();
  assert.equal(observed, pending);
  assert.equal(router.isRunning(), true);
  let settled = false;
  pending.then(() => {settled = true;});
  await Promise.resolve();
  assert.equal(settled, false);
  work.resolve();
  const result = await pending;
  assert.equal(result.status, 'matched');
  assert.equal(result.match, router.getCurrent());
  assert.equal(result.match.initial, true);
  await router.restart();
  assert.equal(router.getInitialDispatch(), pending);
  assert.equal(calls, 1);
  router.stop();
  await router.start();
  assert.notEqual(router.getInitialDispatch(), pending);
  assert.equal((await router.getInitialDispatch()).status, 'matched');
  assert.equal(calls, 2);
});

it('reports an unmatched initial URL while keeping routing enabled', async() => {
  const router = routerFor();
  await router.start();
  assert.deepEqual(await router.getInitialDispatch(), { status: 'unmatched' });
  assert.equal(router.isRunning(), true);
  assert.equal(router.getCurrent(), null);
});

for (const cancel of ['stop', 'destroy', 'supersede', 'unmount']) {
  it(`reports cancelled initial work promptly on ${ cancel } without awaiting ignored consumer work`, async() => {
    const work = Promise.withResolvers();
    const router = routerFor({ routes: { latest: { path: '/latest' } } });
    const unmount = router.mount({ initial: { path: '/initial', handler() {return work.promise;} } });
    const ready = [];
    router.on('route:ready', match => ready.push(match.name));
    await router.start();
    const initial = router.getInitialDispatch();
    if (cancel === 'supersede') {await router.navigate('latest').finished;} else if (cancel === 'unmount') {unmount();} else {router[cancel]();}
    assert.deepEqual(await initial, { status: 'cancelled' });
    work.resolve();
    await work.promise;
    assert.deepEqual(ready, cancel === 'supersede' ? ['latest'] : []);
  });
}

for (const phase of ['planning', 'handler', 'ready']) {
  it(`reports failed initial ${ phase } work without rejecting the outcome or disabling routing`, async() => {
    const failure = new Error('initial failed');
    const router = routerFor({ routes: { initial: { path: '/initial' } },
      intercept() {if (phase === 'planning') {throw failure;} return true;},
      handler() {if (phase === 'handler') {throw failure;}},
    });
    if (phase === 'ready') {router.on('route:ready', () => {throw failure;});}
    const errors = [];
    router.on('route:error', error => errors.push(error));
    assert.equal(await router.start(), true);
    const result = await router.getInitialDispatch();
    assert.equal(result.status, 'failed');
    assert.equal(result.error, failure);
    assert.equal(result.match, phase === 'planning' ? null : router.getCurrent());
    assert.deepEqual(errors, [failure]);
    assert.equal(router.isRunning(), true);
  });
}

for (const asynchronous of [false, true]) {
  for (const destination of ['matched', 'unmatched', 'failed', 'cancelled']) {
    it(`follows ${ asynchronous ? 'asynchronous' : 'synchronous' } initial redirects to the ${ destination } outcome`, async() => {
      const failure = new Error('redirect destination failed');
      const entered = Promise.withResolvers();
      const work = Promise.withResolvers();
      const target = { name: 'final' };
      const router = routerFor({ routes: {
        initial: { path: '/initial', redirect: () => asynchronous ? Promise.resolve(target) : target },
        final: { path: '/final', async handler() {
          entered.resolve();
          if (destination === 'failed') {throw failure;}
          if (destination === 'cancelled') {await work.promise;}
        } },
      }, intercept: url => !(destination === 'unmatched' && url.pathname === '/final') });
      await router.start();
      const initial = router.getInitialDispatch();
      if (destination === 'cancelled') {
        await entered.promise;
        router.stop();
      }
      const result = await initial;
      assert.equal(result.status, destination);
      if (destination === 'matched') {assert.equal(result.match.name, 'final');}
      if (destination === 'failed') {assert.equal(result.error, failure); assert.equal(result.match.name, 'final');}
      work.resolve();
    });
  }
}

it('reports a synchronous driver setup failure while ordinary Application start still rejects', async() => {
  const failure = new Error('cannot bind');
  const driver = memoryDriver({ url: 'https://routes.example/initial' });
  const router = routerFor({ driver: { ...driver, addEventListener() {throw failure;} } });
  await assert.rejects(router.start(), error => error === failure);
  assert.deepEqual(await router.getInitialDispatch(), { status: 'failed', error: failure, match: null });
  assert.equal(router.isRunning(), false);
});

it('reports an explicit notFound handler as matched', async() => {
  const router = routerFor({ notFound: { name: 'notFound', within: () => true } });
  await router.start();
  const result = await router.getInitialDispatch();
  assert.equal(result.status, 'matched');
  assert.equal(result.match.name, 'notFound');
});

it('creates no initial dispatch when Application preparation fails before activation', async() => {
  const failure = new Error('preparation failed');
  const Prepared = Router.extend({ prepareStart() {throw failure;} });
  const router = new Prepared({ driver: memoryDriver({ url: 'https://routes.example/initial' }) });
  owned.add(router);
  await assert.rejects(router.start(), error => error === failure);
  assert.equal(router.getInitialDispatch(), null);
  assert.equal(router.isRunning(), false);
});
