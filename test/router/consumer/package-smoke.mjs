import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '@mnjs/router';
import { Application } from 'marionette';

const require = createRequire(import.meta.url);
const cjs = require('@mnjs/router');
assert.throws(() => require('@mnjs/router/outlet'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

// Keep the plain Application control: a child-owned replacement is separate
// from the first start/selection result in both installed module formats.
async function initialReplacement(Selector, Base) {
  const first = Promise.withResolvers();
  const replacement = Promise.withResolvers();
  const replacing = Promise.withResolvers();
  let runs = 0;
  let restarted;
  let stops = 0;
  const Page = Base.extend({
    prepareStart() {
      runs++;
      if (runs === 1) {
        queueMicrotask(() => { restarted = this.restart(); replacing.resolve(); });
        return first.promise;
      }
      return replacement.promise;
    },
  });
  const owner = Selector ? new Selector() : new Base();
  try {
    await owner.start();
    const page = owner.addChildApp('page', new Page());
    page.on('stop', () => stops++);
    const initial = Selector ? owner.switchTo('page') : page.start();
    await replacing.promise;
    replacement.resolve();
    assert.equal(await initial, Selector ? undefined : false);
    assert.equal(await restarted, true);
    assert.equal(page.isRunning(), true);
    assert.equal(stops, 0);
    assert.equal(runs, 2);
    if (Selector) { assert.equal(owner.getCurrent(), page); }
    first.resolve();
    owner.destroy();
    assert.equal(page.isDestroyed(), true);
  } finally { owner.destroy(); }
}

await initialReplacement(null, Application);
await initialReplacement(esm.RouteApplication, Application);
await initialReplacement(cjs.RouteApplication, require('marionette').Application);

for (const [format, api, Base] of [['ESM', esm, Application], ['CJS', cjs, require('marionette').Application]]) {
  const owned = [];
  const own = app => { owned.push(app); return app; };
  try {
    assert.equal('ChildAppSwitcher' in api, false);
    assert.equal('withRouter' in api.RouteApplication, false);
    assert.throws(() => own(new api.RouteApplication({ routes: {} })), /constructor routes/);
    const validation = own(new api.Router());
    for (const value of [null, 'home', []]) {
      assert.throws(() => validation.mount({ '/broken': value }), /hash entry "\/broken" must be a plain object/);
      assert.throws(() => api.routeTable(api.RouteApplication.extend({ routes: { '/broken': value } })), /hash entry "\/broken" must be a plain object/);
    }
    validation.mount({ '/plain': Object.assign(Object.create(null), { name: 'plain' }) });
    assert.equal(validation.url('plain'), '/plain');
    const Mounted = api.RouteApplication.extend({ routes: { '': { name: 'item' } } });
    const Duplicate = api.RouteApplication.extend({
      childApps: { item: Mounted },
      routes: { '/first/:id': { mount: 'item', namespace: 'first' }, '/second/:id': { mount: 'item', namespace: 'second' } },
    });
    assert.throws(() => api.routeTable(Duplicate), /child "item", which is already mounted/);
    const waiting = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const starts = [];
    const Page = api.RouteApplication.extend({
      routes: {
        '': { name: 'page', handler: 'show' },
        'details': { name: 'details', handler: 'show' },
      },
      prepareStart({ id }) {
        starts.push(id);
        if (id === 'slow') { entered.resolve(); return waiting.promise; }
      },
      show(match) { this.shown = match.name; },
    });
    const Feature = api.RouteApplication.extend({
      childApps: { page: Page },
      routes: { 'pages/:id': { mount: 'page', namespace: 'catalog', meta: { feature: true } } },
    });
    const driver = api.memoryDriver({ url: 'https://installed.example/team/pages/1' });
    const router = own(new api.Router({ driver, routes: { '/:workspace': { name: 'workspace', meta: { shell: true } } } }));
    const Frame = Base.extend({ childApps: { feature: Feature } });
    const frame = own(new Frame());
    frame.addChildApp('navigation', router);
    const feature = frame.getChildApp('feature');
    feature.mountRoutes(router, { parent: 'workspace' });
    assert.equal(feature instanceof Base, true);
    assert.equal(feature.isRunning(), false, 'Mounting is registration, not activation');
    assert.equal(router.url('catalog:page', { workspace: 'team', id: 7 }), '/team/pages/7');
    await frame.start();
    await feature.start();
    await router.start();
    const initial = await router.getInitialDispatch();
    assert.equal(initial.status, 'matched');
    assert.equal(initial.match.name, 'catalog:page');
    assert.deepEqual(initial.match.meta, { shell: true, feature: true });
    const page = feature.getChildApp('page');
    assert.equal(feature.getCurrent(), page);
    assert.equal(page.shown, 'catalog:page');
    await router.navigate('catalog:details').finished;
    assert.deepEqual(starts, ['1'], 'A sibling leaf retains the mount key and preparation');
    await router.navigate('catalog:page', { id: 2 }).finished;
    assert.deepEqual(starts, ['1', '2']);
    assert.equal(feature.getChildApp('page'), page, 'Changed keys restart the registered instance');
    const obsolete = router.navigate('catalog:page', { id: 'slow' });
    await entered.promise;
    feature.destroy();
    assert.equal(await obsolete.finished, false);
    assert.equal(router.getCurrent(), null);
    assert.equal(router.hasRoute('catalog:page'), false);
    router.mount({ '/replacement': { name: 'catalog:page' } });
    assert.equal(await router.navigate('catalog:page').finished, true);
    waiting.reject(new Error('obsolete preparation'));
    await waiting.promise.catch(() => {});
    const fake = { cid: 'fake', start() {}, stop() {}, destroy() {}, isRunning() {}, isDestroyed() { return false; }, getName() {} };
    assert.throws(() => frame.addChildApp('fake', fake), error => error.code === 'MN0031');
    frame.destroy();
    assert.equal(await router.start(), false);
    assert.equal(await router.navigate('/').finished, false);
    assert.deepEqual(driver.documentNavigations, []);

    const unmatched = own(new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/outside' }) }));
    await unmatched.start();
    assert.deepEqual(await unmatched.getInitialDispatch(), { status: 'unmatched' });

    const failure = new Error('failed handler');
    const errors = [];
    const failed = own(new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/fail' }),
      routes: { '/fail': { name: 'fail', handler() { throw failure; } } } }));
    failed.on('route:error', (...args) => errors.push(args));
    await failed.start();
    const result = await failed.getInitialDispatch();
    assert.equal(result.status, 'failed');
    assert.equal(result.error, failure);
    assert.equal(errors[0][1], result.match);
    assert.deepEqual(errors[0][2], { info: undefined });
    assert.equal(failed.isRunning(), true);

    const info = { caller: {} };
    const planningErrors = [];
    const policy = own(new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/home' }),
      routes: { '/home': { name: 'home' }, '/old': { name: 'old', redirect: async() => '/fail' }, '/fail': { name: 'fail' } },
      owns(url) { if (url.pathname === '/fail') { throw failure; } return true; } }));
    policy.on('route:error', (...args) => planningErrors.push(args));
    await policy.start();
    await policy.getInitialDispatch();
    await assert.rejects(policy.navigate('old', {}, { info }).finished, reason => reason === failure);
    assert.equal(planningErrors.length, 1);
    assert.equal(planningErrors[0][1], null);
    assert.equal(planningErrors[0][2].info, info);

    const ignored = Promise.withResolvers();
    const cancelled = own(new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/cancel' }),
      routes: { '/cancel': { name: 'cancel', handler() { return ignored.promise; } } } }));
    await cancelled.start();
    const first = cancelled.getInitialDispatch();
    cancelled.stop();
    assert.deepEqual(await first, { status: 'cancelled' });
    ignored.resolve();

    for (const asynchronous of [false, true]) {
      const shown = Promise.withResolvers();
      const presentation = Promise.withResolvers();
      const redirects = own(new api.Router({ driver: api.memoryDriver({ url: 'https://installed.example/old?tab=1#old' }), routes: {
        '/old': { name: 'old', redirect() { const target = { name: 'item', hash: '#details' }; return asynchronous ? Promise.resolve(target) : target; } },
        '/items': { name: 'item', handler(match) { shown.resolve(match); return presentation.promise; } },
      } }));
      await redirects.start();
      assert.equal((await shown.promise).url.href, 'https://installed.example/items?tab=1#details');
      presentation.resolve(false);
      assert.equal((await redirects.getInitialDispatch()).status, 'matched');
    }

    let runs = 0;
    const pages = own(new api.RouteApplication());
    const pageApp = pages.addChildApp('page', new (Base.extend({ onStart() { runs++; } }))());
    await pages.start();
    await pages.switchTo('page', { key: { id: 1 } });
    assert.equal(await pages.switchTo('page', { key: { id: 1 } }), pageApp);
    assert.equal(runs, 1);
    await pages.switchTo('page', { key: { id: 1 }, restart: true });
    assert.equal(runs, 2);
    assert.equal(pages.clear(), undefined);
    assert.equal(pages.getCurrent(), null);
    assert.equal(pageApp.isRunning(), false);
    assert.equal(pages.clear(), undefined);
    console.log(`${format} installed Router: owned branches, keyed lifecycle, cancellation, raw error provenance, redirects and selection passed.`);
  } finally {
    for (const app of owned.reverse()) { app.destroy(); }
  }
}
