import assert from 'node:assert/strict';
import { afterEach, it } from 'vitest';
import { Application } from 'marionette';
import { Router, RouteApplication, memoryDriver } from '@mnjs/router';

const owned = [];
const own = app => { owned.push(app); return app; };
afterEach(() => { for (const app of owned.splice(0).reverse()) { app.destroy(); } });

it('preserves a current startup failure even when successful cleanup selects a replacement', async() => {
  const failure = new Error('preparation failed');
  const pages = own(new RouteApplication());
  let replacement;
  const Page = Application.extend({
    childApps: { nested: Application.extend({ onStop() { replacement = pages.switchTo('other'); } }) },
    async prepareStart() { await this.getChildApp('nested').start(); throw failure; },
  });
  pages.addChildApp('page', new Page());
  const other = pages.addChildApp('other', new Application());
  await pages.start();
  const result = await Promise.allSettled([pages.switchTo('page')]);
  assert.deepEqual(result, [{ status: 'rejected', reason: failure }]);
  assert.equal(await replacement, other);
  assert.equal(pages.getCurrent(), other);
  assert.equal(other.isRunning(), true);
});

it('cleans each failed preparation when a same-key selection survives successful cleanup', async() => {
  const failure = new Error('preparation failed');
  const pages = own(new RouteApplication());
  let reselected;
  let stops = 0;
  const Page = Application.extend({
    childApps: { nested: Application.extend({ onStop() {
      stops++;
      if (stops === 1) { reselected = pages.switchTo('page'); }
    } }) },
    async prepareStart() { await this.getChildApp('nested').start(); throw failure; },
  });
  const page = pages.addChildApp('page', new Page());
  await pages.start();
  await assert.rejects(pages.switchTo('page'), error => error === failure);
  assert.equal(await reselected, undefined);
  await assert.rejects(pages.switchTo('page'), error => error === failure);
  assert.equal(page.getChildApp('nested').isRunning(), false);
  assert.equal(stops, 2);
  assert.equal(pages.getCurrent(), null);
});

for (const outcome of ['resolve', 'reject']) {
  it(`keeps a same-key onStop replacement tracked when its preparation will ${outcome}`, async() => {
    const gate = Promise.withResolvers();
    const failure = new Error('replacement preparation failed');
    const firstFailure = new Error('first startup failed');
    const pages = own(new RouteApplication());
    let attempts = 0;
    let replacement;
    const Page = Application.extend({
      childApps: { nested: Application },
      async prepareStart() {
        attempts++;
        if (attempts === 2) { await this.getChildApp('nested').start(); await gate.promise; }
      },
      onStart() { if (attempts === 1) { throw firstFailure; } },
      onStop() { if (attempts === 1) { replacement = pages.switchTo('page'); } },
    });
    const page = pages.addChildApp('page', new Page());
    await pages.start();
    await assert.rejects(pages.switchTo('page'), error => error === firstFailure);
    const joined = pages.switchTo('page');
    const results = Promise.allSettled([replacement, joined]);
    gate[outcome](failure);
    if (outcome === 'resolve') {
      assert.deepEqual(await results, [{ status: 'fulfilled', value: page }, { status: 'fulfilled', value: page }]);
      assert.equal(pages.getCurrent(), page);
    } else {
      assert.deepEqual(await results, [{ status: 'rejected', reason: failure }, { status: 'rejected', reason: failure }]);
      assert.equal(page.getChildApp('nested').isRunning(), false);
      assert.equal(pages.getCurrent(), null);
    }
  });
}

it('does not clean a newer same-key activation before the old failure is observed', async() => {
  const gate = Promise.withResolvers();
  const pages = own(new RouteApplication());
  let attempts = 0;
  let replacement;
  const Page = Application.extend({
    prepareStart() { attempts++; if (attempts === 2) { return gate.promise; } },
    onStart() {
      if (attempts === 1) {
        queueMicrotask(() => this.stop());
        throw new Error('first startup failed');
      }
    },
    onStop() { if (attempts === 1) { replacement = pages.switchTo('page'); } },
  });
  const page = pages.addChildApp('page', new Page());
  await pages.start();
  assert.equal(await pages.switchTo('page'), undefined);
  gate.resolve();
  assert.equal(await replacement, page);
  assert.equal(pages.getCurrent(), page);
});

it('releases an aborted caller while another caller still awaits shared preparation', async() => {
  const gate = Promise.withResolvers();
  const controller = new AbortController();
  const pages = own(new RouteApplication());
  let signal;
  const page = pages.addChildApp('page', new (Application.extend({
    prepareStart(_options, context) { signal = context.signal; return gate.promise; },
  }))());
  await pages.start();
  let settled = false;
  const first = pages.switchTo('page', { signal: controller.signal }).then(value => { settled = true; return value; });
  const second = pages.switchTo('page');
  controller.abort();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, true);
  assert.equal(await first, undefined);
  assert.equal(signal.aborted, false);
  assert.equal(page.isRunning(), false);
  gate.resolve();
  assert.equal(await second, page);
});

it('observes late failure after the only caller aborts synchronously during startup', async() => {
  const gate = Promise.withResolvers();
  const controller = new AbortController();
  const pages = own(new RouteApplication());
  const page = pages.addChildApp('page', new (Application.extend({
    childApps: { nested: Application },
    async prepareStart() {
      controller.abort();
      await this.getChildApp('nested').start();
      await gate.promise;
    },
  }))());
  await pages.start();
  assert.equal(await pages.switchTo('page', { signal: controller.signal }), undefined);
  assert.equal(page.getChildApp('nested').isRunning(), true);
  gate.reject(new Error('late failure'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.getChildApp('nested').isRunning(), false);
  assert.equal(pages.getCurrent(), null);
});

it('lets one joined failure observer cancel another caller before it reports that failure', async() => {
  const gate = Promise.withResolvers();
  const failure = new Error('shared preparation failed');
  const controller = new AbortController();
  const pages = own(new RouteApplication());
  pages.addChildApp('page', new (Application.extend({ prepareStart() { return gate.promise; } }))());
  await pages.start();
  const first = pages.switchTo('page').catch(error => { controller.abort(); return error; });
  const cancelled = pages.switchTo('page', { signal: controller.signal });
  gate.reject(failure);
  assert.equal(await first, failure);
  assert.equal(await cancelled, undefined);
  assert.equal(pages.getCurrent(), null);
});

it('keeps the core before-stop and after-stop selection distinction', async() => {
  for (const phase of ['onBeforeStop', 'onStop']) {
    const pages = own(new RouteApplication());
    const page = pages.addChildApp('page', new Application());
    const next = pages.addChildApp('next', new Application());
    await pages.start();
    await pages.switchTo('page');
    let reselected;
    page[phase] = () => { reselected = pages.switchTo('page'); };
    assert.equal(await pages.switchTo('next'), undefined);
    assert.equal(await reselected, phase === 'onStop' ? page : undefined);
    assert.equal(page.isRunning(), phase === 'onStop');
    assert.equal(next.isRunning(), false);
    assert.equal(pages.getCurrent(), page);
    page[phase] = undefined;
    assert.equal(await pages.switchTo('page'), page);
    assert.equal(page.isRunning(), true);
  }
});

it('successful owner stop clears selection after its method hook without starting a child', async() => {
  const pages = own(new RouteApplication());
  const page = pages.addChildApp('page', new Application());
  await pages.start();
  await pages.switchTo('page');
  let reselected;
  pages.onBeforeStop = () => { reselected = pages.switchTo('page'); };
  pages.stop();
  assert.equal(await reselected, undefined);
  assert.equal(page.isRunning(), false);
  assert.equal(pages.getCurrent(), null);
});

it('requires explicit prefix params after a registered not-found fallback', async() => {
  const router = own(new Router({
    driver: memoryDriver({ url: 'https://router.test/tenant/a/unknown' }),
    routes: { '/tenant/:tenant': { children: {
      missing: { name: 'missing' }, view: { name: 'view' },
    } } },
    notFound: 'missing',
  }));
  await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'matched');
  const fallback = router.getCurrent();
  assert.deepEqual(fallback.params, { tenant: 'a' });
  assert.throws(() => router.url('view'), /tenant/);
  assert.equal(router.url('view', fallback.params), '/tenant/a/view');
  await router.navigate('missing', fallback.params).finished;
  assert.equal(router.url('view'), '/tenant/a/view', 'a real match at the fallback route has ordinary ancestry');
});

it('clears a registered mounted child using the compiled declarations', async() => {
  const contexts = [];
  const Child = RouteApplication.extend({ routes: { '': { name: 'child' } } });
  const Root = RouteApplication.extend({
    childApps: { child: Child, independent: Application },
    routes: { child: { mount: 'child' }, parent: { name: 'parent' } },
    clearMountedChild(match) {
      contexts.push(match);
      RouteApplication.prototype.clearMountedChild.call(this, match);
    },
  });
  const root = own(new Root());
  const router = own(new Router({ driver: memoryDriver({ url: 'https://router.test/outside' }) }));
  root.mountRoutes(router);
  await root.start();
  await root.getChildApp('independent').start();
  await router.start();
  await router.navigate('child').finished;
  root.routes = {};
  await router.navigate('parent').finished;
  assert.equal(root.getChildApp('child').isRunning(), false);
  assert.equal(root.getChildApp('independent').isRunning(), true);
  assert.equal(root.getCurrent(), null);
  assert.equal(contexts.at(-1), router.getCurrent());
  root.routes = { independent: { mount: 'independent' } };
  await root.switchTo('independent');
  await router.navigate('parent').finished;
  assert.equal(root.getCurrent(), root.getChildApp('independent'), 'later live declarations cannot add cleanup ownership to the snapshot');
  root.routes = { child: { mount: 'child' }, parent: { name: 'parent' } };
  await root.switchTo('independent');
  root.clearMountedChild();
  assert.equal(root.getCurrent(), root.getChildApp('independent'));
  await root.switchTo('child');
  root.clearMountedChild();
  assert.equal(root.getCurrent(), null, 'manual no-argument cleanup still uses declared mounts');
});
