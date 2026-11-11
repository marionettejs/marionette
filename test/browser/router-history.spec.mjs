import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test as base } from './fixtures.mjs';

async function loadHistory(page) {
  await page.evaluate(async() => {
    window.nativeNavigationReads = 0;
    Object.defineProperty(window, 'navigation', { configurable: true, get() {
      window.nativeNavigationReads++; throw new Error('History tests must not use the Navigation API');
    } });
    Object.defineProperty(window, 'URLPattern', { configurable: true, writable: true, value: undefined });
    const { URLPattern } = await import('urlpattern-polyfill');
    window.historyApi = await import('/router.js');
    window.usesPatternPolyfill = globalThis.URLPattern === URLPattern;
  });
}
const test = base.extend({ page: async({ page }, use) => {
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/router.js', route => route.fulfill({ path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript' }));
  await loadHistory(page);
  await use(page);
} });

test('History driver with a URLPattern polyfill owns normal Marionette feature presentation', async({ page }) => {
  const markup = '<img src=x onerror="window.historyInjected=true"><b>Item & title</b>';
  const result = await page.evaluate(async title => {
    const { Application, View, Region } = await import('marionette');
    const { default: LitDomApi } = await import('@mnjs/adapters/dom/lit-html');
    const { html } = await import('lit-html');
    const { Router, RouteApplication, historyDriver } = window.historyApi;
    const region = new Region({ el: '#content' });
    const Item = View.extend({ template: ({ value }) => html`<h1>${value}</h1>` }).setDomApi(LitDomApi);
    const frame = new Application();
    const router = frame.addChildApp('router', new Router({ driver: historyDriver(), routes: { home: { path: '/' } } }));
    const Catalog = RouteApplication.extend({ routes: { item: { path: '/items/:id', handler: 'showItem' } },
      showItem(match) { this.showView(new Item({ model: { value: match.params.id } })); } });
    const catalog = frame.addChildApp('catalog', new Catalog({ router, region }));
    try {
      await frame.start(); await catalog.start(); await router.start(); await router.getInitialDispatch();
      await router.navigate('item', { id: title }).finished;
      const view = catalog.getView();
      const shown = { running: catalog.isRunning(), named: view instanceof Item, rendered: view.isRendered(), attached: view.isAttached(),
        title: view.el.textContent, escaped: view.el.querySelector('img, b') === null };
      frame.destroy();
      return { shown, destroyed: view.isDestroyed() && router.isDestroyed() && catalog.isDestroyed(),
        nativeReads: window.nativeNavigationReads, polyfill: window.usesPatternPolyfill };
    } finally { frame.destroy(); }
  }, markup);
  expect(result).toEqual({ shown: { running: true, named: true, rendered: true, attached: true, title: markup, escaped: true },
    destroyed: true, nativeReads: 0, polyfill: true });
});

test('History Back and Forward retain known keys, dense indexes, state and required work', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const driver = historyDriver();
    const gate = Promise.withResolvers(); const entered = Promise.withResolvers();
    let hold = false;
    const router = new Router({ driver, routes: { home: { path: '/' }, item: { path: '/items/:id' } }, handler(match) {
      if (hold && match.params.id === '1') { entered.resolve(); return gate.promise; }
    } });
    try {
      await router.start(); await router.getInitialDispatch();
      await router.navigate('item', { id: 1 }, { state: { tab: 'one' } }).finished;
      const first = driver.currentEntry;
      await router.navigate('item', { id: 2 }, { state: { tab: 'two' } }).finished;
      const second = driver.currentEntry;
      hold = true;
      let settled = false; const back = router.back().then(value => { settled = true; return value; });
      await entered.promise;
      const early = { settled, key: driver.currentEntry.key, index: driver.currentEntry.index, state: router.getCurrent().state };
      gate.resolve(); const finished = await back;
      const forward = new Promise(resolve => router.once('route:ready', resolve));
      history.forward(); await forward;
      return { early: { ...early, key: early.key === first.key }, finished,
        forward: { key: driver.currentEntry.key === second.key, index: driver.currentEntry.index, state: router.getCurrent().state },
        indexes: driver.entries().map(entry => entry.index), nativeReads: window.nativeNavigationReads };
    } finally { router.destroy(); gate.resolve(); }
  });
  expect(result).toEqual({ early: { settled: false, key: true, index: 1, state: { tab: 'one' } }, finished: true,
    forward: { key: true, index: 2, state: { tab: 'two' } }, indexes: [0, 1, 2], nativeReads: 0 });
});

for (const outcome of ['ready', 'error', 'abort-error', 'redirect', 'stop']) {
  test(`duplicate History Back callers share ${outcome} readiness`, async({ page }) => {
    const result = await page.evaluate(async mode => {
      const { Router, historyDriver } = window.historyApi;
      const gate = Promise.withResolvers(); const entered = Promise.withResolvers();
      const failure = mode === 'abort-error' ? new DOMException('independent fetch abort', 'AbortError') : new Error('destination failed');
      let hold = false;
      const router = new Router({ driver: historyDriver(), routes: {
        home: { path: '/' },
        a: { path: '/a', redirect() { if (hold && mode === 'redirect') { return { name: 'final' }; } } },
        b: { path: '/b' }, final: { path: '/final' },
      }, async handler(match) {
        if (hold && (match.name === 'a' || match.name === 'final')) {
          entered.resolve(); await gate.promise;
          if (mode === 'error' || mode === 'abort-error') { throw failure; }
        }
      } });
      const observe = promise => promise.then(value => ({ value }), error => ({ name: error.name, same: error === failure }));
      try {
        await router.start(); await router.getInitialDispatch();
        await router.navigate('a').finished; await router.navigate('b').finished; hold = true;
        const one = observe(router.back()); const two = observe(router.back());
        let settled = 0; one.then(() => { settled++; }); two.then(() => { settled++; });
        await entered.promise; const early = settled;
        if (mode === 'stop') { router.stop(); }
        gate.resolve();
        return { early, outcomes: await Promise.all([one, two]), current: router.getCurrent().name, nativeReads: window.nativeNavigationReads };
      } finally { router.destroy(); gate.resolve(); }
    }, outcome);
    const expected = outcome === 'error' || outcome === 'abort-error' ? { name: outcome === 'error' ? 'Error' : 'AbortError', same: true } : { value: outcome !== 'stop' };
    expect(result).toEqual({ early: 0, outcomes: [expected, expected], current: outcome === 'redirect' ? 'final' : 'a', nativeReads: 0 });
  });
}

for (const historyMode of ['push', 'replace']) {
  for (const outcome of ['ready', 'abort-error']) {
    test(`History Back superseded by ${historyMode} keeps later ${outcome} traversal separate`, async({ page }) => {
      const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
      const result = await page.evaluate(async({ historyMode: mode, outcome: expected }) => {
        const { Router, historyDriver } = window.historyApi;
        const driver = historyDriver(); const entered = Promise.withResolvers(); const gate = Promise.withResolvers();
        const failure = new DOMException('independent later traversal failure', 'AbortError');
        const ready = []; const errors = []; let hold = false;
        const router = new Router({ driver, routes: {
          home: { path: '/' }, a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' }, d: { path: '/d' },
        }, async handler(match) {
          if (hold && match.name === 'd') { await gate.promise; }
          if (hold && match.name === 'b') {
            entered.resolve(); await gate.promise;
            if (expected === 'abort-error') { throw failure; }
          }
        } });
        router.on('route:ready', match => ready.push(match.name));
        router.on('route:error', (error, match) => errors.push({ same: error === failure, name: match.name }));
        try {
          await router.start(); await router.getInitialDispatch();
          await router.navigate('a').finished;
          await router.navigate('b', {}, { state: { page: 'b' } }).finished; const b = driver.currentEntry;
          await router.navigate('c').finished; hold = true;
          const back = router.back();
          const newer = router.navigate('d', {}, { history: mode }).finished;
          await entered.promise;
          const before = { back: await back, newer: await newer, ready: ready.slice(), errors: errors.slice(),
            key: driver.currentEntry.key === b.key, index: driver.currentEntry.index,
            path: location.pathname, state: router.getCurrent().state };
          const complete = new Promise(resolve => router.once(expected === 'ready' ? 'route:ready' : 'route:error', resolve));
          gate.resolve(); await complete;
          return { before, ready, errors, nativeReads: window.nativeNavigationReads };
        } finally { router.destroy(); gate.resolve(); }
      }, { historyMode, outcome });
      expect(result).toEqual({ before: { back: false, newer: false, ready: ['home', 'a', 'b', 'c'], errors: [],
        key: true, index: 2, path: '/b', state: { page: 'b' } },
      ready: outcome === 'ready' ? ['home', 'a', 'b', 'c', 'b'] : ['home', 'a', 'b', 'c'],
      errors: outcome === 'ready' ? [] : [{ same: true, name: 'b' }], nativeReads: 0 });
      expect(pageErrors).toEqual([]);
    });
  }
}

test('a distinct History Back after commitment supersedes the earlier destination work', async({ page }) => {
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  const result = await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const driver = historyDriver(); const entered = Promise.withResolvers(); const gate = Promise.withResolvers();
    const ready = []; const errors = []; let hold = false;
    const router = new Router({ driver, routes: {
      home: { path: '/' }, a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' },
    }, handler(match) { if (hold && match.name === 'b') { entered.resolve(); return gate.promise; } } });
    router.on('route:ready', match => ready.push(match.name)); router.on('route:error', error => errors.push(error.message));
    try {
      await router.start(); await router.getInitialDispatch();
      await router.navigate('a').finished; const a = driver.currentEntry;
      await router.navigate('b').finished; await router.navigate('c').finished; hold = true;
      const first = router.back(); await entered.promise;
      const second = router.back();
      const outcomes = await Promise.all([first, second]);
      gate.reject(new Error('obsolete B work')); await new Promise(resolve => setTimeout(resolve, 0));
      return { outcomes, ready, errors, key: driver.currentEntry.key === a.key, index: driver.currentEntry.index,
        path: location.pathname, current: router.getCurrent().name, nativeReads: window.nativeNavigationReads };
    } finally { router.destroy(); }
  });
  expect(result).toEqual({ outcomes: [false, true], ready: ['home', 'a', 'b', 'c', 'a'], errors: [],
    key: true, index: 1, path: '/a', current: 'a', nativeReads: 0 });
  expect(pageErrors).toEqual([]);
});

test('distinct concurrent History traversal rejects without issuing a relative second go', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver(); const owner = new AbortController();
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const arrivals = [];
    let hold = false;
    driver.addEventListener('navigate', event => event.intercept({ handler() {
      if (hold) {
        arrivals.push(new URL(event.destination.url).pathname); entered.resolve(); return gate.promise;
      }
    } }), { signal: owner.signal });
    const observe = promise => promise.then(entry => new URL(entry.url).pathname, error => error.name);
    try {
      const a = await driver.navigate('/a').finished; const b = await driver.navigate('/b').finished;
      await driver.navigate('/c').finished; hold = true;
      const first = observe(driver.traverseTo(b.key).finished);
      const rejected = await observe(driver.traverseTo(a.key).finished);
      let firstSettled = false; first.then(() => { firstSettled = true; });
      await entered.promise;
      const early = { rejected, firstSettled, key: driver.currentEntry.key === b.key, index: driver.currentEntry.index };
      gate.resolve(); await first; hold = false;
      const later = await driver.traverseTo(a.key).finished;
      return { early, first: await first, later: new URL(later.url).pathname, arrivals, nativeReads: window.nativeNavigationReads };
    } finally { owner.abort(); gate.resolve(); }
  });
  expect(result).toEqual({ early: { rejected: 'InvalidStateError', firstSettled: false, key: true, index: 2 },
    first: '/b', later: '/a', arrivals: ['/b'], nativeReads: 0 });
});

test('retained History routing resumes after a traversal arrived while stopped', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const driver = historyDriver(); const handled = [];
    const router = new Router({ driver, routes: { home: { path: '/' }, a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' } },
      handler(match) { handled.push(match.name); } });
    try {
      await router.start(); await router.getInitialDispatch();
      await router.navigate('a').finished; const a = driver.currentEntry.key;
      await router.navigate('b').finished; await router.navigate('c').finished;
      const arrived = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
      const back = router.back(); router.stop();
      const canceled = await back; await arrived;
      const detached = location.pathname;
      await router.start(); const initial = await router.getInitialDispatch();
      const subsequent = await router.back();
      return { canceled, detached, initial: initial.status, subsequent, key: driver.currentEntry.key === a,
        current: router.getCurrent().name, handled, nativeReads: window.nativeNavigationReads };
    } finally { router.destroy(); }
  });
  expect(result).toEqual({ canceled: false, detached: '/b', initial: 'matched', subsequent: true, key: true,
    current: 'a', handled: ['home', 'a', 'b', 'c', 'b', 'a'], nativeReads: 0 });
});

test('detached History traversal rejects before go and recovers after subscription', async({ page }) => {
  const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver(); const first = new AbortController(); const next = new AbortController();
    const original = history.go; let calls = 0;
    history.go = function(...args) { calls++; return original.apply(this, args); };
    const failures = async receipt => Promise.all([receipt.committed, receipt.finished].map(promise =>
      promise.then(() => 'incorrect success', error => error.name)));
    try {
      const fresh = driver.currentEntry;
      const noop = driver.traverseTo(fresh.key);
      const freshNoop = await noop.committed === fresh && await noop.finished === fresh;
      const freshFailure = await failures(driver.back());
      driver.addEventListener('navigate', event => event.intercept(), { signal: first.signal });
      const a = await driver.navigate('/a').finished; const b = await driver.navigate('/b').finished;
      first.abort();
      const detachedNoop = driver.traverseTo(b.key);
      const same = await detachedNoop.committed === b && await detachedNoop.finished === b;
      const detached = await Promise.all([failures(driver.back()), failures(driver.traverseTo(a.key))]);
      const before = { calls, path: location.pathname, key: driver.currentEntry.key === b.key };
      driver.addEventListener('navigate', event => event.intercept(), { signal: next.signal });
      const active = driver.back();
      const committed = await active.committed; const finished = await active.finished;
      const forward = await driver.traverseTo(b.key).finished;
      return { freshNoop, freshFailure, same, detached, before,
        recovery: committed.key === a.key && finished.key === a.key && forward.key === b.key,
        calls, nativeReads: window.nativeNavigationReads };
    } finally { first.abort(); next.abort(); history.go = original; }
  });
  expect(result).toEqual({ freshNoop: true, freshFailure: ['InvalidStateError', 'InvalidStateError'], same: true,
    detached: [['InvalidStateError', 'InvalidStateError'], ['InvalidStateError', 'InvalidStateError']],
    before: { calls: 0, path: '/b', key: true }, recovery: true, calls: 2, nativeReads: 0 });
  expect(pageErrors).toEqual([]);
});

for (const outcome of ['ready', 'error', 'abort-error', 'stop']) {
  test(`earlier History pop listener preserves newer ${outcome} authority`, async({ page }) => {
    const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
    const result = await page.evaluate(async mode => {
      const { Router, historyDriver } = window.historyApi;
      const driver = historyDriver(); const owner = new AbortController();
      const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const handled = []; const errors = [];
      const failure = mode === 'abort-error' ? new DOMException('independent fetch failed', 'AbortError') : new Error('newer work failed');
      let armed = false; let newer;
      window.addEventListener('popstate', () => { if (armed) { armed = false; newer = driver.navigate('/d'); } }, { signal: owner.signal });
      const router = new Router({ driver, routes: { home: { path: '/' }, a: { path: '/a' }, b: { path: '/b' }, d: { path: '/d' } }, async handler(match) {
        handled.push(match.name);
        if (match.name === 'd') {
          entered.resolve(); await gate.promise;
          if (mode === 'error' || mode === 'abort-error') { throw failure; }
        }
      } });
      router.on('route:error', (error, match) => errors.push({ same: error === failure, name: match.name }));
      try {
        await router.start(); await router.getInitialDispatch();
        await router.navigate('a').finished; await router.navigate('b').finished; armed = true;
        const back = router.back(); await entered.promise;
        const observed = newer.finished.then(entry => ({ path: new URL(entry.url).pathname }), error => ({ name: error.name, same: error === failure }));
        let settled = false; observed.then(() => { settled = true; });
        await Promise.resolve(); const early = settled;
        if (mode === 'stop') { router.stop(); }
        gate.resolve();
        const value = { early, back: await back, newer: await observed, current: router.getCurrent().name,
          handled: handled.slice(), errors: errors.slice(), nativeReads: window.nativeNavigationReads };
        if (mode !== 'stop') { value.laterBack = await router.back(); }
        return value;
      } finally { router.destroy(); owner.abort(); gate.resolve(); }
    }, outcome);
    const expectedNavigation = outcome === 'ready' ? { path: '/d' } : { name: outcome === 'error' ? 'Error' : 'AbortError', same: outcome !== 'stop' };
    expect(result).toEqual({ early: false, back: false, newer: expectedNavigation, current: 'd', handled: ['home', 'a', 'b', 'd'],
      errors: outcome === 'error' || outcome === 'abort-error' ? [{ same: true, name: 'd' }] : [], nativeReads: 0,
      ...(outcome !== 'stop' ? { laterBack: true } : {}) });
    expect(pageErrors).toEqual([]);
  });
}

test('History same-URL traversal still dispatches the distinct entry key and state', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver(); const owner = new AbortController(); const events = [];
    driver.addEventListener('navigate', event => { events.push(event); event.intercept(); }, { signal: owner.signal });
    try {
      const first = await driver.navigate('/a', { state: { version: 1 } }).finished;
      const second = await driver.navigate('/a', { history: 'push', state: { version: 2 } }).finished;
      const back = await driver.back().finished;
      return { distinct: first.key !== second.key, key: back.key === first.key, state: back.getState(), index: back.index,
        events: events.map(event => [event.navigationType, event.hashChange]), nativeReads: window.nativeNavigationReads };
    } finally { owner.abort(); }
  });
  expect(result).toEqual({ distinct: true, key: true, state: { version: 1 }, index: 1,
    events: [['push', false], ['push', false], ['traverse', false]], nativeReads: 0 });
});

for (const direction of ['back', 'forward']) {
  for (const historyMode of ['push', 'replace']) {
    test(`History ${direction} then ${historyMode} permits a new helper without stranding its receipt`, async({ page }) => {
      const pageErrors = []; page.on('pageerror', error => pageErrors.push(error.message));
      const result = await page.evaluate(async({ direction: movement, historyMode: mode }) => {
        const { historyDriver } = window.historyApi;
        const driver = historyDriver(); const owner = new AbortController();
        const arrived = Promise.withResolvers(); const gate = Promise.withResolvers(); let hold = false;
        driver.addEventListener('navigate', event => event.intercept({ handler() {
          if (hold) {
            if (event.navigationType === 'traverse') { arrived.resolve(); }
            return gate.promise;
          }
        } }), { signal: owner.signal });
        const observe = promise => promise.then(entry => ({ key: entry.key }), error => ({ error: error.name }));
        try {
          await driver.navigate('/a').finished; const b = await driver.navigate('/b').finished;
          const c = await driver.navigate('/c').finished;
          if (movement === 'forward') { await driver.back().finished; }
          hold = true;
          const old = observe(driver.traverseTo(movement === 'forward' ? c.key : b.key).finished);
          const newer = observe(driver.navigate('/d', { history: mode }).finished);
          const expected = driver.entries()[driver.currentEntry.index - 1];
          const last = observe(driver.back().finished);
          await arrived.promise; gate.resolve();
          const [oldResult, newResult, lastResult] = await Promise.all([old, newer, last]);
          return { old: oldResult.error, newer: newResult.error,
            last: lastResult.error ?? (lastResult.key === expected.key ? 'requested-key' : 'WRONG KEY'), nativeReads: window.nativeNavigationReads };
        } finally { owner.abort(); gate.resolve(); }
      }, { direction, historyMode });
      expect(result.old).toBe('AbortError'); expect(result.newer).toBe('AbortError');
      expect(direction === 'forward' && historyMode === 'push' ? ['requested-key'] : ['requested-key', 'AbortError']).toContain(result.last);
      expect(result.nativeReads).toBe(0); expect(pageErrors).toEqual([]);
    });
  }
}

test('History reload reconstruction preserves user state and starts a new known window', async({ page, candidateServer }) => {
  const html = await (await page.request.get(candidateServer)).text();
  await page.route('**/items/**', route => route.fulfill({ body: html, contentType: 'text/html' }));
  const before = await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const driver = historyDriver();
    const router = new Router({ driver, routes: { item: { path: '/items/:id' } } });
    await router.start(); await router.getInitialDispatch();
    await router.navigate('item', { id: 7 }, { state: { tab: 'saved' } }).finished;
    window.historyBeforeReload = router;
    return driver.currentEntry.key;
  });
  await page.reload(); await loadHistory(page);
  const result = await page.evaluate(async oldKey => {
    const { Router, historyDriver } = window.historyApi;
    const driver = historyDriver();
    const router = new Router({ driver, routes: { item: { path: '/items/:id' } } });
    try {
      await router.start(); const initial = await router.getInitialDispatch();
      const unknown = await driver.traverseTo(oldKey).finished.then(() => 'incorrect success', error => error.name);
      return { initial: initial.status, state: router.getCurrent().state, length: driver.entries().length,
        index: driver.currentEntry.index, differentKey: driver.currentEntry.key !== oldKey, back: await router.back(), unknown,
        nativeReads: window.nativeNavigationReads, polyfill: window.usesPatternPolyfill };
    } finally { router.destroy(); }
  }, before);
  expect(result).toEqual({ initial: 'matched', state: { tab: 'saved' }, length: 1, index: 0,
    differentKey: true, back: false, unknown: 'InvalidStateError', nativeReads: 0, polyfill: true });
});

test('History link interception respects browser gestures, targets and unclaimed links', async({ page }) => {
  await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const router = new Router({ driver: historyDriver(), routes: { item: { path: '/items/:id' } } });
    await router.start(); await router.getInitialDispatch();
    window.historyLinks = { router, observed: [] };
    document.querySelector('#content').innerHTML = '<a id="ordinary" href="/items/1">Item</a><a id="target" target="_blank" href="/items/2">Target</a><a id="download" download href="/items/2">Download</a><a id="unclaimed" href="/outside">Outside</a>';
    window.addEventListener('click', event => {
      window.historyLinks.observed.push({ id: event.target.id, claimed: event.defaultPrevented });
      if (!event.defaultPrevented) { event.preventDefault(); } // Keep this gesture probe in its test document.
    });
  });
  await page.locator('#ordinary').click();
  expect(await page.evaluate(() => window.historyLinks.router.getCurrent().userInitiated)).toBe(true);
  await page.locator('#ordinary').click({ modifiers: ['Control'] });
  await page.locator('#target').click(); await page.locator('#download').click(); await page.locator('#unclaimed').click();
  const result = await page.evaluate(() => {
    const value = { observed: window.historyLinks.observed, path: location.pathname, nativeReads: window.nativeNavigationReads };
    window.historyLinks.router.destroy(); return value;
  });
  expect(result).toEqual({ observed: [{ id: 'ordinary', claimed: true }, { id: 'ordinary', claimed: false },
    { id: 'target', claimed: false }, { id: 'download', claimed: false }, { id: 'unclaimed', claimed: false }], path: '/items/1', nativeReads: 0 });
});

test('History click routing detaches on stop and destruction, then rebinds once on restart', async({ page }) => {
  await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const handled = [];
    const router = new Router({ driver: historyDriver(), routes: { item: { path: '/items/:id' } }, handler(match) { handled.push(match.params.id); } });
    await router.start(); await router.getInitialDispatch();
    window.historyLifetime = { router, handled, claimed: [] };
    document.querySelector('#content').innerHTML = '<a id="one" href="/items/1">One</a><a id="two" href="/items/2">Two</a>';
    window.addEventListener('click', event => {
      window.historyLifetime.claimed.push(event.defaultPrevented);
      if (!event.defaultPrevented) { event.preventDefault(); }
    });
  });
  await page.locator('#one').click();
  await page.evaluate(() => window.historyLifetime.router.stop());
  await page.locator('#two').click();
  await page.evaluate(async() => { const { router } = window.historyLifetime; await router.start(); await router.getInitialDispatch(); });
  await page.locator('#two').click();
  await page.evaluate(() => window.historyLifetime.router.destroy());
  await page.locator('#one').click();
  expect(await page.evaluate(() => ({ claimed: window.historyLifetime.claimed, handled: window.historyLifetime.handled,
    path: location.pathname, nativeReads: window.nativeNavigationReads }))).toEqual({ claimed: [true, false, true, false],
    handled: ['1', '1', '2'], path: '/items/2', nativeReads: 0 });
});

test('History unknown entries expose a new dense window instead of invented prior history', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver(); const owner = new AbortController(); const arrived = Promise.withResolvers();
    let waiting = false;
    driver.addEventListener('navigate', event => event.intercept({ handler() { if (waiting) { arrived.resolve(event); } } }), { signal: owner.signal });
    try {
      await driver.navigate('/a', { state: { page: 'a' } }).finished;
      history.pushState({ foreign: true }, '', '/foreign');
      const foreign = { length: driver.entries().length, index: driver.currentEntry.index, state: driver.currentEntry.getState() };
      waiting = true; history.back(); const event = await arrived.promise;
      const unavailable = await driver.back().finished.then(() => 'incorrect success', error => error.name);
      return { foreign, arrived: { length: driver.entries().length, index: driver.currentEntry.index,
        path: location.pathname, state: driver.currentEntry.getState(), cancelable: event.cancelable, userInitiated: event.userInitiated }, unavailable,
      nativeReads: window.nativeNavigationReads };
    } finally { owner.abort(); }
  });
  expect(result).toEqual({ foreign: { length: 1, index: 0, state: { foreign: true } },
    arrived: { length: 1, index: 0, path: '/a', state: { page: 'a' }, cancelable: false, userInitiated: false },
    unavailable: 'InvalidStateError', nativeReads: 0 });
});

test('History state storage preserves cyclic graphs and aliases in the real browser', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver(); const owner = new AbortController();
    driver.addEventListener('navigate', event => event.intercept(), { signal: owner.signal });
    const state = { value: 1, map: new Map() }; state.self = state; state.map.set('root', state);
    try {
      await driver.navigate('/state', { state }).finished;
      const stored = driver.currentEntry.getState(); stored.value = 2;
      const unchanged = driver.currentEntry.getState().value === 1;
      owner.abort();
      const replacement = historyDriver(); const restored = replacement.currentEntry.getState();
      return { root: stored.self === stored, alias: stored.map.get('root') === stored,
        restored: restored.self === restored && restored.map.get('root') === restored,
        metadataHidden: !Object.hasOwn(restored, '@mnjs/router/history'), unchanged, nativeReads: window.nativeNavigationReads };
    } finally { owner.abort(); }
  });
  expect(result).toEqual({ root: true, alias: true, restored: true, metadataHidden: true, unchanged: true, nativeReads: 0 });
});

test('History rejects script URL navigation before executing it', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver();
    // eslint-disable-next-line no-script-url -- Verify the adapter never executes a script destination.
    const attempt = driver.navigate('javascript:window.historyScriptExecuted=true');
    return { errors: await Promise.all([attempt.committed, attempt.finished].map(promise => promise.then(() => 'incorrect success', error => error.name))),
      executed: Boolean(window.historyScriptExecuted), path: location.pathname, nativeReads: window.nativeNavigationReads };
  });
  expect(result).toEqual({ errors: ['NotSupportedError', 'NotSupportedError'], executed: false, path: '/', nativeReads: 0 });
});

test('ordinary History fragments cancel pending route work without redispatching it', async({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); const handled = []; const ready = [];
    const router = new Router({ driver: historyDriver(), routes: { home: { path: '/' }, slow: { path: '/slow' } }, handler(match) {
      handled.push(match.name); if (match.name === 'slow') { entered.resolve(); return gate.promise; }
    } });
    router.on('route:ready', match => ready.push(match.name));
    await router.start(); await router.getInitialDispatch();
    const pending = router.navigate('slow').finished; await entered.promise;
    window.historyFragment = { router, gate, pending, handled, ready };
    const link = document.body.appendChild(document.createElement('a')); link.href = '#details'; link.id = 'fragment'; link.textContent = 'Details';
  });
  await page.locator('#fragment').click(); await page.waitForURL('**/slow#details');
  const result = await page.evaluate(async() => {
    const { router, gate, pending, handled, ready } = window.historyFragment;
    const outcome = await pending; gate.reject(new Error('obsolete work')); await new Promise(resolve => setTimeout(resolve, 0));
    const value = { outcome, handled, ready, aborted: router.getCurrent().signal.aborted, nativeReads: window.nativeNavigationReads };
    router.destroy(); return value;
  });
  expect(result).toEqual({ outcome: false, handled: ['home', 'slow'], ready: ['home'], aborted: true, nativeReads: 0 });
  expect(errors).toEqual([]);
});

for (const read of [false, true]) {
  test(`History fragment classification survives public entry reads (${read})`, async({ page }) => {
    const result = await page.evaluate(async shouldRead => {
      const { Router, historyDriver } = window.historyApi;
      const driver = historyDriver(); const owner = new AbortController(); const arrived = Promise.withResolvers();
      let count = 0;
      driver.addEventListener('navigate', event => { count++; arrived.resolve(event); }, { signal: owner.signal });
      const hash = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true, signal: owner.signal }));
      const handled = [];
      const router = new Router({ driver, routes: { home: { path: '/' } }, handler(match) { handled.push(match.name); } });
      try {
        await router.start(); await router.getInitialDispatch();
        location.hash = 'details';
        if (shouldRead) { driver.currentEntry; driver.entries(); }
        const event = await arrived.promise;
        await hash; await new Promise(resolve => setTimeout(resolve, 0));
        return { count, hashChange: event.hashChange, path: new URL(event.destination.url).hash, handled, nativeReads: window.nativeNavigationReads };
      } finally { router.destroy(); owner.abort(); }
    }, read);
    expect(result).toEqual({ count: 1, hashChange: true, path: '#details', handled: ['home'], nativeReads: 0 });
  });
}

for (const read of ['currentEntry', 'entries']) {
  test(`History ${read} reset cancels obsolete route readiness`, async({ page }) => {
    const result = await page.evaluate(async method => {
      const { Router, historyDriver } = window.historyApi;
      const driver = historyDriver(); const gate = Promise.withResolvers(); const ready = [];
      const router = new Router({ driver, routes: { home: { path: '/' }, page: { path: '/page' } },
        handler(match) { if (match.name === 'page') { return gate.promise; } },
      });
      router.on('route:ready', match => ready.push(match.name));
      try {
        await router.start(); await router.getInitialDispatch();
        const pending = router.navigate('page'); await pending.committed;
        const match = router.getCurrent();
        history.pushState({ outside: true }, '', '/outside');
        const entry = method === 'currentEntry' ? driver.currentEntry : driver.entries()[0];
        const outcome = await pending.finished;
        gate.resolve(); await new Promise(resolve => setTimeout(resolve, 0));
        const canceled = { outcome, aborted: match.signal.aborted, ready: ready.slice(), path: new URL(entry.url).pathname,
          state: entry.getState(), entries: driver.entries().length };
        const recovered = await router.navigate('home').finished;
        return { canceled, recovered, nativeReads: window.nativeNavigationReads };
      } finally { gate.resolve(); router.destroy(); }
    }, read);
    expect(result).toEqual({ canceled: { outcome: false, aborted: true, ready: ['home'], path: '/outside',
      state: { outside: true }, entries: 1 }, recovered: true, nativeReads: 0 });
  });
}

test('History unknown-entry reset preserves navigation from outgoing abort work', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { historyDriver } = window.historyApi;
    const driver = historyDriver(); const owner = new AbortController(); const gate = Promise.withResolvers();
    const events = []; let newer;
    driver.addEventListener('navigate', event => {
      events.push(event);
      event.intercept({ handler: () => event.destination.url.endsWith('/slow') ? gate.promise : undefined });
      if (event.destination.url.endsWith('/slow')) {
        event.signal.addEventListener('abort', () => { newer = driver.navigate('/newer'); }, { once: true });
      }
    }, { signal: owner.signal });
    try {
      await driver.navigate('/a').finished;
      history.pushState({}, '', '/foreign');
      const pending = driver.navigate('/slow'); await pending.committed;
      const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true, signal: owner.signal }));
      history.go(-2); await popped;
      await newer.finished;
      const outcome = await pending.finished.then(() => 'unexpected success', error => error.name);
      return { outcome, handled: events.map(event => new URL(event.destination.url).pathname),
        path: location.pathname, aborted: events.at(-1).signal.aborted, nativeReads: window.nativeNavigationReads };
    } finally { gate.resolve(); owner.abort(); }
  });
  expect(result).toEqual({ outcome: 'AbortError', handled: ['/a', '/slow', '/newer'], path: '/newer', aborted: false, nativeReads: 0 });
});

for (const operation of ['navigate', 'click']) {
  test(`unclaimed History ${operation} performs a real document handoff`, async({ page }) => {
    await page.route('**/document-destination', route => route.fulfill({ body: '<!doctype html><title>Document handoff</title><p>New document</p>', contentType: 'text/html' }));
    await page.evaluate(async() => {
      const { Router, historyDriver } = window.historyApi;
      const router = new Router({ driver: historyDriver(), routes: { home: { path: '/' } } });
      await router.start(); await router.getInitialDispatch(); window.historyHandoff = router;
    });
    if (operation === 'click') {
      await page.evaluate(() => { const link = document.body.appendChild(document.createElement('a')); link.href = '/document-destination'; link.id = 'handoff'; link.textContent = 'Leave'; });
      await page.locator('#handoff').click();
    } else {
      await page.evaluate(() => { window.historyHandoff.navigate('/document-destination').finished.then(value => sessionStorage.setItem('historyHandoff', String(value))); });
    }
    await page.waitForURL('**/document-destination'); await expect(page).toHaveTitle('Document handoff');
    if (operation === 'navigate') { expect(await page.evaluate(() => sessionStorage.getItem('historyHandoff'))).toBe('false'); }
  });
}

for (const asynchronous of [false, true]) {
  test(`History ${asynchronous ? 'async' : 'sync'} fragment redirect awaits destination work`, async({ page }) => {
    const result = await page.evaluate(async deferred => {
      const { Router, historyDriver } = window.historyApi;
      history.replaceState(null, '', '/old');
      const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); const handled = [];
      const router = new Router({ driver: historyDriver(), routes: { old: { path: '/old', redirect(match) {
        const target = match.url.hash ? undefined : '#details'; return deferred ? Promise.resolve(target) : target;
      }, handler(match) { handled.push(match.url.hash); entered.resolve(); return gate.promise; } } } });
      try {
        await router.start(); const initial = router.getInitialDispatch(); let settled = false;
        initial.then(() => { settled = true; }); await entered.promise; const early = settled;
        gate.resolve(); return { early, outcome: (await initial).status, handled, path: location.pathname + location.hash, nativeReads: window.nativeNavigationReads };
      } finally { router.destroy(); gate.resolve(); }
    }, asynchronous);
    expect(result).toEqual({ early: false, outcome: 'matched', handled: ['#details'], path: '/old#details', nativeReads: 0 });
  });
}

test('completed History Match survives an ignored fragment and is canceled by real replacement or stop', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router, historyDriver } = window.historyApi;
    const driver = historyDriver(); const handled = [];
    const router = new Router({ driver, routes: { home: { path: '/' }, a: { path: '/a' }, b: { path: '/b' } },
      handler(match) { handled.push(match.name); },
    });
    try {
      await router.start(); await router.getInitialDispatch(); await router.navigate('a').finished;
      const current = router.getCurrent();
      const changed = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true }));
      location.hash = 'details'; await changed;
      const fragment = { same: router.getCurrent() === current, aborted: current.signal.aborted, handled: handled.slice() };
      await router.navigate('b').finished;
      const replacement = router.getCurrent(); const active = !replacement.signal.aborted;
      router.stop();
      return { fragment, replacement: { previousAborted: current.signal.aborted, active, stopped: replacement.signal.aborted },
        nativeReads: window.nativeNavigationReads };
    } finally { router.destroy(); }
  });
  expect(result).toEqual({ fragment: { same: true, aborted: false, handled: ['home', 'a'] },
    replacement: { previousAborted: true, active: true, stopped: true }, nativeReads: 0 });
});

for (const mode of ['auto', 'replace']) {
  test(`History ${mode} replacement exposes proposed state and preserves committed snapshots`, async({ page }) => {
    const result = await page.evaluate(async historyMode => {
      const { historyDriver } = window.historyApi;
      const driver = historyDriver(); const owner = new AbortController();
      driver.updateCurrentEntry({ state: { value: 'updated-old' } }); const old = driver.currentEntry;
      let destination; let proposed;
      driver.addEventListener('navigate', event => {
        destination = event.destination; proposed = destination.getState(); event.intercept();
      }, { signal: owner.signal });
      try {
        const input = { value: 'new', nested: { count: 1 } };
        const pending = driver.navigate('/', { history: historyMode, state: input }); input.nested.count = 2;
        await pending.finished;
        const committed = destination.getState(); destination.getState().nested.count = 99;
        const isolated = destination.getState();
        driver.updateCurrentEntry({ state: { value: 'later' } });
        return { proposed, committed, isolated, live: destination.getState(), previous: old.getState(), nativeReads: window.nativeNavigationReads };
      } finally { owner.abort(); }
    }, mode);
    expect(result).toEqual({ proposed: { value: 'new', nested: { count: 1 } }, committed: { value: 'new', nested: { count: 1 } },
      isolated: { value: 'new', nested: { count: 1 } }, live: { value: 'later' }, previous: { value: 'updated-old' }, nativeReads: 0 });
  });
}

for (const asynchronous of [false, true]) {
  for (const conditional of [false, true]) {
    test(`History ${asynchronous ? 'async' : 'sync'} replacement redirect ${conditional ? 'selects from' : 'forwards'} proposed state`, async({ page }) => {
      const result = await page.evaluate(async({ deferred, select }) => {
        const { Router, historyDriver } = window.historyApi;
        history.replaceState({ value: 'old' }, ''); let enabled = false;
        const router = new Router({ driver: historyDriver(), routes: {
          source: { path: '/', redirect(match) {
            if (!enabled) { return; }
            const target = !select || match.state.value === 'new' ? '/new' : '/old';
            return deferred ? Promise.resolve(target) : target;
          } },
          fresh: { path: '/new' }, stale: { path: '/old' },
        } });
        try {
          await router.start(); await router.getInitialDispatch(); enabled = true;
          const outcome = await router.navigate('source', {}, { history: 'replace', state: { value: 'new' } }).finished;
          return { outcome, name: router.getCurrent().name, state: router.getCurrent().state, nativeReads: window.nativeNavigationReads };
        } finally { router.destroy(); }
      }, { deferred: asynchronous, select: conditional });
      expect(result).toEqual({ outcome: true, name: 'fresh', state: { value: 'new' }, nativeReads: 0 });
    });
  }
}
