import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Application } from 'marionette';
import { RouteApplication, memoryDriver } from '@mnjs/router';
import { createRouter } from './helpers.js';

const owned = new Set();
afterEach(() => { for (const app of owned) { app.destroy(); } owned.clear(); });
function routerFor() { return createRouter({ driver: memoryDriver({ url: 'https://defaults.example/configured' }) }); }

for (const style of ['extend', 'withRouter']) {
  it(`${style} defaults support no-argument children, inheritance, state and methods`, async() => {
    const router = routerFor();
    const Base = style === 'extend' ? RouteApplication.extend({ router }) : RouteApplication.withRouter(router);
    const initializers = [];
    const Feature = Base.extend({
      routes: { configured: { path: '/configured', handler: 'show' } },
      createState() { return { count: 1 }; },
      initialize(options) { initializers.push(options); },
      show(match) { this.shown = match.name; },
    }, { category: 'feature' });
    const Inherited = Feature.extend({});
    const Frame = Application.extend({ childApps: { feature: Inherited } });
    const frame = new Frame(); owned.add(frame);
    const feature = frame.getChildApp('feature');
    assert.deepEqual(initializers, [undefined], 'Defaults do not populate raw initializer arguments');
    assert.equal(feature.getState().count, 1);
    assert.equal(Inherited.category, 'feature');
    await router.start(); await router.getInitialDispatch();
    assert.equal(feature.shown, 'configured');
    frame.destroy();
    assert.equal(router.hasRoute('configured'), false);
  });

  it(`${style} defaults permit constructor overrides and undefined fallback`, () => {
    const router = routerFor();
    const other = routerFor();
    const Base = style === 'extend' ? RouteApplication.extend({ router }) : RouteApplication.withRouter(router);
    const Feature = Base.extend({ routes: { configured: { path: '/configured' } } });
    const fallback = new Feature({ router: undefined }); owned.add(fallback);
    assert.equal(router.hasRoute('configured'), true);
    fallback.destroy();
    const override = new Feature({ router: other }); owned.add(override);
    assert.equal(router.hasRoute('configured'), false);
    assert.equal(other.hasRoute('configured'), true);
    override.destroy();
    assert.equal(other.hasRoute('configured'), false);
  });

  for (const value of [undefined, null]) {
    it(`${style} does not retain a cleared/invalid inherited prototype default (${value})`, () => {
      const router = routerFor();
      const Base = style === 'extend' ? RouteApplication.extend({ router }) : RouteApplication.withRouter(router);
      const Invalid = Base.extend({ router: value }).extend({ routes: { configured: { path: '/configured' } } });
      assert.throws(() => new Invalid(), /requires a router/);
      const recovered = new Invalid({ router }); owned.add(recovered);
      assert.equal(router.hasRoute('configured'), true);
    });
  }
}

it('still requires a valid router when no default was configured', () => {
  assert.throws(() => new RouteApplication(), /requires a router/);
});
