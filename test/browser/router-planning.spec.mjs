import { expect } from '@playwright/test';
import { resolve } from 'node:path';
import { test as base } from './fixtures.mjs';

// Serve the fixture icon before navigation so its unrelated 404 cannot race
// console assertions for routing work.
const test = base.extend({
  page: async({ context, candidateServer }, use) => {
    const page = await context.newPage();
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
    await page.goto(candidateServer);
    try { await use(page); } finally { await page.close(); }
  },
});

async function fixture(page) {
  await page.route('**/router.js', route => route.fulfill({ path: resolve(import.meta.dirname, '../../packages/router/dist/index.js'), contentType: 'text/javascript' }));
}

const cases = ['redirect', 'intercept', 'within'].flatMap(phase => [
  { phase, outcome: 'ready', action: 'navigate' },
  { phase, outcome: 'stopped', action: 'stop' },
]);
cases.push({ phase: 'redirect', outcome: 'failed', action: 'navigate' }, { phase: 'redirect', outcome: 'stopped', action: 'navigate' });

for (const { phase, outcome, action } of cases) {
  test(`native ${phase} planning ${action} preserves ${outcome} outcome without host errors`, async({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); } });
    await fixture(page);
    const result = await page.evaluate(async({ planning, completion, operation }) => {
      const { Router } = await import('/router.js');
      const handlers = [];
      const errors = [];
      let router;
      let newer;
      const reenter = () => { if (operation === 'stop') { router.stop(); } else { newer = router.navigate('/next'); } };
      router = new Router({ routes: {
        home: { path: '/' }, next: { path: '/next' },
        ...(planning === 'within' ? {} : { source: { path: '/source', redirect: planning === 'redirect' ? reenter : undefined } }),
      }, intercept(url) { if (planning === 'intercept' && url.pathname === '/source') { reenter(); } return true; },
      notFound: { name: 'missing', within(url) { if (planning === 'within' && url.pathname === '/source') { reenter(); return true; } return false; } },
      handler(match) {
        handlers.push(match.name);
        if (match.name === 'next' && completion === 'failed') { throw new DOMException('independent newer request', 'AbortError'); }
        if (match.name === 'next' && completion === 'stopped') { router.stop(); }
      } });
      router.on('route:error', (error, match) => errors.push({ name: error.name, message: error.message, match: match.name, aborted: match.signal.aborted }));
      await router.start(); await router.getInitialDispatch();
      const obsolete = await router.navigate('/source').finished;
      const current = newer ? await newer.finished.then(value => ({ value }), error => ({ error: { name: error.name, message: error.message } })) : null;
      await new Promise(resolveTurn => setTimeout(resolveTurn, 0));
      return { obsolete, current, path: location.pathname, handlers, errors, running: router.isRunning() };
    }, { planning: phase, completion: outcome, operation: action });
    expect(result).toEqual({
      obsolete: false,
      current: action === 'stop' ? null : outcome === 'failed' ? { error: { name: 'AbortError', message: 'independent newer request' } } : { value: outcome === 'ready' },
      path: action === 'stop' ? '/source' : '/next',
      handlers: action === 'stop' ? ['home'] : ['home', 'next'],
      errors: outcome === 'failed' ? [{ name: 'AbortError', message: 'independent newer request', match: 'next', aborted: false }] : [],
      running: outcome !== 'stopped',
    });
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
}

test('native initial-work abort callback can navigate without obsolete interception', async({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); } });
  await fixture(page);
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    const work = Promise.withResolvers();
    const handlers = [];
    const errors = [];
    let newer;
    const router = new Router({ routes: {
      home: { path: '/' }, source: { path: '/source' }, next: { path: '/next' },
    }, handler(match) {
      handlers.push(match.name);
      if (match.name === 'home') {
        match.signal.addEventListener('abort', () => { newer = router.navigate('/next'); }, { once: true });
        return work.promise;
      }
    } });
    router.on('route:error', error => errors.push(error.message));
    await router.start();
    const initial = router.getInitialDispatch();
    const obsolete = await router.navigate('/source').finished;
    const current = await newer.finished;
    const initialOutcome = await initial;
    work.reject(new Error('obsolete initial request'));
    await new Promise(resolveTurn => setTimeout(resolveTurn, 0));
    return { obsolete, current, initial: initialOutcome.status, path: location.pathname, handlers, errors };
  });
  expect(result).toEqual({ obsolete: false, current: true, initial: 'cancelled', path: '/next', handlers: ['home', 'next'], errors: [] });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('native cancelled initial redirect cannot replace its newer navigation with a stale hop', async({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); } });
  await fixture(page);
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState({}, '', '/source');
    const work = Promise.withResolvers();
    const handlers = [];
    let newer;
    const router = new Router({ routes: {
      source: { path: '/source', redirect() { newer = router.navigate('/next'); return '/stale'; } },
      next: { path: '/next' }, stale: { path: '/stale' },
    }, handler(match) { handlers.push(match.name); if (match.name === 'next') { return work.promise; } } });
    await router.start();
    const initial = await router.getInitialDispatch();
    const path = location.pathname;
    work.resolve();
    return { initial: initial.status, path, newer: await newer.finished, handlers, current: router.getCurrent().name, aborted: router.getCurrent().signal.aborted };
  });
  expect(result).toEqual({ initial: 'cancelled', path: '/next', newer: true, handlers: ['next'], current: 'next', aborted: false });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('native rejects interception of a synchronously superseded event', async({ page }) => {
  const result = await page.evaluate(async() => {
    let newer;
    let failure;
    navigation.addEventListener('navigate', event => {
      if (new URL(event.destination.url).pathname === '/source') {
        newer = navigation.navigate('/next');
        try { event.intercept(); } catch (error) { failure = error.name; }
      } else { event.intercept(); }
    });
    const obsolete = await navigation.navigate('/source').finished.then(() => null, error => error.name);
    await newer.finished;
    return { obsolete, failure, path: location.pathname };
  });
  expect(result).toEqual({ obsolete: 'AbortError', failure: 'InvalidStateError', path: '/next' });
});

for (const historyMode of ['replace', 'push']) {
  test(`native coalesced Back does not join unrelated ${historyMode} navigation`, async({ page }) => {
    await fixture(page);
    const result = await page.evaluate(async history => {
      const { Router } = await import('/router.js');
      const work = Promise.withResolvers();
      let active = false;
      let replaced = false;
      let unrelated;
      const router = new Router({ routes: {
        home: { path: '/' },
        a: { path: '/a', handler() {
          if (active && !replaced) { replaced = true; unrelated = router.navigate('c', {}, { history }); }
        } },
        b: { path: '/b' }, c: { path: '/c', handler: () => work.promise },
      } });
      await router.start(); await router.getInitialDispatch();
      await router.navigate('a').finished; await router.navigate('b').finished;
      active = true;
      const one = router.back();
      const two = router.back();
      const cancelled = await Promise.all([one, two]);
      const path = location.pathname;
      work.resolve();
      return { cancelled, path, unrelated: await unrelated.finished };
    }, historyMode);
    expect(result).toEqual({ cancelled: [false, false], path: '/c', unrelated: true });
  });
}

test('native registration retirement during planning cancels initial work without document fallback', async({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); } });
  await fixture(page);
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    const work = Promise.withResolvers();
    const handlers = [];
    const router = new Router({ routes: { home: { path: '/' } }, handler(match) { handlers.push(match.name); return work.promise; } });
    await router.start();
    const initial = router.getInitialDispatch();
    const unmount = router.mount({ source: { path: '/source', redirect() { unmount(); } } });
    const obsolete = await router.navigate('/source').finished;
    const initialOutcome = await initial;
    work.reject(new Error('obsolete initial request'));
    await new Promise(resolveTurn => setTimeout(resolveTurn, 0));
    return { obsolete, initial: initialOutcome.status, path: location.pathname, handlers };
  });
  expect(result).toEqual({ obsolete: false, initial: 'cancelled', path: '/source', handlers: ['home'] });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
