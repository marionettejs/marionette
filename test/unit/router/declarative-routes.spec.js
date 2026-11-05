import { afterEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Application } from 'marionette';
import * as routing from '@mnjs/router';

const owned = new Set();
const own = value => { owned.add(value); return value; };
const gate = () => Promise.withResolvers();

afterEach(() => {
  for (const value of owned) { value.destroy(); }
  owned.clear();
});

function routerFor(options = {}, Router = routing.Router) {
  return own(new Router({ driver: routing.memoryDriver({ url: 'https://routes.example/outside' }), ...options }));
}

describe('declarative route handlers', () => {
  it('resolves named handlers after initialize and binds the default controller to the Router', async() => {
    const calls = [];
    const Router = routing.Router.extend({
      routes: { item: { path: '/items/:id', handler: 'showItem' } },
      initialize() {
        this.showItem = function(match, context) { calls.push([this, match.params.id, context.signal]); };
      },
    });
    const router = routerFor({}, Router);
    await router.start();

    assert.equal(await router.navigate('item', { id: '7' }).finished, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], router);
    assert.equal(calls[0][1], '7');
    assert.equal(calls[0][2], router.getCurrent().signal);
  });

  it('supports existing arrays and function handlers without running the global fallback twice', async() => {
    const calls = [];
    const router = routerFor({
      routes: [
        { name: 'specific', path: '/specific', handler(match) { calls.push([this, match.name]); } },
        { name: 'fallback', path: '/fallback' },
      ],
      handler(match) { calls.push(['fallback', match.name]); },
    });
    await router.start();
    await router.navigate('specific').finished;
    await router.navigate('fallback').finished;

    assert.deepEqual(calls, [[router, 'specific'], ['fallback', 'fallback']]);
  });

  it('binds explicit mount controllers and resolves methods once at registration', async() => {
    const calls = [];
    const controller = { show(match) { calls.push([this, match.name]); } };
    const router = routerFor();
    const unmount = router.mount({ item: { path: '/item', handler: 'show' } }, { controller });
    controller.show = () => { throw new Error('later replacement must not be called'); };
    await router.start();
    await router.navigate('item').finished;

    assert.deepEqual(calls, [[controller, 'item']]);
    unmount();
    assert.equal(router.hasRoute('item'), false);
  });

  it('rejects unresolved handlers during registration and leaves no partially mounted routes', () => {
    const router = routerFor({ routes: [{ name: 'existing', path: '/existing' }] });
    assert.throws(() => router.mount({
      good: { path: '/good', handler() {} },
      bad: { path: '/bad', handler: 'missing' },
    }, { controller: {} }), error => error.code === 'MN0019' && /missing/.test(error.message));
    assert.equal(router.hasRoute('good'), false);
    assert.equal(router.hasRoute('bad'), false);
    assert.equal(router.match('/existing').name, 'existing');
    assert.throws(() => routerFor({ routes: { bad: { path: '/bad', handler: 'missing' } } }), error => error.code === 'MN0019');
    assert.throws(() => router.mount([
      { path: '/section', handler: 'missing', children: [{ name: 'section:page', path: 'page' }] },
    ], { controller: {} }), error => error.code === 'MN0019' && /for "\/section"/.test(error.message));
    assert.equal(router.hasRoute('section:page'), false);
  });

  it('rejects non-table object mounts without changing registered routes', () => {
    const router = routerFor({ routes: { existing: { path: '/existing' } } });
    assert.throws(() => router.mount(new Date()), TypeError);
    assert.equal(router.hasRoute('existing'), true);
    assert.equal(router.match('/existing').name, 'existing');
  });

  it('does not inherit a named parent handler into a child without its own handler', async() => {
    const calls = [];
    const router = routerFor({ routes: {
      parent: { path: '/parent', handler(match) { calls.push(['parent', match.name]); }, children: {
        child: { path: 'child' },
      } },
    }, handler(match) { calls.push(['fallback', match.name]); } });
    await router.start();
    await router.navigate('parent').finished;
    await router.navigate('child').finished;

    assert.deepEqual(calls, [['parent', 'parent'], ['fallback', 'child']]);
  });

  it('uses the same nested hash declarations for parameter inheritance, matching and optional URL generation', async() => {
    const calls = [];
    const router = routerFor({ routes: {
      workspace: { path: '/:workspace', meta: { scope: 'workspace' }, children: {
        record: { path: 'records/:id{/:tab}?', handler(match) { calls.push(match.params); } },
      } },
    } });
    assert.equal(router.url('record', { workspace: 'clinic', id: 'a/b' }), '/clinic/records/a%2Fb');
    assert.equal(router.url('record', { workspace: 'clinic', id: 'a/b', tab: 'notes' }), '/clinic/records/a%2Fb/notes');
    await router.start();
    await router.navigate('record', { workspace: 'clinic', id: 'a/b', tab: 'notes' }).finished;

    assert.deepEqual(calls, [{ workspace: 'clinic', id: 'a/b', tab: 'notes' }]);
    assert.deepEqual(router.getCurrent().branch.map(item => item.name), ['workspace', 'record']);
    assert.equal(router.getCurrent().meta.scope, 'workspace');
  });

  it('awaits a declarative handler before readiness and reports its operational failure', async() => {
    const pending = gate();
    const entered = gate();
    const failure = new Error('record loading failed');
    const router = routerFor({ routes: { item: { path: '/item', async handler() { entered.resolve(); await pending.promise; } } } });
    const ready = [];
    const errors = [];
    router.on('route:ready', match => ready.push(match.name));
    router.on('route:error', (error, match) => errors.push([error, match.name]));
    await router.start();
    const navigation = router.navigate('item');
    await entered.promise;
    assert.deepEqual(ready, []);
    pending.reject(failure);

    await assert.rejects(navigation.finished, error => error === failure);
    assert.deepEqual(errors, [[failure, 'item']]);
    assert.deepEqual(ready, []);
  });

  it('runs only the destination handler for synchronous and asynchronous declarative redirects', async() => {
    const calls = [];
    const router = routerFor({ routes: {
      old: { path: '/old', redirect: () => ({ name: 'current' }), handler() { calls.push('old'); } },
      lookup: { path: '/lookup', redirect: async() => ({ name: 'current' }), handler() { calls.push('lookup'); } },
      current: { path: '/current', handler() { calls.push('current'); } },
    }, handler() { calls.push('fallback'); } });
    await router.start();

    assert.equal(await router.navigate('old').finished, true);
    assert.equal(await router.navigate('lookup').finished, true);
    assert.deepEqual(calls, ['current', 'current']);
  });

  it('suppresses readiness and post-await work from a superseded declarative handler', async() => {
    const pending = gate();
    const entered = gate();
    const effects = [];
    const router = routerFor({ routes: {
      slow: { path: '/slow', async handler(_match, { signal }) {
        entered.resolve();
        await pending.promise;
        signal.throwIfAborted();
        effects.push('obsolete');
      } },
      latest: { path: '/latest', handler() { effects.push('latest'); } },
    } });
    const ready = [];
    router.on('route:ready', match => ready.push(match.name));
    await router.start();
    const obsolete = router.navigate('slow');
    await entered.promise;
    assert.equal(await router.navigate('latest').finished, true);
    pending.resolve();

    assert.equal(await obsolete.finished, false);
    assert.deepEqual(effects, ['latest']);
    assert.deepEqual(ready, ['latest']);
  });
});

describe('RouteApplication declaration ownership', () => {
  it('requires an explicit Router', () => {
    assert.throws(() => new routing.RouteApplication(), /router/i);
  });

  it('accepts constructor declarations with array children and binds functions to the feature', async() => {
    const calls = [];
    const router = routerFor();
    const feature = own(new routing.RouteApplication({ router, routes: {
      section: { path: '/section/:section', children: [
        { name: 'detail', path: 'detail/:id', handler(match) { calls.push([this, match.params]); } },
      ] },
    } }));
    await router.start();
    await router.navigate('detail', { section: 'a', id: 'b' }).finished;

    assert.deepEqual(calls, [[feature, { section: 'a', id: 'b' }]]);
    feature.destroy();
    assert.equal(router.hasRoute('section'), false);
    assert.equal(router.hasRoute('detail'), false);
  });

  it('evaluates conditional routes after initialize and mounts without starting the feature', async() => {
    const calls = [];
    const Feature = routing.RouteApplication.extend({
      initialize(options) { this.canView = options.canView; },
      routes() { return this.canView ? { permitted: { path: '/permitted', handler: 'show' } } : {}; },
      show() { calls.push([this, this.isRunning()]); },
    });
    const router = routerFor();
    const denied = own(new Feature({ router, canView: false }));
    assert.equal(router.hasRoute('permitted'), false);
    denied.destroy();
    const allowed = own(new Feature({ router, canView: true }));
    assert.equal(router.hasRoute('permitted'), true);
    assert.equal(allowed.isRunning(), false);
    assert.equal(allowed.start, Application.prototype.start);
    await router.start();
    await router.navigate('permitted').finished;

    assert.deepEqual(calls, [[allowed, false]]);
    assert.equal(allowed.isRunning(), false);
  });

  it('does not mount or evaluate declarations after initialize destroys the feature', () => {
    const router = routerFor();
    const Feature = routing.RouteApplication.extend({
      initialize() { this.destroy(); },
      routes() { throw new Error('a destroyed feature must not evaluate routes'); },
    });
    const feature = own(new Feature({ router }));

    assert.equal(feature.isDestroyed(), true);
    assert.equal(router.hasRoute('abandoned'), false);
  });

  it('does not mount declarations returned by a route function that destroys the feature', () => {
    const router = routerFor();
    const Feature = routing.RouteApplication.extend({
      routes() {
        this.destroy();
        return { abandoned: { path: '/abandoned', handler() {} } };
      },
    });
    const feature = own(new Feature({ router }));

    assert.equal(feature.isDestroyed(), true);
    assert.equal(router.hasRoute('abandoned'), false);
    assert.equal(router.match('/abandoned'), null);
  });

  it('retains automatic routes across stop/restart and unmounts them before destruction notifications', async() => {
    const router = routerFor();
    const Feature = routing.RouteApplication.extend({ routes: [{ name: 'feature', path: '/feature', handler() {} }] });
    const feature = own(new Feature({ router }));
    await feature.start();
    feature.stop();
    assert.equal(router.hasRoute('feature'), true);
    await feature.start();
    await feature.restart();
    assert.equal(router.hasRoute('feature'), true);
    let registeredAtDestroy;
    feature.on('destroy', () => { registeredAtDestroy = router.hasRoute('feature'); });
    feature.destroy();

    assert.equal(registeredAtDestroy, false);
    assert.equal(router.hasRoute('feature'), false);
    assert.equal(feature.destroy(), true);
  });

  it('leaves explicit mounts outside automatic declaration ownership', () => {
    const router = routerFor();
    const Feature = routing.RouteApplication.extend({
      routes: { automatic: { path: '/automatic', handler: 'show' } },
      show() {},
    });
    const feature = own(new Feature({ router }));
    const unmount = router.mount({ manual: { path: '/manual', handler: 'show' } }, { controller: feature });
    feature.destroy();

    assert.equal(router.hasRoute('automatic'), false);
    assert.equal(router.hasRoute('manual'), true);
    unmount();
    assert.equal(router.hasRoute('manual'), false);
  });

  it('lets the handler select operations and reuse a child by patient key', async() => {
    const starts = [];
    const Patient = Application.extend({ onStart(_app, options) { starts.push(options.id); } });
    const Feature = routing.RouteApplication.extend({
      routes: {
        patient: { path: '/patients/:id', handler: 'showPatient' },
        details: { path: '/patients/:id/details', handler: 'showPatient' },
      },
      initialize() {
        this.pages = this.addChildApp('pages', new routing.ChildAppSwitcher());
        this.patient = this.pages.addChildApp('patient', new Patient());
      },
      async showPatient(match, { signal }) {
        await this.start();
        signal.throwIfAborted();
        await this.pages.start();
        await this.pages.switchTo('patient', { key: { id: match.params.id }, options: { id: match.params.id }, signal });
      },
    });
    const router = routerFor();
    const feature = own(new Feature({ router }));
    assert.equal(feature.isRunning(), false);
    await router.start();
    await router.navigate('patient', { id: '1' }).finished;
    const patient = feature.patient;
    await router.navigate('details', { id: '1' }).finished;
    assert.deepEqual(starts, ['1']);
    await router.navigate('patient', { id: '2' }).finished;

    assert.equal(feature.patient, patient);
    assert.equal(feature.pages.getCurrent(), patient);
    assert.deepEqual(starts, ['1', '2']);
    feature.stop();
    assert.equal(patient.isRunning(), false);
    assert.equal(router.hasRoute('patient'), true);
  });
});


it('preserves literal route definitions as the single runtime table', () => {
  const hash = { item: { path: '/items/:id' } };
  const definitions = [{ name: 'home', path: '/' }];
  assert.equal(routing.defineRoutes(hash), hash);
  assert.equal(routing.defineRoutes(definitions), definitions);
  const router = own(new routing.Router({ routes: routing.defineRoutes(hash) }));
  assert.equal(router.url('item', { id: 0 }), '/items/0');
});

it('releases registration if a declaration getter destroys the feature while mounting', () => {
  const router = own(new routing.Router());
  const Feature = routing.RouteApplication.extend({
    routes() {
      const feature = this;
      return { get abandoned() { feature.destroy(); return { path: '/abandoned' }; } };
    },
  });
  const feature = new Feature({ router });
  assert.equal(feature.isDestroyed(), true);
  assert.equal(router.hasRoute('abandoned'), false);
});
