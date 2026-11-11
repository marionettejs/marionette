import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test } from './fixtures.mjs';

async function fixture(page) {
  test.skip(!await page.evaluate(() => 'navigation' in window), 'Navigation API unavailable');
  await page.route('**/router.js', route => route.fulfill({ path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript' }));
}

for (const asynchronous of [false, true]) {
  test(`native error context preserves info through ${asynchronous ? 'async' : 'sync'} redirect failures`, async({ page }) => {
    await fixture(page);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const result = await page.evaluate(async asyncLookup => {
      const { Router } = await import('/router.js');
      const shared = new DOMException('independent request failed', 'AbortError');
      let planning = false;
      const events = [];
      const hooks = [];
      const oldListeners = [];
      const Routes = Router.extend({ onRouteError(...args) { hooks.push(args); } });
      const router = new Routes({ routes: {
        home: { path: '/' },
        old: { path: '/old', redirect: () => asyncLookup ? Promise.resolve('/middle') : '/middle' },
        middle: { path: '/middle', redirect: () => ({ name: 'fail', hash: '#details' }) },
        fail: { path: '/fail', handler() { throw shared; } },
      }, intercept(url) { if (planning && url.pathname === '/fail') { throw shared; } return true; } });
      router.on('route:error', (...args) => events.push(args));
      router.on('route:error', (error, match) => oldListeners.push([error, match]));
      await router.start(); await router.getInitialDispatch();
      const observations = [];
      for (const beforeMatch of [false, true]) {
        planning = beforeMatch;
        const info = { caller: {} };
        const offset = events.length;
        const raw = await router.navigate('old', {}, { info }).finished.then(() => false, error => error === shared);
        const [error, match, context] = events[offset];
        observations.push({ raw, count: events.length - offset, sameError: error === shared, match: match?.name ?? null,
          info: context.info === info, hookContext: hooks[offset][2] === context,
          oldArgs: oldListeners[offset][0] === error && oldListeners[offset][1] === match });
        await router.navigate('home').finished;
      }
      router.destroy();
      return observations;
    }, asynchronous);
    expect(result).toEqual([false, true].map(planning => ({ raw: true, count: 1, sameError: true,
      match: planning ? null : 'fail', info: true, hookContext: true, oldArgs: true })));
    expect(pageErrors).toEqual([]);
  });
}

test('native shared Error and synchronous notification reentry retain each attempt info', async({ page }) => {
  await fixture(page);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    const shared = new Error('same failure');
    const firstInfo = { caller: 'first' };
    const secondInfo = { caller: 'second' };
    const events = [];
    const hooks = [];
    let newer;
    const Routes = Router.extend({ onRouteError(error, match, context) {
      hooks.push([error, match, context]);
      if (hooks.length === 1) { newer = this.navigate('second', {}, { info: secondInfo }); }
    } });
    const router = new Routes({ routes: {
      home: { path: '/' }, first: { path: '/first' }, second: { path: '/second', handler() { throw shared; } },
    }, intercept(url) { if (url.pathname === '/first') { throw shared; } return true; } });
    router.on('route:error', (...args) => events.push(args));
    await router.start(); await router.getInitialDispatch();
    const first = await router.navigate('first', {}, { info: firstInfo }).finished;
    const second = await newer.finished.then(() => false, error => error === shared);
    const observation = { first, second, contexts: events.map(([error, match, context], index) => ({
      shared: error === shared, match: match?.name ?? null, info: context.info === (index ? secondInfo : firstInfo),
      sameHookContext: context === hooks[index][2],
    })) };
    router.destroy();
    return observation;
  });
  expect(result).toEqual({ first: false, second: true, contexts: [
    { shared: true, match: null, info: true, sameHookContext: true },
    { shared: true, match: 'second', info: true, sameHookContext: true },
  ] });
  expect(pageErrors).toEqual([]);
});

test('native initial and refresh error contexts have absent info without inheriting prior navigation', async({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    const error = new Error('failed presentation');
    let failing = true;
    let planning = false;
    const events = [];
    const router = new Router({ routes: { home: { path: '/', handler() { if (failing) { throw error; } } } },
      intercept() { if (planning) { throw error; } return true; } });
    router.on('route:error', (...args) => events.push(args));
    await router.start();
    const initial = await router.getInitialDispatch();
    failing = false;
    await router.navigate('home', {}, { info: { previous: true } }).finished;
    failing = true;
    const refresh = await router.refresh().then(() => false, reason => reason === error);
    planning = true;
    const preflight = await router.refresh().then(() => false, reason => reason === error);
    const observation = { initial: initial.status, sameInitialError: initial.error === error, refresh, preflight,
      events: events.map(([reason, match, context]) => ({ raw: reason === error, match: match?.name ?? null,
        absentInfo: Object.hasOwn(context, 'info') && context.info === undefined })) };
    router.destroy();
    return observation;
  });
  expect(result).toEqual({ initial: 'failed', sameInitialError: true, refresh: true, preflight: true, events: [
    { raw: true, match: 'home', absentInfo: true }, { raw: true, match: 'home', absentInfo: true },
    { raw: true, match: null, absentInfo: true },
  ] });
});
