import { expect } from '@playwright/test';
import { resolve } from 'node:path';
import { test } from './fixtures.mjs';

// Built router against the fixture's packed Marionette peer. No browser profile
// or private router internals are used.
async function example(page, { initialRedirect = false, deferStart = false } = {}) {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  await page.route('**/router.js', route => route.fulfill({
    path: resolve(import.meta.dirname, '../../packages/router/dist/index.js'),
    contentType: 'text/javascript',
  }));
  await page.evaluate(async({ redirectInitially, deferInitialStart }) => {
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
      prepareStart() { return gates.get('prepare')?.promise; },
      onStart() { this.showView(new View({ template: () => '<input id="child-input">' })); },
    });
    owner.addChildApp('page', new Page());
    const switcher = new ChildAppSwitcher({ owner });
    const state = window.routerExample = { gates, gate, owner, switcher, entered: [], ready: [], focus: false };
    if (redirectInitially) { gate('next'); }
    const router = state.router = new Router({
      routes: [
        { name: 'home', path: '/', redirect: redirectInitially ? () => '/next' : undefined },
        { name: 'old', path: '/old', redirect: () => '/next' },
        { name: 'async-old', path: '/async-old', redirect: async() => { await gates.get('lookup').promise; return '/next'; } },
        { name: 'page', path: '/:page' },
      ],
      async handler(match) {
        if (match.params.page === 'child') { await switcher.switchTo('page'); }
        state.entered.push(match.params.page ?? match.name);
        await gates.get(match.params.page)?.promise;
        if (state.fail) { throw new Error('route failed'); }
      },
    });
    router.on('route:ready', match => {
      state.ready.push({ initial: match.initial, type: match.navigationType, path: match.url.pathname });
      if (state.focus && !match.initial) { document.querySelector('#target').focus({ preventScroll: true }); }
    });
    if (!deferInitialStart) {
      state.start = router.start();
      if (!redirectInitially) { await state.start; }
    }
  }, { redirectInitially: initialRedirect, deferInitialStart: deferStart });
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

test('native completion waits for child preparation, attached UI and the returned handler', async({ page }) => {
  await example(page);
  await position(page);
  await page.evaluate(() => {
    const state = window.routerExample;
    state.gate('prepare'); state.gate('child');
    state.finished = false;
    state.pending = state.router.navigate('/child').finished.then(() => { state.finished = true; });
  });
  await expect.poll(() => page.evaluate(() => window.routerExample.owner.getChildApp('page').isRunning())).toBe(false);
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

test('push resets viewport, traversal restores it, fragment stays native and refresh replaces', async({ page }) => {
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
  expect(await snapshot(page)).toEqual({ focus: 'BODY', scroll: 0 });
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

test('superseded native completion does not reset focus, scroll or emit readiness', async({ page }) => {
  await example(page);
  await page.evaluate(() => {
    const state = window.routerExample; state.gate('slow');
    state.pending = state.router.navigate('/slow').finished;
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
    await page.evaluate(() => window.routerExample.router.start());
    expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 600 });
    expect(await page.evaluate(() => window.routerExample.ready[0].type)).toBe(await page.evaluate(() => navigation.activation?.navigationType ?? 'push'));
    if (reload) { expect(await page.evaluate(() => window.routerExample.ready[0].type)).toBe('reload'); }
  }
});


test('an initial redirect waits for its native replacement before startup resolves', async({ page }) => {
  await example(page, { initialRedirect: true });
  await expect.poll(() => page.evaluate(() => window.routerExample.entered.includes('next'))).toBe(true);
  await position(page);
  expect(await page.evaluate(() => window.routerExample.ready)).toEqual([]);
  expect(await page.evaluate(async() => {
    const state = window.routerExample; state.gates.get('next').resolve(); return state.start;
  })).toBe(true);
  expect(await page.evaluate(() => window.routerExample.ready)).toEqual([{ initial: true, type: 'replace', path: '/next' }]);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 0 });
});

test('a canceled native event neither runs the handler nor resets focus or scroll', async({ page }) => {
  await example(page);
  await position(page);
  const result = await page.evaluate(async() => {
    navigation.addEventListener('navigate', event => event.preventDefault(), { once: true });
    return window.routerExample.router.navigate('/blocked').finished;
  });
  expect(result).toBe(false);
  expect(await snapshot(page)).toEqual({ focus: 'before', scroll: 700 });
  expect(await page.evaluate(() => window.routerExample.entered)).toEqual(['home']);
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
