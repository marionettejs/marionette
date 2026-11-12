import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test } from './fixtures.mjs';

async function routerModule(page, mode) {
  if (mode === 'native') { test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable'); }
  await page.route('**/router.js', route => route.fulfill({ path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript' }));
  await page.evaluate(async driver => {
    history.replaceState(null, '', '/outside');
    if (driver === 'history') {
      Object.defineProperty(globalThis, 'URLPattern', { configurable: true, value: undefined, writable: true });
      await import('urlpattern-polyfill');
      Object.defineProperty(window, 'navigation', { configurable: true, get() { throw new Error('History must not use Navigation API'); } });
    }
  }, mode);
}

for (const mode of ['native', 'history']) {
  test(`${mode} route-owning fallback provenance and compiled cleanup survive declaration edits`, async({ page }) => {
    await routerModule(page, mode);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = await page.evaluate(async driver => {
      history.replaceState(null, '', '/tenant/blue/unknown');
      const { Router, RouteApplication, historyDriver } = await import('/router.js');
      const { Application } = await import('marionette');
      const seen = [];
      const Item = RouteApplication.extend({ routes: { '': { name: 'item' } } });
      const Feature = RouteApplication.extend({
        childApps: { item: Item },
        routes: { item: { mount: 'item' }, parent: { name: 'parent' }, missing: { name: 'missing', handler: 'missing' } },
        missing(match) { seen.push([match.params.tenant, match.url.pathname]); },
      });
      const Root = RouteApplication.extend({
        childApps: { feature: Feature, sidebar: Application },
        routes: { '/tenant/:tenant': { mount: 'feature' } },
      });
      const root = new Root();
      const router = new Router({ ...(driver === 'history' ? { driver: historyDriver() } : {}), notFound: 'missing' });
      root.mountRoutes(router);
      try {
        await root.start();
        await root.getChildApp('sidebar').start();
        await router.start();
        const initial = await router.getInitialDispatch();
        let explicitParamsRequired = false;
        try { router.url('parent'); } catch { explicitParamsRequired = true; }
        await router.navigate('item', router.getCurrent().params).finished;
        const feature = root.getChildApp('feature');
        feature.routes = {};
        await router.navigate('parent').finished;
        const snapshotCleaned = !feature.getChildApp('item').isRunning() && feature.getCurrent() === null;

        const gate = Promise.withResolvers();
        const controller = new AbortController();
        const pages = root.addChildApp('pages', new RouteApplication());
        let lifecycleSignal;
        const child = pages.addChildApp('child', new (Application.extend({
          prepareStart(_options, { signal }) { lifecycleSignal = signal; return gate.promise; },
        }))());
        await pages.start();
        const cancelled = pages.switchTo('child', { signal: controller.signal });
        const joined = pages.switchTo('child');
        controller.abort();
        const released = await cancelled === undefined && !child.isRunning() && !lifecycleSignal.aborted;
        gate.resolve();
        return { seen, status: initial.status, explicitParamsRequired, snapshotCleaned,
          sidebar: root.getChildApp('sidebar').isRunning(), released, joined: await joined === child };
      } finally { router.destroy(); root.destroy(); }
    }, mode);
    expect(result).toEqual({ seen: [['blue', '/tenant/blue/unknown']], status: 'matched', explicitParamsRequired: true,
      snapshotCleaned: true, sidebar: true, released: true, joined: true });
    expect(errors).toEqual([]);
  });

  test(`${mode} route-owning nested mounts retain own keys and stop only selected descendants`, async({ page }) => {
    await routerModule(page, mode);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = await page.evaluate(async driver => {
      const { Router, RouteApplication, historyDriver } = await import('/router.js');
      const { Application, View, Region } = await import('marionette');
      const starts = [];
      let constructed = 0;
      const Content = View.extend({ template: () => '<p>Item content</p>' });
      const Item = RouteApplication.extend({
        routes: { '': { name: 'overview', handler: 'show' }, 'details/:tab': { name: 'details', handler: 'show' } },
        initialize() { constructed++; },
        prepareStart({ id }) { starts.push(['item', id]); },
        show() { this.showView(new Content()); },
      });
      const Feature = RouteApplication.extend({
        childApps: { item: Item },
        routes: { 'items/:id': { mount: 'item', namespace: 'item' } },
        prepareStart({ team }) { starts.push(['feature', team]); },
      });
      const Root = RouteApplication.extend({
        childApps: { feature: Feature, sidebar: Application },
        routes: { '/teams/:team': { mount: 'feature', namespace: 'workspace' }, '/parent': { name: 'parent' } },
      });
      const root = new Root({ region: { el: '#content' } });
      const router = new Router(driver === 'history' ? { driver: historyDriver() } : {});
      root.mountRoutes(router);
      const sideHost = document.body.appendChild(document.createElement('aside'));
      const side = root.getChildApp('sidebar');
      try {
        await root.start();
        await side.start({ region: new Region({ el: sideHost }) });
        side.showView(new Content());
        const sideView = side.getView();
        await router.start(); await router.getInitialDispatch();
        await router.navigate('workspace:item:overview', { team: 'blue', id: 'one' }).finished;
        const feature = root.getChildApp('feature');
        const item = feature.getChildApp('item');
        await router.navigate('workspace:item:details', { tab: 'notes' }).finished;
        const retained = item.isRunning() && feature.getCurrent() === item && starts.length === 2;
        const detailsView = item.getView();
        const detailsAttached = detailsView.isAttached() && !detailsView.isDestroyed();
        await router.navigate('workspace:item:overview', { id: 'two' }).finished;
        const replaced = detailsAttached && detailsView.isDestroyed() && feature.getChildApp('item') === item;
        await router.navigate('workspace:item:overview', { team: 'red' }).finished;
        const url = location.pathname;
        await router.navigate('parent').finished;
        return { retained, replaced, constructed, starts, url,
          stopped: !item.isRunning() && !feature.isRunning() && root.getCurrent() === null,
          independent: side.isRunning() && side.getView() === sideView && !sideView.isDestroyed(),
          empty: document.querySelector('#content').textContent };
      } finally { router.destroy(); root.destroy(); sideHost.remove(); }
    }, mode);
    expect(result).toEqual({ retained: true, replaced: true, constructed: 1,
      starts: [['feature', 'blue'], ['item', 'one'], ['item', 'two'], ['feature', 'red'], ['item', 'two']],
      url: '/teams/red/items/two', stopped: true, independent: true, empty: '' });
    expect(errors).toEqual([]);
  });

  test(`${mode} route-owning same-key startup joins while changed keys supersede stale presentation`, async({ page }) => {
    await routerModule(page, mode);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = await page.evaluate(async driver => {
      const { Router, RouteApplication, historyDriver } = await import('/router.js');
      const gate = Promise.withResolvers();
      const entered = Promise.withResolvers();
      const started = [];
      const handled = [];
      const signals = [];
      const Page = RouteApplication.extend({
        routes: { '': { name: 'item', handler: 'show' }, 'details': { name: 'details', handler: 'show' } },
        prepareStart({ id }, { signal }) { started.push(id); signals.push(signal); if (id !== 'fast') { entered.resolve(); return gate.promise; } },
        show(match) { handled.push(match.name); },
      });
      const Root = RouteApplication.extend({ childApps: { page: Page }, routes: { '/items/:id': { mount: 'page' } } });
      const root = new Root();
      const router = new Router(driver === 'history' ? { driver: historyDriver() } : {});
      root.mountRoutes(router);
      try {
        await root.start(); await router.start(); await router.getInitialDispatch();
        const first = router.navigate('item', { id: 'shared' });
        await entered.promise;
        const second = router.navigate('details', { id: 'shared' });
        await second.committed;
        const preparationStillLive = !signals[0].aborted && started.length === 1;
        gate.resolve();
        const joined = [await first.finished, await second.finished];
        const held = Promise.withResolvers();
        const slowEntered = Promise.withResolvers();
        root.getChildApp('page').prepareStart = ({ id }) => {
          started.push(id);
          if (id === 'slow') { slowEntered.resolve(); return held.promise; }
        };
        const slow = router.navigate('item', { id: 'slow' });
        await slowEntered.promise;
        const fast = router.navigate('item', { id: 'fast' });
        const replaced = [await slow.finished, await fast.finished];
        held.reject(new Error('obsolete request'));
        await new Promise(resolve => setTimeout(resolve, 0));
        return { preparationStillLive, joined, replaced, started, handled, current: router.getCurrent().params.id };
      } finally { router.destroy(); root.destroy(); }
    }, mode);
    expect(result).toEqual({ preparationStillLive: true, joined: [false, true], replaced: [false, true],
      started: ['shared', 'slow', 'fast'], handled: ['details', 'item'], current: 'fast' });
    expect(errors).toEqual([]);
  });

  test(`${mode} route-owning failures carry start and route phases through parent boundaries`, async({ page }) => {
    await routerModule(page, mode);
    const result = await page.evaluate(async driver => {
      const { Router, RouteApplication, historyDriver } = await import('/router.js');
      const startup = new Error('startup');
      const routeError = new Error('route');
      const phases = [];
      const reported = [];
      const Child = RouteApplication.extend({
        routes: { '': { name: 'page', handler: 'fail' } },
        prepareStart({ id }) { if (id === 'bad') { throw startup; } },
        fail() { throw routeError; },
      });
      const Root = RouteApplication.extend({
        childApps: { child: Child }, routes: { '/page/:id': { mount: 'child' } },
        handleRouteError(error, match, { mount, phase }) {
          phases.push([error.message, mount, phase]);
          if (match.params.id === 'unhandled') { throw error; }
        },
      });
      const root = new Root();
      const router = new Router(driver === 'history' ? { driver: historyDriver() } : {});
      router.on('route:error', (error, match, context) => reported.push([error === routeError, match.name, context.info]));
      root.mountRoutes(router);
      try {
        await root.start(); await router.start(); await router.getInitialDispatch();
        const handled = [await router.navigate('page', { id: 'bad' }).finished, await router.navigate('page', { id: 'good' }).finished];
        const info = 'origin';
        const original = await router.navigate('page', { id: 'unhandled' }, { info }).finished.then(() => false, error => error === routeError);
        return { phases, handled, original, reported, running: root.isRunning() && router.isRunning() };
      } finally { router.destroy(); root.destroy(); }
    }, mode);
    expect(result).toEqual({ phases: [['startup', 'child', 'start'], ['route', 'child', 'route'], ['route', 'child', 'route']],
      handled: [true, true], original: true, reported: [[true, 'page', 'origin']], running: true });
  });
}
