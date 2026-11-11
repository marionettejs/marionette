import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Application } from 'marionette';
import { RouteApplication, Router, routeTable, memoryDriver } from '@mnjs/router';

const owned = [];
const own = app => { owned.push(app); return app; };
afterEach(() => { for (const app of owned.splice(0).reverse()) { app.destroy(); } });

it('constructs route-less groups without a Router, including declarative children', async() => {
  const Group = RouteApplication.extend({ childApps: { page: Application } });
  const Frame = Application.extend({ childApps: { group: Group } });
  const frame = own(new Frame());
  const group = frame.getChildApp('group');
  await frame.start();
  await group.start();
  assert.equal(await group.switchTo('page'), group.getChildApp('page'));
});

it('compiles inherited and overridden class declarations without construction', () => {
  let constructions = 0;
  const Base = RouteApplication.extend({
    routes: { '/base/:id': { name: 'base' } },
    initialize() { constructions++; },
  });
  const Inherited = Base.extend({});
  const Override = Inherited.extend({ routes: { '/override/:other': { name: 'override' } } });
  const router = own(new Router());
  router.mount(routeTable(Inherited), { controller: own(new Inherited()) });
  router.mount(routeTable(Override), { controller: own(new Override()) });
  const count = constructions;
  routeTable(Inherited);
  routeTable(Override);
  assert.equal(constructions, count);
  assert.equal(router.url('base', { id: 'one' }), '/base/one');
  assert.equal(router.url('override', { other: 'two' }), '/override/two');
});

it('requires explicit mounting and preserves registrations through stop and restart', async() => {
  const Feature = RouteApplication.extend({ routes: { '/item/:id': { name: 'item' } } });
  const router = own(new Router({ driver: memoryDriver({ url: 'https://routes.example/' }) }));
  const feature = own(new Feature());
  assert.equal(router.hasRoute('item'), false);
  const unmount = feature.mountRoutes(router);
  await feature.start();
  feature.stop();
  assert.equal(router.hasRoute('item'), true);
  await feature.start();
  await feature.restart();
  assert.equal(router.hasRoute('item'), true);
  unmount(); unmount();
  assert.equal(router.hasRoute('item'), false);
});

it('keeps ordinary initialize options, state and static methods', () => {
  const Feature = RouteApplication.extend({
    initialize(options) { this.label = options.label; },
    createState() { return { count: 1 }; },
    inspect() { return this.label; },
  }, { category: 'feature' });
  const feature = own(new Feature({ label: 'catalog' }));
  assert.equal(feature.inspect(), 'catalog');
  assert.equal(feature.getState().count, 1);
  assert.equal(Feature.category, 'feature');
});

it('does not invoke class declaration factories while compiling', () => {
  let calls = 0;
  const Feature = RouteApplication.extend({ childApps() { calls++; return { page: Application }; } });
  assert.deepEqual(routeTable(Feature), []);
  assert.equal(calls, 0);
  const feature = own(new Feature());
  assert.equal(calls, 1);
  assert.equal(feature.hasChildApp('page'), true);
});
