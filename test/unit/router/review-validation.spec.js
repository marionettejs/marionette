import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import { Application } from 'marionette';
import { Router, RouteApplication, memoryDriver, routeTable } from '@mnjs/router';

const owned = [];
const own = app => { owned.push(app); return app; };
afterEach(() => { for (const app of owned.splice(0).reverse()) { app.destroy(); } });

for (const [kind, value] of [
  ['null', null], ['undefined', undefined], ['string shorthand', 'home'],
  ['array', []], ['class instance', new (class { name = 'home'; })()],
]) {
  for (const application of [false, true]) {
    test(`${application ? 'Application' : 'engine'} hash rejects ${kind} with its offending path`, () => {
      const router = own(new Router());
      const routes = { '/good': { name: 'good' }, '/broken': value };
      assert.throws(() => {
        if (application) { routeTable(RouteApplication.extend({ routes })); } else { router.mount(routes); }
      }, error => error instanceof TypeError && error.message.includes('"/broken"') && /plain object/.test(error.message));
      assert.equal(router.hasRoute('good'), false);
    });
  }
}

test('engine hashes preserve valid null-prototype values at nested paths', () => {
  const child = Object.assign(Object.create(null), { name: 'detail' });
  const parent = Object.assign(Object.create(null), { children: { 'details/:id': child } });
  const routes = Object.assign(Object.create(null), { '/items': parent });
  const router = own(new Router({ routes }));
  assert.equal(router.url('detail', { id: 'one' }), '/items/details/one');
  assert.equal(router.match('https://routes.example/items/details/two').params.id, 'two');
  assert.equal(Object.getPrototypeOf(parent), null);
  assert.equal(Object.hasOwn(child, 'path'), false);
});

test('Application hashes preserve valid null-prototype mount and leaf values', async() => {
  const seen = [];
  const Item = RouteApplication.extend({
    routes: { '': Object.assign(Object.create(null), { name: 'item', handler: 'show' }) },
    show(match) { seen.push(match.params.id); },
  });
  const Root = RouteApplication.extend({
    childApps: { item: Item },
    routes: Object.assign(Object.create(null), { '/items/:id': Object.assign(Object.create(null), { mount: 'item' }) }),
  });
  const root = own(new Root());
  const router = own(new Router({ driver: memoryDriver({ url: 'https://routes.example/items/one' }) }));
  root.mountRoutes(router);
  await root.start(); await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'matched');
  assert.deepEqual(seen, ['one']);
});

for (const array of [false, true]) {
  test(`Application ${array ? 'array' : 'hash'} rejects a duplicate child mount before construction`, () => {
    let constructed = 0;
    const Item = RouteApplication.extend({ routes: { '': { name: 'item' } }, initialize() { constructed++; } });
    const routes = array ? [
      { path: '/a/:id', mount: 'item', namespace: 'a', region: 'first' },
      { path: '/b/:id', mount: 'item', namespace: 'b', region: 'second' },
    ] : {
      '/a/:id': { mount: 'item', namespace: 'a', region: 'first' },
      '/b/:id': { mount: 'item', namespace: 'b', region: 'second' },
    };
    const Root = RouteApplication.extend({ childApps: { item: Item }, routes });
    assert.throws(() => routeTable(Root), error => error instanceof TypeError &&
      error.message.includes('"/b/:id"') && error.message.includes('"item"') && /already mounted/.test(error.message));
    assert.equal(constructed, 0);
  });
}

test('mount names are local to an owner and sibling registrations may share a class', () => {
  const Item = RouteApplication.extend({ routes: { '': { name: 'item' } } });
  const Group = RouteApplication.extend({ childApps: { item: Item }, routes: { 'items/:id': { mount: 'item' } } });
  const Root = RouteApplication.extend({
    childApps: { left: Group, right: Group },
    routes: { '/left': { mount: 'left', namespace: 'left' }, '/right': { mount: 'right', namespace: 'right' } },
  });
  const router = own(new Router());
  own(new Root()).mountRoutes(router);
  assert.equal(router.url('left:item', { id: 'one' }), '/left/items/one');
  assert.equal(router.url('right:item', { id: 'two' }), '/right/items/two');
});

test('constructor routes fail before child creation or initialization, while undefined preserves declarations', () => {
  let effects = 0;
  const Child = Application.extend({ initialize() { effects++; } });
  const Feature = RouteApplication.extend({
    routes: { '/class': { name: 'class' } }, childApps: { child: Child }, initialize() { effects++; },
  });
  for (const routes of [{ '/wrong': { name: 'wrong' } }, [], null, 'wrong', () => ({})]) {
    assert.throws(() => own(new Feature({ routes })), error => error instanceof TypeError && /constructor.*routes|routes.*constructor/.test(error.message));
  }
  assert.equal(effects, 0);
  const feature = own(new Feature({ routes: undefined }));
  assert.equal(effects, 2);
  const router = own(new Router());
  feature.mountRoutes(router);
  assert.equal(router.url('class'), '/class');
});

test('clear returns no result while stopping the selection once and retaining its registration', async() => {
  const owner = own(new RouteApplication());
  let stops = 0;
  const child = owner.addChildApp('child', new (Application.extend({ onStop() { stops++; } }))());
  assert.equal(owner.clear(), undefined);
  await owner.start();
  await owner.switchTo('child', { key: 'one' });
  assert.equal(owner.clear(), undefined);
  assert.equal(owner.getCurrent(), null);
  assert.equal(child.isRunning(), false);
  assert.equal(owner.getChildApp('child'), child);
  assert.equal(stops, 1);
  assert.equal(owner.clear(), undefined);
  owner.stop();
  assert.equal(owner.clear(), undefined);
  assert.equal(stops, 1);
});
