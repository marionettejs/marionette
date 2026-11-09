import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test } from './fixtures.mjs';

async function loadRouter(page) {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  await page.route('**/router.js', route => route.fulfill({ path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript' }));
}

for (const asynchronous of [false, true]) {
  test(`named redirect hashes preserve native readiness, history and cancellation with ${asynchronous ? 'async' : 'sync'} lookup`, async({ page }) => {
    await loadRouter(page);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const result = await page.evaluate(async asyncLookup => {
      const { Router } = await import('/router.js');
      let target;
      let entered;
      let work;
      let matches = 0;
      const ready = [];
      const errors = [];
      const router = new Router({ routes: {
        home: { path: '/' },
        source: { path: '/source/:id', redirect(match) {
          const named = { name: 'item', params: match.params, ...target };
          return asyncLookup ? Promise.resolve(named) : named;
        } },
        item: { path: '/items/:id', handler(match) { matches++; entered.resolve(match); return work.promise; } },
      } });
      router.on('route:ready', match => ready.push(match.name));
      router.on('route:error', error => errors.push(error.message));
      await router.start(); await router.getInitialDispatch();
      const cases = [];
      for (const hash of [undefined, 'details', '#details', '', '#', 'café/雪?x=1#inner', '%E9%9B%AA']) {
        target = { hash };
        entered = Promise.withResolvers(); work = Promise.withResolvers();
        const before = { entries: navigation.entries().length, ready: ready.length, key: navigation.currentEntry.key };
        const navigationResult = router.navigate('/source/42?discard=1#old', { state: { selected: '42' } });
        let settled = false;
        navigationResult.finished.then(() => { settled = true; });
        const match = await entered.promise;
        await Promise.resolve();
        const pending = { settled, url: location.href.slice(location.origin.length), query: match.query.size,
          aborted: match.signal.aborted, state: match.state, ready: ready.length - before.ready,
          entries: navigation.entries().length - before.entries };
        work.resolve(false);
        const finished = await navigationResult.finished;
        const committed = await navigationResult.committed;
        const destination = navigation.currentEntry;
        const back = await router.back();
        const backKey = navigation.currentEntry.key === before.key;
        await navigation.traverseTo(destination.key).finished;
        cases.push({ pending, finished, committed, back, backKey,
          url: router.getCurrent().url.href.slice(location.origin.length), state: router.getCurrent().state });
        await router.navigate('home', {}, { history: 'replace' }).finished;
      }
      target = { query: 'view=full', hash: '#details' };
      entered = Promise.withResolvers(); work = Promise.withResolvers();
      const cancelled = router.navigate('source', { id: 'cancel' }).finished;
      const obsolete = await entered.promise;
      await router.navigate('home').finished;
      const cancelledResult = await cancelled;
      work.reject(new Error('obsolete presentation'));
      await new Promise(resolve => setTimeout(resolve, 0));
      const cancellation = { result: cancelledResult, aborted: obsolete.signal.aborted,
        url: obsolete.url.href.slice(location.origin.length), current: router.getCurrent().name };
      router.destroy();
      return { cases, cancellation, errors, matches };
    }, asynchronous);
    const suffixes = ['', '#details', '#details', '', '#', '#caf%C3%A9/%E9%9B%AA?x=1#inner', '#%E9%9B%AA'];
    expect(result.cases).toEqual(suffixes.map(hash => ({
      pending: { settled: false, url: `/items/42${hash}`, query: 0, aborted: false,
        state: { selected: '42' }, ready: 0, entries: 1 },
      finished: true, committed: true, back: true, backKey: true, url: `/items/42${hash}`, state: { selected: '42' },
    })));
    expect(result.cancellation).toEqual({ result: false, aborted: true, url: '/items/cancel?view=full#details', current: 'home' });
    expect(result.errors).toEqual([]);
    expect(result.matches).toBe(15);
    expect(pageErrors).toEqual([]);
  });

  test(`initial same-path named redirect awaits its native fragment presentation with ${asynchronous ? 'async' : 'sync'} lookup`, async({ page }) => {
    await loadRouter(page);
    const result = await page.evaluate(async asyncLookup => {
      const { Router } = await import('/router.js');
      const entered = Promise.withResolvers();
      const work = Promise.withResolvers();
      const ready = [];
      const router = new Router({ routes: {
        home: { path: '/', redirect(match) {
          const target = match.url.hash ? undefined : { name: 'home', hash: '#details' };
          return asyncLookup ? Promise.resolve(target) : target;
        }, handler(match) { entered.resolve(match); return work.promise; } },
      } });
      router.on('route:ready', match => ready.push(match.url.hash));
      const entries = navigation.entries().length;
      await router.start();
      let settled = false;
      const initial = router.getInitialDispatch();
      initial.then(() => { settled = true; });
      const first = await Promise.race([entered.promise.then(match => ({ match })), initial.then(outcome => ({ outcome }))]);
      if (!first.match) { router.destroy(); return { early: first.outcome.status }; }
      const pending = { settled, initial: first.match.initial, hash: first.match.url.hash, ready: [...ready] };
      work.resolve();
      const outcome = await initial;
      const observation = { pending, status: outcome.status, current: router.getCurrent().url.hash,
        entries: navigation.entries().length - entries, ready };
      router.destroy();
      return observation;
    }, asynchronous);
    expect(result).toEqual({ pending: { settled: false, initial: true, hash: '#details', ready: [] },
      status: 'matched', current: '#details', entries: 0, ready: ['#details'] });
  });
}

test('switcher reconstruction defaults rebuild native UI while false retains shared preparation', async({ page }) => {
  await loadRouter(page);
  const result = await page.evaluate(async() => {
    const { ChildAppSwitcher } = await import('/router.js');
    const { Application, View } = await import('marionette');
    let work;
    let attempts = 0;
    const Page = Application.extend({
      region: '#content',
      prepareStart() { attempts++; return work?.promise; },
      onStart(app, options) { this.showView(new View({ template: () => options.text })); },
    });
    const Pages = ChildAppSwitcher.extend({ reconstruct: true });
    const pages = new Pages();
    const child = pages.addChildApp('page', new Page());
    await pages.start();
    await pages.switchTo('page', { key: 1, options: { text: 'first' } });
    await pages.switchTo('page', { key: 1, options: { text: 'second' } });
    const rebuilt = document.querySelector('#content').textContent;
    await pages.switchTo('page', { key: 1, reconstruct: false, options: { text: 'ignored' } });
    const retained = document.querySelector('#content').textContent;
    work = Promise.withResolvers();
    const caller = new AbortController();
    const old = pages.switchTo('page', { key: 2, signal: caller.signal, options: { text: 'shared' } });
    caller.abort();
    const current = pages.switchTo('page', { key: 2, reconstruct: false, options: { text: 'ignored' } });
    work.resolve();
    const oldUndefined = await old === undefined;
    const shared = await current === child;
    const shown = document.querySelector('#content').textContent;
    pages.destroy();
    return { rebuilt, retained, oldUndefined, shared, shown, attempts, empty: document.querySelector('#content').textContent };
  });
  expect(result).toEqual({ rebuilt: 'second', retained: 'second', oldUndefined: true, shared: true, shown: 'shared', attempts: 3, empty: '' });
});

test('ordinary feature data mounts with a local controller and explicit native owner lifetime', async({ page }) => {
  await loadRouter(page);
  await page.route('**/catalog.js', route => route.fulfill({ path: routerArtifactPath('examples/catalog/catalog.mjs'), contentType: 'text/javascript' }));
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    const { Application } = await import('marionette');
    const { Catalog, catalogRoutes } = await import('/catalog.js');
    history.replaceState(null, '', '/catalog');
    const frame = new Application();
    const router = frame.addChildApp('navigation', new Router());
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    let obsoleteSignal;
    const catalog = frame.addChildApp('catalog', new Catalog({ region: { el: '#content' }, loadItem(id, { signal }) {
      if (id === 'slow') { obsoleteSignal = signal; entered.resolve(); return work.promise; }
      return Promise.resolve(`Item ${id}`);
    } }));
    router.mount(catalogRoutes, { owner: catalog, controller: catalog });
    const activeBefore = catalog.isRunning();
    await frame.start(); await router.start();
    const initial = (await router.getInitialDispatch()).status;
    const list = document.querySelector('#content').textContent;
    await router.navigate('catalog', { id: '42' }).finished;
    catalog.stop();
    const registered = router.hasRoute('catalog');
    await router.refresh();
    const refreshed = document.querySelector('#content').textContent;
    const pending = router.navigate('catalog', { id: 'slow' }).finished;
    await entered.promise;
    catalog.destroy();
    const cancelled = await pending;
    const empty = document.querySelector('#content').textContent;
    work.reject(new Error('retired request'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const observation = { activeBefore, initial, list, registered, refreshed, cancelled, empty,
      aborted: obsoleteSignal.aborted, retired: !router.hasRoute('catalog') };
    frame.destroy();
    return observation;
  });
  expect(result).toEqual({ activeBefore: false, initial: 'matched', list: 'Catalog', registered: true,
    refreshed: 'Item 42', cancelled: false, empty: '', aborted: true, retired: true });
  expect(pageErrors).toEqual([]);
});
