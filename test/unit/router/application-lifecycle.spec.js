import { afterEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Application, createMarionette } from 'marionette';
import * as routing from '@mnjs/router';

const owned = new Set();
const own = value => { owned.add(value); return value; };
const routes = [{ name: 'home', path: '/' }, { name: 'page', path: '/page' }];
const deferred = () => Promise.withResolvers();
const nextEvent = (object, name) => new Promise(resolve => object.once(name, (...args) => resolve(args)));

afterEach(() => {
  for (const value of owned) { value.destroy(); }
  owned.clear();
});

function setup(options = {}, Router = routing.Router) {
  const driver = routing.memoryDriver({ url: 'https://routing.example/' });
  const bindings = new Set();
  const subscribe = driver.addEventListener.bind(driver);
  let subscriptions = 0;
  driver.addEventListener = (type, listener, settings) => {
    subscriptions++;
    bindings.add(listener);
    settings.signal.addEventListener('abort', () => bindings.delete(listener), { once: true });
    return subscribe(type, listener, settings);
  };
  const router = own(new Router({ routes, driver, ...options }));
  return { router, driver, bindings, subscriptions: () => subscriptions };
}

describe('Router Application ownership', () => {
  it('registers without starting implicitly and keeps child names separate from route names', async() => {
    const owner = own(new Application());
    const { router } = setup();
    owner.addChildApp('navigation', router);
    const page = router.addChildApp('home', new Application());

    await owner.start();

    assert.equal(router.isRunning(), false);
    assert.equal(router.getName(), 'navigation');
    assert.equal(await router.start(), true);
    assert.equal(router.getCurrent().name, 'home');
    assert.equal(router.getChildApp('home'), page);
    assert.equal(page.isRunning(), false);
  });

  for (const operation of ['stop', 'destroy']) {
    it(`disables a pending initial route when the owner ${ operation }s`, async() => {
      const ready = deferred();
      const entered = deferred();
      let match;
      const { router, driver, bindings } = setup({ handler(current) { match = current; entered.resolve(); return ready.promise; } });
      const owner = own(new Application());
      owner.addChildApp('navigation', router);
      const starting = router.start();
      await entered.promise;
      assert.equal(await starting, true);
      assert.equal(router.isRunning(), true);
      let routeReady = false;
      router.on('route:ready', () => { routeReady = true; });

      owner[operation]();

      assert.equal(match.signal.aborted, true);
      assert.equal(bindings.size, 0);
      assert.equal(router.isRunning(), false);
      await driver.simulate('/page').finished;
      assert.equal(driver.documentNavigations.length, 1);
      ready.resolve();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(routeReady, false);
    });

    it(`invalidates an active navigation when the owner ${ operation }s`, async() => {
      const ready = deferred();
      const entered = deferred();
      let match;
      const { router, bindings } = setup({ handler(current) {
        if (current.name === 'page') { match = current; entered.resolve(); return ready.promise; }
      } });
      const owner = own(new Application());
      owner.addChildApp('navigation', router);
      await router.start();
      const navigating = router.navigate('page');
      await entered.promise;

      owner[operation]();

      assert.equal(match.signal.aborted, true);
      assert.equal(bindings.size, 0);
      ready.resolve();
      assert.equal(await navigating.finished, false);
    });
  }

  it('stops the router when a later owner preparation fails and the caller abandons startup', async() => {
    const failure = new Error('owner preparation failed');
    const { router, bindings } = setup();
    const Owner = Application.extend({
      async prepareStart() {
        await this.getChildApp('navigation').start();
        throw failure;
      },
    });
    const owner = own(new Owner());
    owner.addChildApp('navigation', router);

    await assert.rejects(owner.start(), error => error === failure);
    assert.equal(router.isRunning(), true);
    const match = router.getCurrent();
    owner.stop();

    assert.equal(router.isRunning(), false);
    assert.equal(bindings.size, 0);
    assert.equal(match.signal.aborted, true);
  });

  it('keeps activation and its binding after initial route failure and retries with refresh', async() => {
    const failure = new Error('initial route failed');
    let calls = 0;
    const { router, bindings, subscriptions } = setup({ handler() { if (++calls === 1) { throw failure; } } });
    const failed = nextEvent(router, 'route:error');

    assert.equal(await router.start(), true);
    assert.equal((await failed)[0], failure);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(await router.start(), true);
    assert.equal(calls, 1);
    assert.equal(await router.refresh(), true);
    assert.equal(subscriptions(), 1);
    assert.equal(calls, 2);
  });

  it('activates even when its current URL has no route', async() => {
    const { router, bindings } = setup({ routes: [{ name: 'page', path: '/page' }] });

    assert.equal(await router.start(), true);
    assert.equal(router.isRunning(), true);
    assert.equal(router.getCurrent(), null);
    assert.equal(bindings.size, 1);
    assert.equal(await router.navigate('page').finished, true);
    assert.equal(router.getCurrent().name, 'page');
  });

  it('retains the binding, match and owned children across restart without redispatching', async() => {
    let handled = 0;
    const { router, bindings, subscriptions } = setup({ handler() { handled++; } });
    const page = router.addChildApp('content', new Application());
    await router.start();
    await page.start();
    const match = router.getCurrent();

    assert.equal(await router.restart(), true);

    assert.equal(handled, 1);
    assert.equal(subscriptions(), 1);
    assert.equal(bindings.size, 1);
    assert.equal(router.getCurrent(), match);
    assert.equal(match.signal.aborted, false);
    assert.equal(router.getChildApp('content'), page);
    assert.equal(page.isRunning(), true);
  });

  it('does not rebase the default Application family when provider slots change', () => {
    const runtime = createMarionette();
    const Router = routing.Router.extend({ Radio: runtime.Radio, State: runtime.Application.prototype.State });
    const owner = own(new runtime.Application());
    const { router } = setup({}, Router);

    assert.throws(() => owner.addChildApp('navigation', router), { code: 'MN0031' });
    assert.equal(router instanceof Application, true);
    assert.equal(router instanceof runtime.Application, false);
    assert.equal(owner.hasChildApp('navigation'), false);
  });

  it('exposes canGoBack as an ordinary overridable method', async() => {
    const Router = routing.Router.extend({ canGoBack() { return false; } });
    const { router, driver } = setup({}, Router);
    await router.start();
    await router.navigate('page').finished;

    assert.equal(driver.currentEntry.index, 1);
    assert.equal(router.canGoBack(), false);
    assert.equal(await router.back(), false);
    assert.equal(driver.currentEntry.index, 1);
  });

  it('keeps mandatory cleanup when notification hooks are overridden and blocks abort reentry', async() => {
    const hooks = [];
    const Router = routing.Router.extend({
      onBeforeStop() { hooks.push('before:stop'); },
      onStop() { hooks.push('stop'); },
      onBeforeDestroy() { hooks.push('before:destroy'); },
      onDestroy() { hooks.push('destroy'); },
    });
    const { router, bindings } = setup({}, Router);
    await router.start();
    let reentry;
    router.getCurrent().signal.addEventListener('abort', () => { reentry = router.start(); }, { once: true });

    router.stop();

    assert.equal(await reentry, false);
    assert.equal(router.isRunning(), false);
    assert.equal(bindings.size, 0);
    assert.equal(await router.start(), true);
    router.destroy();
    assert.equal(bindings.size, 0);
    assert.deepEqual(hooks, ['before:stop', 'stop', 'before:stop', 'stop', 'before:destroy', 'destroy']);
  });

  it('does not close a new binding when a stopped initial handler fails late', async() => {
    const ready = deferred();
    const entered = deferred();
    let calls = 0;
    const { router, bindings } = setup({ handler() {
      if (++calls === 1) { entered.resolve(); return ready.promise; }
    } });
    const original = router.start();
    await entered.promise;
    assert.equal(await original, true);
    router.stop();
    assert.equal(await router.start(), true);

    ready.reject(new Error('obsolete activation failed'));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(await router.navigate('page').finished, true);
  });

  it('leaves a newer restart active when the preceding start notification throws', async() => {
    const failure = new Error('start notification failed');
    let notifications = 0;
    const Router = routing.Router.extend({
      onStart() {
        if (++notifications === 1) {
          this.replacement = this.restart();
          throw failure;
        }
      },
    });
    const { router, bindings, subscriptions } = setup({}, Router);

    await assert.rejects(router.start(), error => error === failure);
    assert.equal(await router.replacement, true);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(subscriptions(), 1);
    assert.equal(await router.navigate('page').finished, true);
  });

  it('preserves a retained binding when an initial route error requests restart', async() => {
    const failure = new Error('initial route failed');
    let handled = 0;
    const Router = routing.Router.extend({
      handler() {
        if (++handled === 1) { throw failure; }
      },
      onRouteError(error) {
        assert.equal(error, failure);
        this.replacement = this.restart();
      },
    });
    const { router, bindings, subscriptions } = setup({}, Router);

    assert.equal(await router.start(), true);
    assert.equal(await router.replacement, true);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(subscriptions(), 1);
    assert.equal(await router.navigate('page').finished, true);
    assert.equal(handled, 2);
  });

  it('awaits consumer preparation without requiring a base hook call before enabling routing', async() => {
    const ready = deferred();
    const entered = deferred();
    let preparationSignal;
    let handled = 0;
    const Router = routing.Router.extend({
      async prepareStart(_options, context) {
        preparationSignal = context.signal;
        entered.resolve();
        await ready.promise;
      },
      handler() { assert.equal(this.isRunning(), true); handled++; },
    });
    const { router, bindings } = setup({}, Router);
    const starting = router.start();
    await entered.promise;
    assert.equal(router.isRunning(), false);
    assert.equal(bindings.size, 0);
    assert.equal(router.getCurrent(), null);
    assert.equal(router.start(), starting);

    ready.resolve();

    assert.equal(await starting, true);
    assert.equal(preparationSignal.aborted, false);
    assert.equal(bindings.size, 1);
    assert.equal(handled, 1);
  });

  for (const operation of ['stop', 'destroy']) {
    it(`does not enable routing after the owner ${ operation }s consumer preparation`, async() => {
      const ready = deferred();
      const entered = deferred();
      let preparationSignal;
      const Router = routing.Router.extend({
        prepareStart(_options, { signal }) {
          preparationSignal = signal;
          entered.resolve();
          return ready.promise;
        },
      });
      const { router, bindings } = setup({}, Router);
      const owner = own(new Application());
      owner.addChildApp('router', router);
      const starting = router.start();
      await entered.promise;

      owner[operation]();

      assert.equal(await starting, false);
      assert.equal(preparationSignal.aborted, true);
      ready.resolve();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(bindings.size, 0);
      assert.equal(router.getCurrent(), null);
      assert.equal(router.isRunning(), false);
      assert.equal(await router.navigate('page').finished, false);
    });
  }

  it('never acquires a binding when consumer preparation fails and permits activation retry', async() => {
    const failure = new Error('consumer preparation failed');
    let attempts = 0;
    const Router = routing.Router.extend({
      prepareStart() { if (++attempts === 1) { throw failure; } },
    });
    const { router, bindings, subscriptions } = setup({}, Router);

    await assert.rejects(router.start(), error => error === failure);
    assert.equal(router.isRunning(), false);
    assert.equal(router.getCurrent(), null);
    assert.equal(bindings.size, 0);
    assert.equal(subscriptions(), 0);
    assert.equal(await router.start(), true);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(subscriptions(), 1);
  });

  it('reports activation before an initial handler completes and notifies route readiness separately', async() => {
    const ready = deferred();
    const { router } = setup({ handler() { return ready.promise; } });
    const routeReady = nextEvent(router, 'route:ready');
    const starting = router.start();
    try {
      const activated = await Promise.race([starting, new Promise(resolve => setImmediate(() => resolve('pending')))]);
      assert.equal(activated, true);
      assert.equal(router.isRunning(), true);
    } finally {
      ready.resolve();
    }
    assert.equal((await routeReady)[0], router.getCurrent());
  });

  it('activates before an initial async redirect finishes and reports readiness for its destination', async() => {
    const target = deferred();
    const { router, driver, subscriptions } = setup({
      routes: [
        { name: 'home', path: '/', redirect: () => target.promise },
        { name: 'page', path: '/page' },
      ],
    });
    const routeReady = nextEvent(router, 'route:ready');

    assert.equal(await router.start(), true);
    assert.equal(router.isRunning(), true);
    assert.equal(driver.currentEntry.url, 'https://routing.example/');
    target.resolve('/page');
    const [match] = await routeReady;

    assert.equal(match.name, 'page');
    assert.equal(match.initial, true);
    assert.equal(driver.currentEntry.url, 'https://routing.example/page');
    assert.equal(driver.entries().length, 1);
    assert.equal(subscriptions(), 1);
  });

  it('preserves a new binding explicitly started from the completed stop notification', async() => {
    let starts = 0;
    const Router = routing.Router.extend({
      onStop() {
        if (++starts === 1) { this.replacement = this.start(); }
      },
    });
    const { router, bindings, subscriptions } = setup({}, Router);
    await router.start();
    const old = router.getCurrent();

    router.stop();

    assert.equal(await router.replacement, true);
    assert.equal(old.signal.aborted, true);
    assert.equal(router.getCurrent().signal.aborted, false);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(subscriptions(), 2);
    assert.equal(await router.navigate('page').finished, true);
  });
});
