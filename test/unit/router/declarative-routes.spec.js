import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Application } from 'marionette';
import { Router, RouteApplication, routeTable, defineRoutes, memoryDriver } from '@mnjs/router';

const owned = [];
const own = app => { owned.push(app); return app; };
afterEach(() => { for (const app of owned.splice(0).reverse()) { app.destroy(); } });
function routerAt(path = '/') { return own(new Router({ driver: memoryDriver({ url: 'https://routes.example' + path }) })); }

it('compiles static descriptors without constructing routed Applications', () => {
  let constructed = 0;
  const Child = RouteApplication.extend({
    routes: { 'detail/:id': { name: 'detail' } },
    initialize() { constructed++; },
  });
  const table = routeTable({ routes: { '/items': { mount: 'child', namespace: 'catalog' } }, childApps: { child: Child } });
  assert.equal(constructed, 0);
  const root = own(new RouteApplication());
  root.addChildApp('child', new Child());
  const router = routerAt();
  router.mount(table, { owner: root, controller: root });
  assert.equal(router.url('catalog:detail', { id: 'one' }), '/items/detail/one');
  assert.equal(constructed, 1);
});

it('mounts before activation without starting a feature, and binds handlers to that feature', async() => {
  const seen = [];
  const Feature = RouteApplication.extend({
    routes: { '/item/:id': { name: 'item', handler(match) { seen.push([this, match.params.id]); } } },
  });
  const router = routerAt('/item/one');
  const feature = own(new Feature());
  feature.mountRoutes(router);
  assert.equal(feature.isRunning(), false);
  await feature.start();
  await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'matched');
  assert.deepEqual(seen, [[feature, 'one']]);
});

it('requires refresh after a running Router receives a lazy feature table', async() => {
  const seen = [];
  const Feature = RouteApplication.extend({
    routes: { 'item/:id': { name: 'item', handler: 'show' } },
    show(match) { seen.push([match.params.team, match.params.id, match.meta.shell]); },
  });
  const router = routerAt('/blue/item/one');
  router.mount({ '/:team': { name: 'team', meta: { shell: true } } });
  await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'unmatched');
  const feature = own(new Feature());
  feature.mountRoutes(router, { parent: 'team' });
  await feature.start();
  assert.deepEqual(seen, []);
  assert.equal(await router.refresh(), true);
  assert.deepEqual(seen, [['blue', 'one', true]]);
});

it('owner destruction retires required handler work but leaves unrelated registrations', async() => {
  const entered = Promise.withResolvers();
  const work = Promise.withResolvers();
  const Feature = RouteApplication.extend({
    routes: { '/pending': { name: 'pending', handler: 'show' } },
    show() { entered.resolve(); return work.promise; },
  });
  const router = routerAt();
  router.mount({ '/other': { name: 'other' } });
  const feature = own(new Feature());
  feature.mountRoutes(router);
  await feature.start();
  await router.start();
  const pending = router.navigate('pending');
  await entered.promise;
  const current = router.getCurrent();
  feature.destroy();
  assert.equal(await pending.finished, false);
  assert.equal(current.signal.aborted, true);
  assert.equal(router.hasRoute('pending'), false);
  assert.equal(router.hasRoute('other'), true);
  work.reject(new Error('obsolete handler'));
  await work.promise.catch(() => {});
});

it('keeps explicit feature registration through ordinary owner stop/start', async() => {
  const Frame = Application.extend({ childApps: { feature: RouteApplication } });
  const frame = own(new Frame());
  const feature = frame.getChildApp('feature');
  const router = routerAt();
  router.mount({ '/retained': { name: 'retained' } }, { owner: feature });
  await frame.start();
  await feature.start();
  frame.stop();
  assert.equal(router.hasRoute('retained'), true);
  await frame.start();
  await feature.start();
  frame.destroy();
  assert.equal(router.hasRoute('retained'), false);
});

it('preserves literal engine tables without changing their declarations', () => {
  const routes = { '/item/:id': { name: 'item' } };
  assert.equal(defineRoutes(routes), routes);
  const router = own(new Router({ routes }));
  assert.deepEqual(routes, { '/item/:id': { name: 'item' } });
  assert.equal(router.url('item', { id: 'one' }), '/item/one');
});

it('rejects explicit registration for an already destroyed feature', () => {
  const feature = own(new (RouteApplication.extend({ routes: { '/page': { name: 'page' } } }))());
  feature.destroy();
  const router = routerAt();
  assert.throws(() => feature.mountRoutes(router), /destroyed owner/);
  assert.equal(router.hasRoute('page'), false);
});
