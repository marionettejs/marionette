import { afterEach, it } from 'vitest';
import assert from 'node:assert/strict';
import { Application } from 'marionette';
import { Router, RouteApplication, ChildAppSwitcher, memoryDriver } from '@mnjs/router';

const owned = new Set();
const own = value => { owned.add(value); return value; };
const gate = () => Promise.withResolvers();
const routerFor = (options = {}) => own(new Router({ driver: memoryDriver({ url: 'https://routes.example/outside' }), ...options }));

// A conforming driver may commit and schedule its intercepted handler later.
function heldDriver(path) {
  const dispatch = gate();
  const driver = memoryDriver({ url: 'https://routes.example/outside' });
  return { dispatch, driver: { ...driver,
    get currentEntry() {return driver.currentEntry;},
    addEventListener(type, listener, options) {
      driver.addEventListener(type, event => listener({ ...event,
        intercept(policy) {
          event.intercept({ ...policy, handler: async() => {
            if (new URL(event.destination.url).pathname === path) {await dispatch.promise;}
            return policy.handler();
          } });
        },
      }), options);
    },
  } };
}

afterEach(() => {
  for (const value of owned) {value.destroy();}
  owned.clear();
});

it('cancels removed handler work promptly, clears current, and suppresses stale readiness and errors', async() => {
  const entered = gate();
  const work = gate();
  const ready = [];
  const errors = [];
  const router = routerFor();
  const unmount = router.mount({ item: { path: '/item', async handler() { entered.resolve(); await work.promise; } } });
  router.on('route:ready', match => ready.push(match.name));
  router.on('route:error', error => errors.push(error));
  await router.start();
  const attempt = router.navigate('item');
  await entered.promise;
  const match = router.getCurrent();
  unmount();
  assert.equal(match.signal.aborted, true);
  assert.equal(router.getCurrent(), null);
  assert.equal(await attempt.finished, false);
  work.reject(new Error('late failure'));
  await work.promise.catch(() => {});
  assert.deepEqual(ready, []);
  assert.deepEqual(errors, []);
});

it('removes a pending registration before commit without disturbing the retained current route', async() => {
  const { driver, dispatch } = heldDriver('/pending');
  const router = routerFor({ driver, routes: { current: { path: '/current' } } });
  await router.start();
  await router.navigate('current').finished;
  const current = router.getCurrent();
  const unmount = router.mount({ pending: { path: '/pending' } });
  const pending = router.navigate('pending');
  unmount();
  dispatch.resolve();
  assert.equal(await pending.finished, false);
  assert.equal(router.getCurrent(), current);
});

it('removes current without cancelling an unrelated newer navigation awaiting commit', async() => {
  const { driver, dispatch } = heldDriver('/newer');
  const router = routerFor({ driver, routes: { newer: { path: '/newer' } } });
  const unmount = router.mount({ current: { path: '/current' } });
  await router.start();
  await router.navigate('current').finished;
  const current = router.getCurrent();
  const newer = router.navigate('newer');
  unmount();
  assert.equal(current.signal.aborted, true);
  dispatch.resolve();
  assert.equal(await newer.finished, true);
  assert.equal(router.getCurrent().name, 'newer');
  assert.equal(router.getCurrent().signal.aborted, false);
});

it('uses registration identity when an abort listener remounts and navigates the same name', async() => {
  const entered = gate();
  const work = gate();
  const ready = [];
  const router = routerFor();
  const unmount = router.mount({ page: { path: '/old', async handler() { entered.resolve(); await work.promise; } } });
  router.on('route:ready', match => ready.push(match.url.pathname));
  await router.start();
  const old = router.navigate('page');
  await entered.promise;
  let replacement;
  router.getCurrent().signal.addEventListener('abort', () => {
    router.mount({ page: { path: '/new' } });
    replacement = router.navigate('page');
  }, { once: true });
  unmount();
  assert.equal(await old.finished, false);
  assert.equal(await replacement.finished, true);
  work.resolve();
  await work.promise;
  assert.equal(router.getCurrent().url.pathname, '/new');
  assert.deepEqual(ready, ['/new']);
});

it('owner destruction cancels a pending redirect and prevents its late destination', async() => {
  const redirect = gate();
  const entered = gate();
  const router = routerFor({ routes: { destination: { path: '/destination' } } });
  const owner = own(new Application());
  router.mount({ old: { path: '/old', redirect() { entered.resolve(); return redirect.promise; } } }, { owner });
  await router.start();
  const attempt = router.navigate('old');
  await entered.promise;
  owner.destroy();
  assert.equal(await attempt.finished, false);
  redirect.resolve({ name: 'destination' });
  await redirect.promise;
  assert.equal(router.hasRoute('old'), false);
  assert.equal(router.getCurrent(), null);
});

it('does not invalidate pending work when unrelated registrations recompile the matcher', async() => {
  const entered = gate();
  const work = gate();
  const router = routerFor();
  router.mount({ retained: { path: '/retained', async handler() { entered.resolve(); await work.promise; } } });
  await router.start();
  const attempt = router.navigate('retained');
  await entered.promise;
  const removeOther = router.mount({ other: { path: '/other' } });
  removeOther();
  assert.equal(router.getCurrent().signal.aborted, false);
  work.resolve();
  assert.equal(await attempt.finished, true);
});

it('suppresses a handler when its registration is removed during the route notification', async() => {
  let calls = 0;
  const router = routerFor();
  const unmount = router.mount({ removed: { path: '/removed', handler() {calls++;} } });
  router.on('route', unmount);
  await router.start();
  assert.equal(await router.navigate('removed').finished, false);
  assert.equal(calls, 0);
  assert.equal(router.getCurrent(), null);
});

it('parent removal invalidates descendant work and remount restores its relative registration', async() => {
  const entered = gate();
  const work = gate();
  const router = routerFor();
  const removeParent = router.mount({ workspace: { path: '/:workspace', meta: { shell: true } } });
  let calls = 0;
  const Feature = RouteApplication.extend({
    routeParent: 'workspace',
    routes: { item: { path: 'items/:id', handler: 'show', meta: { feature: true } } },
    async show() { if (++calls === 1) { entered.resolve(); await work.promise; } },
  });
  own(new Feature({ router }));
  const match = router.match('/team/items/7');
  assert.equal(router.url('item', { workspace: 'team', id: 7 }), '/team/items/7');
  assert.deepEqual(match.meta, { shell: true, feature: true });
  assert.deepEqual(match.branch.map(entry => [entry.name, entry.params]), [['workspace', { workspace: 'team' }], ['item', { id: '7' }]]);
  await router.start();
  const attempt = router.navigate('item', { workspace: 'team', id: 7 });
  await entered.promise;
  removeParent();
  assert.equal(await attempt.finished, false);
  assert.equal(router.hasRoute('item'), false);
  router.mount({ workspace: { path: '/:workspace' } });
  assert.equal(router.hasRoute('item'), true);
  assert.equal(await router.navigate('item', { workspace: 'team', id: 8 }).finished, true);
  work.resolve();
  await work.promise;
  assert.equal(router.getCurrent().params.id, '8');
});

it('invalidates all retired descendants before an abort listener can remount their parent', async() => {
  const { driver, dispatch } = heldDriver('/team/pages/2');
  const router = routerFor({ driver });
  const removeParent = router.mount({ workspace: { path: '/:workspace' } });
  let pendingSignal;
  router.mount({ page: { path: 'pages/:id', redirect(match, { signal }) {
    if (match.params.id === '2') {pendingSignal = signal;}
  } } }, { parent: 'workspace' });
  await router.start();
  await router.navigate('page', { workspace: 'team', id: 1 }).finished;
  const current = router.getCurrent();
  const pending = router.navigate('page', { workspace: 'team', id: 2 });
  pendingSignal.addEventListener('abort', () => {
    router.mount({ workspace: { path: '/:workspace', meta: { replacement: true } } });
  }, { once: true });
  removeParent();
  assert.equal(pendingSignal.aborted, true);
  assert.equal(current.signal.aborted, true);
  assert.equal(router.getCurrent(), null);
  assert.equal(router.hasRoute('page'), true);
  dispatch.resolve();
  assert.equal(await pending.finished, false);
  assert.equal(await router.navigate('page', { workspace: 'team', id: 3 }).finished, true);
  assert.equal(router.getCurrent().meta.replacement, true);
});

it('injects one configured router into declarative childApps without starting UI or discovering owners', async() => {
  const router = routerFor();
  const calls = [];
  const Feature = RouteApplication.withRouter(router).extend({
    routes: { feature: { path: '/feature', handler: 'show' } },
    show() { calls.push(this); },
  });
  const Frame = Application.extend({ childApps: { feature: Feature } });
  const frame = own(new Frame());
  const feature = frame.getChildApp('feature');
  frame.addChildApp('router', router);
  assert.equal(router.hasRoute('feature'), true);
  assert.equal(feature.isRunning(), false);
  await frame.start();
  await router.start();
  assert.equal(await router.navigate('feature').finished, true);
  assert.deepEqual(calls, [feature]);
  frame.destroy();
  assert.equal(router.isDestroyed(), true);
  assert.equal(router.hasRoute('feature'), false);
});

it('awaits route activation and checks cancellation before switching children or rendering', async() => {
  const preparation = gate();
  const entered = gate();
  const rendered = [];
  const router = routerFor({ routes: { elsewhere: { path: '/elsewhere' } } });
  const Feature = RouteApplication.extend({
    routes: { page: { path: '/page', handler: 'showPage' }, detail: { path: '/page/detail', handler: 'showPage' } },
    initialize() {
      this.pages = this.addChildApp('pages', new ChildAppSwitcher());
      this.pages.addChildApp('page', new Application());
    },
    async prepareStart() { entered.resolve(); await preparation.promise; },
    async startOnRoute(match) {
      if (!await this.start()) {return false;}
      match.signal.throwIfAborted();
      return true;
    },
    async showPage(match, { signal }) {
      if (!await this.startOnRoute(match)) {return;}
      await this.pages.start();
      signal.throwIfAborted();
      const page = await this.pages.switchTo('page', { key: 'retained', signal });
      if (!page || signal.aborted) {return;}
      rendered.push(match.name);
    },
  });
  const feature = own(new Feature({ router }));
  await router.start();
  const obsolete = router.navigate('page');
  await entered.promise;
  await router.navigate('elsewhere').finished;
  preparation.resolve();
  assert.equal(await obsolete.finished, false);
  await feature.start();
  assert.equal(feature.pages.getCurrent(), null);
  assert.deepEqual(rendered, []);
  await router.navigate('page').finished;
  const page = feature.pages.getCurrent();
  await router.navigate('detail').finished;
  assert.equal(feature.pages.getCurrent(), page);
  assert.deepEqual(rendered, ['page', 'detail']);
  feature.stop();
  assert.equal(router.hasRoute('page'), true);
  await router.navigate('page').finished;
  assert.equal(feature.pages.getCurrent(), page);
});

it('keeps core rejection of fake child applications', () => {
  const owner = own(new Application());
  const fake = { cid: 'fake', start() {}, stop() {}, destroy() {}, isRunning() {}, isDestroyed() { return false; }, getName() {} };
  assert.throws(() => owner.addChildApp('fake', fake), error => error.code === 'MN0031');
  assert.equal(owner.hasChildApp('fake'), false);
});
