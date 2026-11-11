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

it('resolves Router handlers after initialize and binds their receiver and signal', async() => {
  const calls = [];
  const Routed = Router.extend({
    routes: { '/items/:id': { name: 'item', handler: 'showItem' } },
    initialize() { this.showItem = function(match, context) { calls.push([this, match.params.id, context.signal]); }; },
  });
  const router = own(new Routed({ driver: memoryDriver({ url: 'https://routes.example/outside' }) }));
  await router.start();
  await router.navigate('item', { id: '7' }).finished;
  assert.deepEqual(calls, [[router, '7', router.getCurrent().signal]]);
});

it('snapshots controller methods at registration and chooses route handlers over the global fallback', async() => {
  const calls = [];
  const controller = { show(match) { calls.push([this, match.name]); } };
  const router = own(new Router({ driver: memoryDriver({ url: 'https://routes.example/outside' }),
    routes: [{ path: '/fallback', name: 'fallback' }], handler(match) { calls.push(['global', match.name]); } }));
  const unmount = router.mount({ '/item': { name: 'item', handler: 'show' } }, { controller });
  controller.show = () => { throw new Error('Replacement is not the registered handler'); };
  await router.start();
  await router.navigate('item').finished;
  await router.navigate('fallback').finished;
  assert.deepEqual(calls, [[controller, 'item'], ['global', 'fallback']]);
  unmount();
  assert.equal(router.hasRoute('item'), false);
});

it('does not inherit a parent handler into a child with only the global fallback', async() => {
  const calls = [];
  const router = own(new Router({ driver: memoryDriver({ url: 'https://routes.example/outside' }), routes: {
    '/parent': { name: 'parent', handler(match) { calls.push(['parent', match.name]); }, children: { 'child': { name: 'child' } } },
  }, handler(match) { calls.push(['fallback', match.name]); } }));
  await router.start();
  await router.navigate('parent').finished;
  await router.navigate('child').finished;
  assert.deepEqual(calls, [['parent', 'parent'], ['fallback', 'child']]);
});

it('rejects unresolved handlers without partially registering their table', () => {
  const router = own(new Router({ driver: memoryDriver({ url: 'https://routes.example/outside' }), routes: { '/existing': { name: 'existing' } } }));
  assert.throws(() => router.mount({
    '/good': { name: 'good', handler() {} }, '/bad': { name: 'bad', handler: 'missing' },
  }, { controller: {} }), error => error.code === 'MN0019' && /missing/.test(error.message));
  assert.equal(router.hasRoute('good'), false);
  assert.equal(router.hasRoute('bad'), false);
  assert.equal(router.match('/existing').name, 'existing');
  assert.throws(() => router.mount([{ path: '/section', handler: 'missing', children: [{ name: 'page', path: 'page' }] }],
    { controller: {} }), error => error.code === 'MN0019' && /for "\/section"/.test(error.message));
  assert.equal(router.hasRoute('page'), false);
});
