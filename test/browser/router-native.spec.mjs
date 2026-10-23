import { expect } from '@playwright/test';
import { resolve } from 'node:path';
import { test } from './fixtures.mjs';

// Built router against the fixture's packed Marionette peer. No browser profile
// or private router internals are used.
async function example(page, { initialRedirect = false, deferStart = false, customPreparation = false } = {}) {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  await page.route('**/router.js', route => route.fulfill({
    path: resolve(import.meta.dirname, '../../packages/router/dist/index.js'),
    contentType: 'text/javascript',
  }));
  await page.evaluate(async({ redirectInitially, deferInitialStart, preparesApplication }) => {
    const { Router, ChildAppSwitcher } = await import('/router.js');
    const { Application, View } = await import('marionette');
    document.head.insertAdjacentHTML('beforeend', '<style>body{margin:0;min-height:3500px}#anchor{margin-top:1800px}</style>');
    document.body.insertAdjacentHTML('beforeend', '<input id="before"><input id="target"><div id="anchor">Anchor</div>');
    const gates = new Map();
    const gate = name => {
      const pending = Promise.withResolvers();
      gates.set(name, pending);
      return pending;
    };
    const owner = new Application();
    const Page = Application.extend({
      region: '#content',
      prepareStart() { state.preparations++; return gates.get('prepare')?.promise; },
      onStart() { this.showView(new View({ template: () => '<input id="child-input">' })); },
    });
    const switcher = owner.addChildApp('content', new ChildAppSwitcher());
    switcher.addChildApp('page', new Page());
    await owner.start();
    await switcher.start();
    const state = window.routerExample = {
      gates, gate, owner, switcher, entered: [], ready: [], errors: [],
      initial: Promise.withResolvers(), preparations: 0, applicationPreparations: 0, focus: false,
    };
    if (redirectInitially) { gate('next'); }
    const RouterClass = preparesApplication ? Router.extend({
      prepareStart() { state.applicationPreparations++; return gates.get('application')?.promise; },
    }) : Router;
    const router = state.router = owner.addChildApp('router', new RouterClass({
      intercept() { if (state.failPlanning) { throw new Error('planning failed'); } return true; },
      routes: [
        { name: 'home', path: '/', redirect: redirectInitially ? () => '/next' : undefined },
        { name: 'old', path: '/old', redirect: () => '/next' },
        { name: 'async-old', path: '/async-old', redirect: async() => { await gates.get('lookup').promise; return '/next'; } },
        { name: 'page', path: '/:page' },
      ],
      async handler(match) {
        if (match.params.page === 'lazy-child') {
          state.loading = true;
          await gates.get('lazy').promise;
          match.signal.throwIfAborted();
          await switcher.switchTo('page', { signal: match.signal });
        } else if (match.params.page === 'child') {
          await switcher.switchTo('page', { signal: match.signal });
        } else {
          switcher.clear();
        }
        state.entered.push(match.params.page ?? match.name);
        await gates.get(match.params.page ?? match.name)?.promise;
        if (state.fail) { throw new Error('route failed'); }
      },
    }));
    router.on('route:ready', match => {
      state.ready.push({ initial: match.initial, type: match.navigationType, path: match.url.pathname });
      if (match.initial) { state.initial.resolve({ ready: true }); }
      if (state.focus && !match.initial) { document.querySelector('#target').focus({ preventScroll: true }); }
    });
    router.on('route:error', (error, match) => {
      state.errors.push({ error: error.message, initial: match?.initial ?? null, path: match?.url.pathname ?? null });
      if (match?.initial) { state.initial.resolve({ error: error.message }); }
    });
    if (!deferInitialStart) {
      state.start = router.start();
      await state.start;
      if (!redirectInitially) { await state.initial.promise; }
    }
  }, { redirectInitially: initialRedirect, deferInitialStart: deferStart, preparesApplication: customPreparation });
}

async function position(page, { focus: targetFocus = 'before', scroll: targetScroll = 700 } = {}) {
  await page.evaluate(async({ focus, scroll }) => {
    document.getElementById(focus).focus({ preventScroll: true });
    window.scrollTo(0, scroll);
    await new Promise(requestAnimationFrame);
  }, { focus: targetFocus, scroll: targetScroll });
}

async function snapshot(page) {
  return page.evaluate(() => ({ focus: document.activeElement.id || document.activeElement.tagName, scroll: scrollY }));
}

async function featureExample(page) {
  await example(page);
  await page.evaluate(async() => {
    const { RouteApplication } = await import('/router.js');
    const { View } = await import('marionette');
    const state = window.routerExample;
    state.featureCalls = [];
    state.featurePreparations = 0;
    const Feature = RouteApplication.extend({
      region: '#content',
      routes: {
        'feature:item': { path: '/features/:id', handler: 'showItem' },
        'feature:callback': { path: '/feature-callback/:id', handler(match, context) { return this.renderRoute(match, context, 'function'); } },
      },
      prepareStart() { state.featurePreparations++; return state.gates.get('feature-prepare')?.promise; },
      showItem(match, context) { return this.renderRoute(match, context, 'method'); },
      async renderRoute(match, { signal }, kind) {
        state.featureCalls.push({ kind, id: match.params.id, controller: this === state.feature, signal: signal === match.signal });
        const started = await this.start();
        if (!started || signal.aborted) { return; }
        await state.gates.get('feature-ui')?.promise;
        signal.throwIfAborted();
        this.showView(new View({ template: () => `<input id="feature-input" value="${match.params.id}"><p id="feature-heading">${match.params.id}</p>` }));
      },
    });
    state.feature = state.owner.addChildApp('feature', new Feature({ router: state.router }));
    // The earlier feature registration wins until destruction unmounts it.
    state.router.mount([{ name: 'feature:fallback', path: '/features/:id' }]);
  });
}

test('a declarative method handler waits for feature preparation and attached DOM without global redispatch', async({ page }) => {
  await featureExample(page);
  expect(await page.evaluate(() => ({ registered: window.routerExample.router.hasRoute('feature:item'), running: window.routerExample.feature.isRunning() })))
    .toEqual({ registered: true, running: false });
  await position(page);
  await page.evaluate(() => {
    const state = window.routerExample; state.gate('feature-prepare'); state.gate('feature-ui');
    state.featureFinished = false;
    state.featurePending = state.router.navigate('feature:item', { id: 42 }).finished.then(result => { state.featureFinished = true; return result; });
  });
  await expect.poll(() => page.evaluate(() => window.routerExample.featureCalls.length)).toBe(1);
  expect(await page.evaluate(() => window.routerExample.feature.isRunning())).toBe(false);
  expect(await page.locator('#feature-input').count()).toBe(0);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  await page.evaluate(() => window.routerExample.gates.get('feature-prepare').resolve());
  await expect.poll(() => page.evaluate(() => window.routerExample.feature.isRunning())).toBe(true);
  expect(await page.evaluate(() => window.routerExample.featureFinished)).toBe(false);
  expect(await page.locator('#feature-input').count()).toBe(0);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.gates.get('feature-ui').resolve(); return state.featurePending;
  })).toBe(true);
  expect(await page.locator('#feature-input').inputValue()).toBe('42');
  expect(await page.locator('#feature-heading').textContent()).toBe('42');
  expect(await page.evaluate(() => window.routerExample.featureCalls)).toEqual([{ kind: 'method', id: '42', controller: true, signal: true }]);
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
  expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/', '/features/42']);
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
});

test('feature routes survive stop and restart, bind function handlers once and unmount on destruction', async({ page }) => {
  await featureExample(page);
  await page.evaluate(() => window.routerExample.router.navigate('feature:item', { id: 1 }).finished);
  expect(await page.evaluate(() => {
    const state = window.routerExample; state.feature.stop();
    return { registered: state.router.hasRoute('feature:item'), routerRunning: state.router.isRunning(), featureRunning: state.feature.isRunning() };
  })).toEqual({ registered: true, routerRunning: true, featureRunning: false });
  expect(await page.locator('#feature-input').count()).toBe(0);
  await page.evaluate(() => window.routerExample.router.navigate('feature:callback', { id: 2 }).finished);
  expect(await page.evaluate(async() => {
    const state = window.routerExample; const input = document.getElementById('feature-input'); input.value = 'retained';
    const ready = state.ready.length; const restarted = await state.feature.restart();
    return { restarted, sameInput: document.getElementById('feature-input') === input, readyUnchanged: state.ready.length === ready,
      registered: state.router.hasRoute('feature:item'), preparations: state.featurePreparations };
  })).toEqual({ restarted: true, sameInput: true, readyUnchanged: true, registered: true, preparations: 3 });
  expect(await page.locator('#feature-input').inputValue()).toBe('retained');
  expect(await page.evaluate(() => window.routerExample.featureCalls)).toEqual([
    { kind: 'method', id: '1', controller: true, signal: true },
    { kind: 'function', id: '2', controller: true, signal: true },
  ]);
  expect(await page.evaluate(() => {
    const state = window.routerExample; state.feature.destroy();
    return { featureRegistered: state.owner.hasChildApp('feature'), item: state.router.hasRoute('feature:item'), callback: state.router.hasRoute('feature:callback'),
      fallback: state.router.hasRoute('feature:fallback'), routerRunning: state.router.isRunning() };
  })).toEqual({ featureRegistered: false, item: false, callback: false, fallback: true, routerRunning: true });
  expect(await page.locator('#feature-input').count()).toBe(0);
  await page.evaluate(() => window.routerExample.router.navigate('/features/3').finished);
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home', 'feature:fallback']);
  expect(await page.evaluate(() => window.routerExample.featureCalls.length)).toBe(2);
  expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/', '/features/1', '/feature-callback/2', '/features/3']);
});

test('native completion waits for child preparation, attached UI and the returned handler', async({ page }) => {
  await example(page);
  await position(page);
  await page.evaluate(() => {
    const state = window.routerExample;
    state.gate('prepare'); state.gate('child');
    state.finished = false;
    state.pending = state.router.navigate('/child').finished.then(() => { state.finished = true; });
  });
  await expect.poll(() => page.evaluate(() => window.routerExample.switcher.getChildApp('page').isRunning())).toBe(false);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  await page.evaluate(() => window.routerExample.gates.get('prepare').resolve());
  await expect(page.locator('#child-input')).toBeAttached();
  expect(await page.evaluate(() => window.routerExample.finished)).toBe(false);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  await page.evaluate(async() => { const state = window.routerExample; state.gates.get('child').resolve(); await state.pending; });
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
});

for (const focusSource of ['handler notification', 'user']) {
  test(`native completion respects focus changed by ${focusSource}`, async({ page }) => {
    await example(page);
    await position(page);
    await page.evaluate(() => {
      const state = window.routerExample; state.gate('next');
      state.pending = state.router.navigate('/next').finished;
    });
    await expect.poll(() => page.evaluate(() => window.routerExample.entered.includes('next'))).toBe(true);
    if (focusSource === 'user') { await page.keyboard.press('Tab'); } else { await page.evaluate(() => { window.routerExample.focus = true; }); }
    await page.evaluate(async() => { const state = window.routerExample; state.gates.get('next').resolve(); await state.pending; });
    expect((await snapshot(page)).focus).toBe('target');
  });
}

test('push resets viewport, traversal restores it, fragment stays native and refresh preserves UI', async({ page }) => {
  await example(page);
  await position(page);
  await page.evaluate(() => window.routerExample.router.navigate('/next').finished);
  expect((await snapshot(page)).scroll).toBe(0);
  await position(page, { scroll: 900 });
  await page.evaluate(() => window.routerExample.router.navigate('/third').finished);
  await page.evaluate(() => window.routerExample.router.back().finished);
  await expect.poll(async() => (await snapshot(page)).scroll).toBe(900);
  await position(page);
  await page.evaluate(() => window.routerExample.router.refresh());
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(await page.evaluate(() => window.routerExample.ready.at(-1).type)).toBe('replace');
  await page.evaluate(() => navigation.navigate('#anchor').finished);
  await expect.poll(async() => (await snapshot(page)).scroll).toBeGreaterThan(1000);
});

test('current failure and local stop reset focus but do not automatically scroll', async({ page }) => {
  await example(page);
  for (const shouldStop of [false, true]) {
    await position(page);
    await page.evaluate(({ stop }) => {
      const state = window.routerExample; state.gate('next'); state.fail = !stop;
      state.pending = state.router.navigate('/next').finished.then(value => ({ value }), error => ({ error: error.message }));
    }, { stop: shouldStop });
    await expect.poll(() => page.evaluate(() => window.routerExample.entered.at(-1))).toBe('next');
    const result = await page.evaluate(async({ stop }) => {
      const state = window.routerExample;
      if (stop) { state.router.stop(); }
      state.gates.get('next').resolve();
      return state.pending;
    }, { stop: shouldStop });
    expect(result).toEqual(shouldStop ? { value: false } : { error: 'route failed' });
    expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 700 });
  }
});

for (const redirectPath of ['/old', '/async-old']) {
  test(`${redirectPath} completes only after the replacement handler`, async({ page }) => {
    await example(page);
    await position(page);
    await page.evaluate(path => {
      const state = window.routerExample; state.gate('next'); state.gate('lookup');
      state.finished = false;
      state.pending = state.router.navigate(path).finished.then(value => { state.finished = true; return value; });
    }, redirectPath);
    if (redirectPath === '/async-old') { await page.evaluate(() => window.routerExample.gates.get('lookup').resolve()); }
    await expect.poll(() => page.evaluate(() => window.routerExample.entered.includes('next'))).toBe(true);
    expect(await page.evaluate(() => window.routerExample.finished)).toBe(false);
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
    expect(await page.evaluate(async() => { const state = window.routerExample; state.gates.get('next').resolve(); return state.pending; })).toBe(true);
    expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
    expect(await page.evaluate(() => location.pathname)).toBe('/next');
  });
}

for (const option of ['focusReset', 'scroll']) {
  test(`invalid ${option} rejects before native navigation changes the document`, async({ page }) => {
    await example(page);
    await position(page);
    const pageErrors = [];
    const documentRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) { documentRequests.push(request.url()); }
    });
    const result = await page.evaluate(name => {
      const state = window.routerExample;
      const before = { url: location.href, length: history.length, key: navigation.currentEntry.key };
      let error;
      try { state.router.navigate('/next', { [name]: 'bogus' }); } catch (caught) { error = { name: caught.name, message: caught.message }; }
      return { before, error, after: { url: location.href, length: history.length, key: navigation.currentEntry.key } };
    }, option);
    expect(result.error?.name).toBe('TypeError');
    expect(result.error?.message).toContain(option);
    expect(result.after).toEqual(result.before);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
    expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
    expect(documentRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await page.evaluate(() => window.routerExample.router.navigate('/next').finished);
    expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home', 'next']);
  });
}

test('planning failure rejects native completion within the same document and reports a null Match', async({ page }) => {
  await example(page);
  await position(page);
  const pageErrors = [];
  const documentRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) { documentRequests.push(request.url()); }
  });
  const identity = await page.evaluate(() => window.routerExample.identity = crypto.randomUUID());
  const result = await page.evaluate(async() => {
    const state = window.routerExample; state.failPlanning = true;
    const navigation = state.router.navigate('/planning-failure', { focusReset: 'manual', scroll: 'manual' });
    const finished = navigation.finished.then(value => ({ value }), error => ({ error: error.message }));
    return { committed: await navigation.committed, finished: await finished, errors: state.errors };
  });
  expect(result).toEqual({ committed: true, finished: { error: 'planning failed' }, errors: [{ error: 'planning failed', initial: null, path: null }] });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(await page.evaluate(() => window.routerExample?.identity)).toBe(identity);
  expect(await page.evaluate(() => location.pathname)).toBe('/planning-failure');
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
  expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/']);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(documentRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  await page.evaluate(async() => {
    const state = window.routerExample; state.failPlanning = false;
    await state.router.navigate('/next').finished;
  });
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home', 'next']);
});

for (const operation of ['stop', 'destroy']) {
  test(`parent ${operation} invalidates an initial route after Application activation completes`, async({ page }) => {
    await example(page, { deferStart: true });
    await position(page);
    expect(await page.evaluate(async() => {
      const state = window.routerExample; state.gate('home');
      state.start = state.router.start();
      return { started: await state.start, running: state.router.isRunning(), ready: state.ready.length };
    })).toEqual({ started: true, running: true, ready: 0 });
    await expect.poll(() => page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
    const result = await page.evaluate(async method => {
      const state = window.routerExample; const url = location.href;
      state.owner[method]();
      return {
        started: await state.start, running: state.router.isRunning(), destroyed: state.router.isDestroyed(),
        next: await state.router.navigate('/next').finished, sameUrl: location.href === url,
      };
    }, operation);
    expect(result).toEqual({ started: true, running: false, destroyed: operation === 'destroy', next: false, sameUrl: true });
    await page.evaluate(async() => {
      const state = window.routerExample; state.gates.get('home').resolve();
      await new Promise(requestAnimationFrame);
    });
    expect(await page.evaluate(() => window.routerExample.ready)).toEqual([]);
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  });

  test(`parent ${operation} invalidates intercepted work without a late ready notification`, async({ page }) => {
    await example(page);
    await position(page);
    await page.evaluate(() => {
      const state = window.routerExample; state.gate('slow');
      state.pending = state.router.navigate('/slow').finished;
    });
    await expect.poll(() => page.evaluate(() => window.routerExample.entered.at(-1))).toBe('slow');
    expect(await page.evaluate(async method => {
      const state = window.routerExample; state.owner[method](); state.gates.get('slow').resolve();
      return state.pending;
    }, operation)).toBe(false);
    expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/']);
    expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 700 });
  });

  test(`parent ${operation} prevents a late lazy load from activating a child`, async({ page }) => {
    await example(page);
    await page.evaluate(() => {
      const state = window.routerExample; state.gate('lazy');
      state.pending = state.router.navigate('/lazy-child').finished;
    });
    await expect.poll(() => page.evaluate(() => window.routerExample.loading)).toBe(true);
    expect(await page.evaluate(async method => {
      const state = window.routerExample; state.owner[method](); state.gates.get('lazy').resolve();
      return state.pending;
    }, operation)).toBe(false);
    expect(await page.evaluate(() => window.routerExample.preparations)).toBe(0);
    expect(await page.locator('#child-input').count()).toBe(0);
    expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/']);
  });
}

test('same-key native supersession joins child preparation and waits for the surviving route', async({ page }) => {
  await example(page);
  await position(page);
  await page.evaluate(() => {
    const state = window.routerExample; state.gate('prepare');
    state.first = state.router.navigate('/child?filter=one').finished;
  });
  await expect.poll(() => page.evaluate(() => window.routerExample.preparations)).toBe(1);
  await page.evaluate(() => {
    const state = window.routerExample;
    state.second = state.router.navigate('/child?filter=two').finished;
  });
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.gates.get('prepare').resolve();
    return { first: await state.first, second: await state.second, preparations: state.preparations };
  })).toEqual({ first: false, second: true, preparations: 1 });
  expect(await page.locator('#child-input').count()).toBe(1);
  expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/', '/child']);
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
});

test('initial route failure is reported separately, refresh retries and retained restart preserves a child', async({ page }) => {
  await example(page, { deferStart: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.fail = true;
    const started = await state.router.start();
    return { started, running: state.router.isRunning(), outcome: await state.initial.promise, errors: state.errors };
  })).toEqual({ started: true, running: true, outcome: { error: 'route failed' }, errors: [{ error: 'route failed', initial: true, path: '/' }] });
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.fail = false;
    return state.router.refresh();
  })).toBe(true);
  await page.evaluate(() => window.routerExample.router.navigate('/child').finished);
  await position(page, { focus: 'child-input', scroll: 650 });
  expect(await page.evaluate(async() => {
    const state = window.routerExample;
    const input = document.getElementById('child-input'); input.value = 'retained draft';
    const child = state.switcher.getCurrent(); const ready = state.ready.length;
    const restarted = await state.router.restart();
    return { restarted, sameChild: state.switcher.getCurrent() === child, sameInput: document.getElementById('child-input') === input,
      unchangedReadiness: state.ready.length === ready, preparations: state.preparations };
  })).toEqual({ restarted: true, sameChild: true, sameInput: true, unchangedReadiness: true, preparations: 1 });
  expect(await snapshot(page)).toEqual({ focus: 'child-input', scroll: 650 });
  expect(await page.locator('#child-input').inputValue()).toBe('retained draft');
  await page.evaluate(() => window.routerExample.router.navigate('/other').finished);
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home', 'home', 'child', 'other']);
  expect(pageErrors).toEqual([]);
});

test('ordinary subclass preparation controls activation without awaiting initial route work', async({ page }) => {
  await example(page, { deferStart: true, customPreparation: true });
  await page.evaluate(() => {
    const state = window.routerExample; state.gate('application'); state.gate('home');
    state.startSettled = false;
    state.start = state.router.start().then(result => { state.startSettled = true; return result; });
  });
  expect(await page.evaluate(() => {
    const state = window.routerExample;
    return { running: state.router.isRunning(), startSettled: state.startSettled, entered: state.entered };
  })).toEqual({ running: false, startSettled: false, entered: [] });
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.gates.get('application').resolve();
    return { started: await state.start, running: state.router.isRunning(), ready: state.ready, preparations: state.applicationPreparations };
  })).toEqual({ started: true, running: true, ready: [], preparations: 1 });
  await expect.poll(() => page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.gates.get('home').resolve();
    return state.initial.promise;
  })).toEqual({ ready: true });
});

test('superseded native completion does not reset focus, scroll or emit readiness', async({ page }) => {
  await example(page);
  await page.evaluate(() => {
    const state = window.routerExample; state.gate('slow');
    state.pending = state.router.navigate('/slow', { focusReset: 'manual', scroll: 'manual' }).finished;
  });
  await expect.poll(() => page.evaluate(() => window.routerExample.entered.includes('slow'))).toBe(true);
  await page.evaluate(async() => { const state = window.routerExample; state.focus = true; await state.router.navigate('/next').finished; });
  await position(page, { focus: 'target', scroll: 800 });
  expect(await page.evaluate(async() => { const state = window.routerExample; state.gates.get('slow').resolve(); return state.pending; })).toBe(false);
  expect(await snapshot(page)).toEqual({ focus: 'target', scroll: 800 });
  expect(await page.evaluate(() => window.routerExample.ready.map(match => match.path))).toEqual(['/', '/next']);
});

test('initial dispatch reads native activation without resetting focus or scroll, including reload', async({ page }) => {
  for (const reload of [false, true]) {
    if (reload) { await page.reload(); }
    await example(page, { deferStart: true });
    await position(page, { scroll: 600 });
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 600 });
    await page.evaluate(async() => {
      const state = window.routerExample; await state.router.start(); await state.initial.promise;
    });
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 600 });
    expect(await page.evaluate(() => window.routerExample.ready[0].type)).toBe(await page.evaluate(() => navigation.activation?.navigationType ?? 'push'));
    if (reload) { expect(await page.evaluate(() => window.routerExample.ready[0].type)).toBe('reload'); }
  }
});


test('an initial redirect finishes its native replacement separately from Application activation', async({ page }) => {
  await example(page, { initialRedirect: true });
  await expect.poll(() => page.evaluate(() => window.routerExample.entered.includes('next'))).toBe(true);
  await position(page);
  expect(await page.evaluate(() => window.routerExample.ready)).toEqual([]);
  expect(await page.evaluate(() => window.routerExample.start)).toBe(true);
  expect(await page.evaluate(() => window.routerExample.router.isRunning())).toBe(true);
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.gates.get('next').resolve(); return state.initial.promise;
  })).toEqual({ ready: true });
  expect(await page.evaluate(() => window.routerExample.ready)).toEqual([{ initial: true, type: 'replace', path: '/next' }]);
  await expect.poll(async() => (await snapshot(page)).scroll).toBe(0);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 0 });
});

test('a canceled native event neither runs the handler nor resets focus or scroll', async({ page }) => {
  await example(page);
  await position(page);
  const result = await page.evaluate(async() => {
    navigation.addEventListener('navigate', event => event.preventDefault(), { once: true });
    return window.routerExample.router.navigate('/blocked', { focusReset: 'manual', scroll: 'manual' }).finished;
  });
  expect(result).toBe(false);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
  await page.evaluate(() => window.routerExample.router.navigate('/next').finished);
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
});

test('cross-document back exposes traverse activation to initial routing', async({ page, candidateServer }) => {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  await page.route('**/away', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Other document</p>' }));
  await page.goto(`${candidateServer}/away`);
  await page.goBack();
  await example(page);
  expect(await page.evaluate(() => navigation.activation.navigationType)).toBe('traverse');
  expect(await page.evaluate(() => window.routerExample.ready[0].type)).toBe('traverse');
});

test('native defaults can reset focus when focusing retained content is a no-op', async({ page }) => {
  await example(page);
  await position(page, { focus: 'target' });
  await page.evaluate(async() => {
    const state = window.routerExample; state.focus = true;
    await state.router.navigate('/next').finished;
  });
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
});


test('query replacement explicitly preserves input focus, selection and viewport', async({ page }) => {
  await example(page);
  await position(page);
  await page.evaluate(async() => {
    const field = document.getElementById('before'); field.value = 'unsaved'; field.setSelectionRange(2, 2);
    await window.routerExample.router.navigate('/next?filter=one', {
      history: 'replace', focusReset: 'manual', scroll: 'manual', info: { source: 'filter' }, state: { draft: 1 },
    }).finished;
  });
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(await page.locator('#before').inputValue()).toBe('unsaved');
  expect(await page.evaluate(() => document.getElementById('before').selectionStart)).toBe(2);
  expect(await page.evaluate(() => window.routerExample.router.getCurrent().info)).toEqual({ source: 'filter' });
  expect(await page.evaluate(() => window.routerExample.router.getCurrent().state)).toEqual({ draft: 1 });
  await page.evaluate(() => window.routerExample.router.navigate('/other').finished);
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
});

for (const policy of [
  { focusReset: 'manual' }, { scroll: 'manual' },
  { focusReset: 'after-transition', scroll: 'manual' },
  { focusReset: 'manual', scroll: 'after-transition' },
]) {
  test(`native interception applies independent policy ${JSON.stringify(policy)}`, async({ page }) => {
    await example(page);
    await position(page);
    await page.evaluate(options => window.routerExample.router.navigate('/next', options).finished, policy);
    expect(await snapshot(page)).toEqual({
      focus: policy.focusReset === 'manual' ? 'before' : 'BODY',
      scroll: policy.scroll === 'manual' ? 700 : 0,
    });
  });
}

for (const redirectPath of ['/old', '/async-old']) {
  test(`${redirectPath} inherits a policy snapshot without affecting later navigation`, async({ page }) => {
    await example(page);
    await position(page);
    await page.evaluate(path => {
      const state = window.routerExample; state.gate('lookup'); state.gate('next');
      const options = { focusReset: 'manual', scroll: 'manual' };
      state.pending = state.router.navigate(path, options).finished;
      options.focusReset = 'after-transition'; options.scroll = 'after-transition';
      state.gates.get('lookup').resolve();
    }, redirectPath);
    await expect.poll(() => page.evaluate(() => window.routerExample.entered.includes('next'))).toBe(true);
    await page.evaluate(async() => { const state = window.routerExample; state.gates.get('next').resolve(); await state.pending; });
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
    await page.evaluate(() => window.routerExample.router.navigate('/other').finished);
    expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
  });
}
