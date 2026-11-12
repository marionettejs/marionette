// A small application built only from the public API: nested composition,
// not-found rendering, an independent pane and cancellation.
import assert from 'node:assert/strict';
import { test, afterEach } from 'vitest';
import { Application } from 'marionette';
import { Router, RouteApplication, memoryDriver } from '@mnjs/router';

const owned = [];
afterEach(() => { for (const app of owned.splice(0).reverse()) { app.destroy(); } });
const own = app => { owned.push(app); return app; };

function createShop(log) {
  const loads = {};
  const Reviews = Application.extend({
    onStart(app, { id }) {
      log.push(`reviews:${ id }`);
    },
  });
  const Product = RouteApplication.extend({
    childApps: { reviews: Reviews },
    routes: {
      '': { name: 'product', handler: 'showSummary' },
      'reviews': { name: 'reviews', handler: 'showReviews' },
    },
    prepareStart({ id }, { signal }) {
      loads[id] = Promise.withResolvers();
      log.push(`load:${ id }`);
      return loads[id].promise.then(() => signal.throwIfAborted());
    },
    onStart(app, { id }) {
      this.id = id;
    },
    showSummary() {
      log.push(`summary:${ this.id }`);
    },
    showReviews(match, { signal }) {
      return this.switchTo('reviews', { options: { id: this.id }, signal });
    },
  });
  const Cart = Application.extend({
    onStart() {
      log.push('cart');
    },
  });
  const Shop = RouteApplication.extend({
    childApps: { product: Product, cart: Cart },
    routes: {
      '/': { name: 'home', handler: 'showHome' },
      '/products/:id': { mount: 'product', namespace: 'shop' },
      '/items/:id': { name: 'legacy:item', redirect: { name: 'shop:product' } },
      '/missing': { name: 'missing', handler: 'showMissing' },
    },
    onStart() {
      // An independent pane: started by its owner, outside route selection.
      this.getChildApp('cart').start();
    },
    showHome() {
      log.push('home');
    },
    showMissing(match) {
      log.push(`missing:${ match.url.pathname }`);
    },
  });
  return { Shop, loads };
}

test('a small application composes, renders not-found and cancels stale work', async() => {
  const log = [];
  const { Shop, loads } = createShop(log);
  const router = own(new Router({
    driver: memoryDriver({ url: 'https://shop.test/' }),
    notFound: 'missing',
  }));
  const shop = own(new Shop());
  shop.mountRoutes(router);
  await shop.start();
  await router.start();
  await router.getInitialDispatch();

  const slow = router.navigate('shop:product', { id: 'a' });
  await slow.committed;
  const legacy = router.navigate('/items/b?ref=mail');
  await legacy.committed;
  loads.a.resolve();
  loads.b.resolve();
  assert.equal(await slow.finished, false, 'a newer navigation supersedes product a');
  assert.equal(await legacy.finished, true);
  assert.equal(router.getCurrent().url.pathname, '/products/b');
  assert.equal(router.getCurrent().url.search, '?ref=mail');

  await router.navigate('shop:reviews').finished;
  assert.equal(router.getCurrent().params.id, 'b', 'the shared product param is reused');

  await router.navigate('/nowhere').finished;
  assert.equal(shop.getChildApp('cart').isRunning(), true, 'the independent pane is untouched');

  assert.deepEqual(log, [
    'cart',
    'home',
    'load:a',
    'load:b',
    'summary:b',
    'reviews:b',
    'missing:/nowhere',
  ]);
  router.destroy();
  shop.destroy();
});

test('reused params come only from route nodes the routes share', async() => {
  const Section = RouteApplication.extend({
    routes: { 'item/:itemId': { name: 'item' } },
  });
  const Root = RouteApplication.extend({
    childApps: { left: Section, right: Section },
    routes: {
      'left/:sectionId': { mount: 'left', namespace: 'left' },
      'right/:sectionId': { mount: 'right', namespace: 'right' },
    },
  });
  const router = own(new Router({ driver: memoryDriver({ url: 'https://shop.test/' }) }));
  const root = own(new Root());
  root.mountRoutes(router);
  await root.start();
  await router.start();
  await router.getInitialDispatch();
  await router.navigate('left:item', { sectionId: 's', itemId: 'i' }).finished;

  assert.equal(router.url('left:item', { itemId: 'j' }), '/left/s/item/j');
  assert.throws(() => router.url('right:item', { sectionId: 't' }), /itemId/);
  router.destroy();
  root.destroy();
});
