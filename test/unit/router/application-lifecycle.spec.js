import { afterEach, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Application, createMarionette } from 'marionette';
import * as routing from '@mnjs/router';

const owned = new Set();
const own = value => { owned.add(value); return value; };
const routes = [{ name: 'home', path: '/' }, { name: 'page', path: '/page' }];
const deferred = () => Promise.withResolvers();

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
    it(`cancels initial readiness when the owner ${ operation }s without waiting for the handler`, async() => {
      const ready = deferred();
      const entered = deferred();
      let match;
      const { router, driver, bindings } = setup({ handler(current) { match = current; entered.resolve(); return ready.promise; } });
      const owner = own(new Application());
      owner.addChildApp('navigation', router);
      const starting = router.start();
      await entered.promise;

      owner[operation]();

      assert.equal(await starting, false);
      assert.equal(match.signal.aborted, true);
      assert.equal(bindings.size, 0);
      assert.equal(router.isRunning(), false);
      await driver.simulate('/page').finished;
      assert.equal(driver.documentNavigations.length, 1);
      ready.resolve();
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

  it('cleans failed initial activation and permits a fresh start', async() => {
    const failure = new Error('initial route failed');
    let calls = 0;
    const { router, bindings, subscriptions } = setup({ handler() { if (++calls === 1) { throw failure; } } });

    await assert.rejects(router.start(), error => error === failure);
    assert.equal(router.isRunning(), false);
    assert.equal(bindings.size, 0);
    assert.equal(await router.start(), true);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(subscriptions(), 2);
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
    router.stop();
    assert.equal(await original, false);
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

    assert.equal(await router.start(), false);
    assert.equal(await router.replacement, true);
    assert.equal(router.isRunning(), true);
    assert.equal(bindings.size, 1);
    assert.equal(subscriptions(), 1);
    assert.equal(await router.navigate('page').finished, true);
    assert.equal(handled, 2);
  });

  it('cancels composed subclass preparation and its already-bound routing resources together', async() => {
    const ready = deferred();
    const entered = deferred();
    let preparationSignal;
    const Router = routing.Router.extend({
      async prepareStart(options, context) {
        await routing.Router.prototype.prepareStart.call(this, options, context);
        preparationSignal = context.signal;
        entered.resolve();
        await ready.promise;
      },
    });
    const { router, bindings } = setup({}, Router);
    const starting = router.start();
    await entered.promise;
    assert.equal(router.isRunning(), false);
    assert.equal(bindings.size, 1);

    router.stop();

    assert.equal(await starting, false);
    assert.equal(preparationSignal.aborted, true);
    assert.equal(bindings.size, 0);
    ready.resolve();
  });

  for (const operation of ['stop', 'destroy']) {
    it(`releases abandoned bindings on ${ operation } after composed preparation fails`, async() => {
      const failure = new Error('additional preparation failed');
      const Router = routing.Router.extend({
        async prepareStart(options, context) {
          await routing.Router.prototype.prepareStart.call(this, options, context);
          throw failure;
        },
      });
      const { router, bindings } = setup({}, Router);
      await assert.rejects(router.start(), error => error === failure);
      assert.equal(router.isRunning(), false);
      const match = router.getCurrent();

      router[operation]();

      assert.equal(bindings.size, 0);
      assert.equal(match.signal.aborted, true);
      assert.equal(await router.navigate('page').finished, false);
    });
  }

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
