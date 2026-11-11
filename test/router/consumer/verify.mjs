import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { Application } from 'marionette';
import { ChildAppSwitcher, memoryDriver } from '@mnjs/router';
import { Desk, Activity } from './desk.mjs';

export async function verifyConsumer() {
  const owned = [];
  const hosts = [];
  const unhandled = [];
  const observe = error => unhandled.push(error);
  process.on('unhandledRejection', observe);
  function example(path, load) {
    const main = document.body.appendChild(document.createElement('main'));
    const side = document.body.appendChild(document.createElement('aside'));
    hosts.push(main, side);
    const driver = memoryDriver({ url: `https://desk.example${path}` });
    const desk = new Desk({ main, side, driver, load });
    owned.push(desk);
    const router = desk.getChildApp('navigation');
    const catalog = desk.getChildApp('catalog');
    const tools = desk.getChildApp('tools');
    const page = catalog.getChildApp('page');
    return { desk, router, catalog, tools, page, driver, main, side };
  }
  try {
    const first = Promise.withResolvers();
    const replacement = Promise.withResolvers();
    const second = Promise.withResolvers();
    const app = example('/blue/catalog/one', id => id === 'one' ? first.promise : second.promise);
    const errors = [];
    app.router.on('route:error', error => errors.push(error));
    assert.equal(app.catalog.isRunning(), false, 'Registration must not activate its feature');
    assert.equal(app.router.url('item', { desk: 'blue', id: 'a/b' }), '/blue/catalog/a%2Fb');
    await app.desk.start();
    assert.equal(app.catalog.isRunning(), true, 'Desk preparation starts its required Catalog');
    assert.equal(app.router.isRunning(), false, 'Router activation remains explicit');
    await app.router.start();
    const initial = app.router.getInitialDispatch();
    let ready = false;
    initial.then(() => { ready = true; });
    await turn();
    assert.equal(app.main.textContent, 'loading');
    const presentation = app.page.initialPresentation();
    const restarted = app.page.restart({ id: 'one', load: () => replacement.promise });
    await turn();
    assert.equal(ready, false, 'Original false start result must not complete required replacement presentation');
    assert.equal(app.page.initialPresentation(), presentation);
    replacement.resolve('Replacement content');
    assert.equal(await restarted, true);
    assert.equal((await initial).status, 'matched');
    assert.equal(app.main.textContent, 'Replacement content');
    first.reject(new Error('obsolete initial request'));
    await turn();
    assert.deepEqual(errors, []);

    const committed = [];
    app.router.on('route', match => committed.push(match.name));
    const next = app.router.navigate('item', { desk: 'blue', id: 'two' });
    assert.equal(await next.committed, true);
    assert.deepEqual(committed, ['item']);
    let finished = false;
    next.finished.then(() => { finished = true; });
    await turn();
    assert.equal(finished, false);
    second.reject(new Error('Handled request failure'));
    assert.equal(await next.finished, true, 'Attached handled error is a completed presentation in this example');
    assert.equal(app.main.querySelector('[data-presentation="error"]').textContent, 'Handled request failure');
    assert.deepEqual(errors, []);

    const activity = app.tools.addChildApp('activity', new Activity({
      router: app.router,
      tools: app.tools,
      region: app.tools.getRegion(),
    }));
    assert.equal(activity.isRunning(), false);
    const catalogView = app.page.getView();
    assert.equal(await app.router.navigate('activity', { desk: 'blue' }).finished, true);
    assert.equal(app.page.getView(), catalogView, 'Sidebar ownership does not follow URL ancestry');
    assert.equal(app.side.textContent, 'Activity inspector');
    assert.deepEqual(app.router.getCurrent().branch.map(entry => entry.name), ['desk', 'activity']);
    activity.stop();
    assert.equal(app.router.hasRoute('activity'), true);
    assert.equal(await app.router.refresh(), true);
    activity.destroy();
    assert.equal(app.router.hasRoute('activity'), false);
    assert.equal(app.router.getCurrent(), null);
    const recreated = app.tools.addChildApp('activity', new Activity({
      router: app.router,
      tools: app.tools,
      region: app.tools.getRegion(),
    }));
    assert.notEqual(recreated, activity, 'Explicit child registration after destruction creates a new feature');
    assert.equal(await app.router.refresh(), true);
    assert.equal(app.side.textContent, 'Activity inspector');

    const landing = example('/green/activity');
    await landing.desk.start();
    await landing.router.start();
    assert.deepEqual(await landing.router.getInitialDispatch(), { status: 'unmatched' });
    const lazy = landing.tools.addChildApp('activity', new Activity({
      router: landing.router,
      tools: landing.tools,
      region: landing.tools.getRegion(),
    }));
    assert.equal(lazy.isRunning(), false);
    assert.equal(landing.router.url('activity', { desk: 'green' }), '/green/activity');
    assert.equal(await landing.router.refresh(), true);
    assert.equal(landing.side.textContent, 'Activity inspector');
    await landing.router.navigate('item', { desk: 'green', id: 'one' }).finished;
    assert.equal(landing.main.textContent, 'Item one');
    assert.equal(landing.side.textContent, '');
    assert.equal(await landing.router.navigate('/red').finished, true);
    assert.equal(landing.driver.currentEntry.url, 'https://desk.example/red/catalog');
    assert.equal(landing.main.textContent, 'Catalog red');
    assert.equal(landing.page.isRunning(), false);
    assert.equal(landing.side.textContent, '');

    for (const operation of ['stop', 'destroy']) {
      const pending = Promise.withResolvers();
      const leaving = example('/blue/catalog/slow', () => pending.promise);
      await leaving.desk.start();
      await leaving.router.start();
      await turn();
      const outcome = leaving.router.getInitialDispatch();
      leaving.desk[operation]();
      assert.deepEqual(await outcome, { status: 'cancelled' });
      pending.reject(new Error(`late failure after owner ${operation}`));
      await turn();
      assert.equal(leaving.main.textContent, '');
    }

    const late = Promise.withResolvers();
    const retired = example('/blue/catalog/retired', () => late.promise);
    await retired.desk.start();
    await retired.router.start();
    await turn();
    retired.catalog.destroy();
    assert.deepEqual(await retired.router.getInitialDispatch(), { status: 'cancelled' });
    assert.equal(retired.router.hasRoute('item'), false);
    late.reject(new Error('late destroyed feature failure'));
    await turn();

    const original = Promise.withResolvers();
    const replacementFailure = Promise.withResolvers();
    const handled = example('/red/catalog/replacing', () => original.promise);
    await handled.desk.start();
    await handled.router.start();
    await turn();
    const replacing = handled.page.restart({ id: 'replacing', load: () => replacementFailure.promise });
    replacementFailure.reject(new Error('Replacement failed visibly'));
    assert.equal(await replacing, true);
    assert.equal((await handled.router.getInitialDispatch()).status, 'matched');
    assert.equal(handled.main.querySelector('[data-presentation="error"]').textContent, 'Replacement failed visibly');
    original.resolve('obsolete success');
    await turn();
    assert.equal(handled.main.textContent, 'Replacement failed visibly');

    const markup = '<img src=x onerror="globalThis.exampleInjected=true"><b>untrusted & text</b>';
    for (const handledError of [false, true]) {
      const escaped = example('/blue/catalog/markup', async() => {
        if (handledError) { throw new Error(markup); }
        return markup;
      });
      await escaped.desk.start();
      await escaped.router.start();
      assert.equal((await escaped.router.getInitialDispatch()).status, 'matched');
      const rendered = escaped.main.querySelector('[data-presentation]');
      assert.equal(rendered.textContent, markup);
      assert.equal(rendered.dataset.presentation, handledError ? 'error' : 'content');
      assert.equal(escaped.main.querySelector('img, b'), null, 'Content and handled errors stay text');
      const view = escaped.page.getView();
      assert.equal(view.isRendered(), true);
      escaped.desk.stop();
      assert.equal(view.isDestroyed(), true);
      assert.equal(escaped.main.textContent, '');
    }

    const shared = Promise.withResolvers();
    let preparations = 0;
    const Page = Application.extend({ prepareStart() { preparations++; return shared.promise; } });
    const pages = new ChildAppSwitcher(); owned.push(pages);
    const page = pages.addChildApp('page', new Page());
    await pages.start();
    const caller = new AbortController();
    const obsolete = pages.switchTo('page', { key: { id: 'shared' }, signal: caller.signal });
    caller.abort();
    const selecting = pages.switchTo('page', { key: { id: 'shared' } });
    shared.resolve();
    assert.equal(await obsolete, undefined);
    assert.equal(await selecting, page);
    assert.equal(preparations, 1, 'One caller abort must not cancel shared preparation');
    await turn();
    assert.deepEqual(unhandled, []);
    console.log('Installed desk consumer: optional feature registration, lazy refresh, parent URLs, stable replacement readiness, handled error, sidebar retention, owner cancellation and shared selection passed.');
  } finally {
    for (const owner of owned) { owner.destroy(); }
    for (const host of hosts) { host.remove(); }
    process.off('unhandledRejection', observe);
  }
}
