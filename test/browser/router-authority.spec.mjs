import { expect } from '@playwright/test';
import { routerArtifactPath } from '../router/artifact.mjs';
import { test as base } from './fixtures.mjs';

const test = base.extend({ page: async({ context, candidateServer }, use) => {
  const page = await context.newPage();
  await page.route('**/favicon.ico', route => route.fulfill({ status: 204, body: '' }));
  await page.goto(candidateServer);
  await page.route('**/router.js', route => route.fulfill({ path: routerArtifactPath('dist/index.js'), contentType: 'text/javascript' }));
  try { await use(page); } finally { await page.close(); }
} });

for (const expectedOutcome of ['ready', 'error', 'abort-error', 'stop', 'last-caller', 'driver-error']) {
  test(`pending native abort reentry preserves ${expectedOutcome} authority`, async({ page }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const result = await page.evaluate(async outcome => {
      const { Router, navigationDriver } = await import('/router.js');
      history.replaceState(null, '', '/outside');
      const native = navigationDriver();
      const failure = outcome === 'abort-error' ? new DOMException('independent fetch abort', 'AbortError') : new Error('newer failure');
      const driver = { ...native, get currentEntry() { return native.currentEntry; }, navigate(target, options) {
        if (outcome === 'driver-error' && new URL(target, location.href).pathname === '/c') { throw failure; }
        return native.navigate(target, options);
      } };
      const entered = Promise.withResolvers();
      const work = Promise.withResolvers();
      const handled = [];
      const errors = [];
      let newer;
      let latest;
      const info = { source: 'abort-listener' };
      const router = new Router({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' }, '/d': { name: 'd' } },
        handler(match) {
          handled.push(match.name);
          if (match.name === 'a') {
            match.signal.addEventListener('abort', () => {
              newer = router.navigate('c', {}, { info });
              if (outcome === 'last-caller') { latest = router.navigate('d'); }
            }, { once: true });
            entered.resolve(); return work.promise;
          }
          if (match.name === 'c' && (outcome === 'error' || outcome === 'abort-error')) { throw failure; }
        } });
      router.on('route:error', (error, match, context) => errors.push({ name: error.name, same: error === failure,
        route: match.name, info: context.info === info }));
      const observe = promise => promise.then(value => ({ value }), error => ({ error: error.name, same: error === failure }));
      try {
        await router.start(); await router.getInitialDispatch();
        const a = router.navigate('a'); await entered.promise;
        const b = router.navigate('b');
        if (outcome === 'stop') { router.stop(); }
        const finished = await Promise.all([a.finished, b.finished, observe(newer.finished)]);
        const committed = await observe(newer.committed);
        if (latest) { await latest.finished; }
        work.reject(new Error('obsolete a work'));
        await new Promise(done => setTimeout(done, 0));
        return { finished, committed, handled, errors, current: router.getCurrent()?.name,
          aborted: router.getCurrent()?.signal.aborted, path: location.pathname, running: router.isRunning() };
      } finally { router.destroy(); work.resolve(); }
    }, expectedOutcome);
    const fails = expectedOutcome.endsWith('error');
    const errorName = expectedOutcome === 'abort-error' ? 'AbortError' : 'Error';
    expect(result.finished).toEqual([false, false, fails ? { error: errorName, same: true } : { value: expectedOutcome === 'ready' }]);
    expect(result.committed).toEqual(expectedOutcome === 'driver-error' ? { error: 'Error', same: true } : { value: expectedOutcome !== 'stop' && expectedOutcome !== 'last-caller' });
    expect(result.errors).toEqual(fails && expectedOutcome !== 'driver-error' ? [{ name: errorName, same: true, route: 'c', info: true }] : []);
    expect(result.handled).toEqual(['a', ...(expectedOutcome === 'stop' || expectedOutcome === 'driver-error' ? [] : [expectedOutcome === 'last-caller' ? 'd' : 'c'])]);
    if (expectedOutcome !== 'stop' && expectedOutcome !== 'driver-error') {
      expect(result.current).toBe(expectedOutcome === 'last-caller' ? 'd' : 'c');
      expect(result.path).toBe(expectedOutcome === 'last-caller' ? '/d' : '/c');
      // Native Navigation aborts its signal after a rejected intercepted handler.
      // The original operational error still rejects rather than becoming false.
      expect(result.aborted).toBe(fails);
    }
    expect(result.running).toBe(expectedOutcome !== 'stop');
    expect(pageErrors).toEqual([]);
  });
}

for (const expectedAction of ['navigate', 'veto', 'prior-veto', 'stop']) {
  test(`native refresh preflight ${expectedAction} does not reclaim stale authority`, async({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = await page.evaluate(async action => {
      const { Router } = await import('/router.js');
      history.replaceState(null, '', '/a');
      let enabled = false;
      let newer;
      const handled = [];
      const veto = event => { if (new URL(event.destination.url).pathname === '/b') { event.preventDefault(); } };
      const router = new Router({ routes: { '/a': { name: 'a' }, '/b': { name: 'b' } },
        owns(url) {
          if (enabled && url.pathname === '/a') {
            enabled = false;
            if (action === 'stop') { router.stop(); } else { newer = router.navigate('b'); }
          }
          return true;
        }, handler(match) { handled.push(match.name); } });
      try {
        if (action === 'prior-veto') { navigation.addEventListener('navigate', veto); }
        await router.start(); await router.getInitialDispatch();
        if (action === 'veto') { navigation.addEventListener('navigate', veto); }
        enabled = true;
        return { refreshed: await router.refresh(), newer: newer ? await newer.finished : null,
          path: location.pathname, current: router.getCurrent().name, handled, running: router.isRunning() };
      } finally { navigation.removeEventListener('navigate', veto); router.destroy(); }
    }, expectedAction);
    expect(result).toEqual({ refreshed: false, newer: expectedAction === 'stop' ? null : expectedAction === 'navigate',
      path: expectedAction === 'navigate' ? '/b' : '/a', current: expectedAction === 'navigate' ? 'b' : 'a',
      handled: expectedAction === 'navigate' ? ['a', 'b'] : ['a'], running: expectedAction !== 'stop' });
    expect(errors).toEqual([]);
  });
}

for (const initiallyPending of [false, true]) {
  test(`later native navigation supersedes a deferred request from ${initiallyPending ? 'initial' : 'intercepted'} work`, async({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = await page.evaluate(async initial => {
      const { Router } = await import('/router.js');
      history.replaceState(null, '', initial ? '/a' : '/outside');
      const work = Promise.withResolvers();
      const entered = Promise.withResolvers();
      const handled = [];
      let newer;
      const router = new Router({ routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' }, '/d': { name: 'd' } }, handler(match) {
        handled.push(match.name);
        if (match.name === 'a') {
          match.signal.addEventListener('abort', () => { newer = router.navigate('c'); }, { once: true });
          entered.resolve(); return work.promise;
        }
      } });
      try {
        await router.start();
        const a = initial ? router.getInitialDispatch().then(value => value.status) : router.navigate('a').finished;
        await entered.promise;
        const b = router.navigate('b');
        const latest = navigation.navigate('/d');
        return { outcomes: await Promise.all([a, b.finished, newer.finished, latest.finished.then(() => true, () => false)]),
          current: router.getCurrent().name, path: location.pathname, handled };
      } finally { router.destroy(); work.resolve(); }
    }, initiallyPending);
    expect(result).toEqual({ outcomes: [initiallyPending ? 'cancelled' : false, false, false, true],
      current: 'd', path: '/d', handled: ['a', 'd'] });
    expect(errors).toEqual([]);
  });
}

test('native queued intent supersedes refresh preflight before its navigation event', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/outside');
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const handled = [];
    let enabled = false;
    let newer;
    let refreshing;
    const router = new Router({ routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' } },
      owns(url) {
        if (enabled && url.pathname === '/a') { enabled = false; newer = router.navigate('c'); }
        return true;
      }, handler(match) {
        handled.push(match.name);
        if (match.name === 'a') {
          match.signal.addEventListener('abort', () => { refreshing = router.refresh(); }, { once: true });
          entered.resolve(); return work.promise;
        }
      } });
    try {
      await router.start(); await router.getInitialDispatch();
      const a = router.navigate('a'); await entered.promise;
      enabled = true;
      const b = router.navigate('b');
      return { outcomes: await Promise.all([a.finished, b.finished, newer.finished, refreshing]),
        current: router.getCurrent().name, path: location.pathname, handled };
    } finally { router.destroy(); work.resolve(); }
  });
  expect(result).toEqual({ outcomes: [false, false, true, false], current: 'c', path: '/c', handled: ['a', 'c'] });
});

test('later native fragment navigation supersedes deferred work without routing the hash', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/outside');
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const handled = [];
    let queued;
    const router = new Router({ routes: { '/a': { name: 'a' }, '/b': { name: 'b' }, '/c': { name: 'c' } }, handler(match) {
      handled.push(match.name);
      if (match.name === 'a') {
        match.signal.addEventListener('abort', () => { queued = router.navigate('c'); }, { once: true });
        entered.resolve(); return work.promise;
      }
    } });
    try {
      await router.start(); await router.getInitialDispatch();
      const a = router.navigate('a'); await entered.promise;
      const b = router.navigate('b');
      const fragment = navigation.navigate('/a#details');
      return { outcomes: await Promise.all([a.finished, b.finished, queued.finished, fragment.finished.then(() => true)]),
        path: location.pathname + location.hash, handled };
    } finally { router.destroy(); work.resolve(); }
  });
  expect(result).toEqual({ outcomes: [false, false, false, true], path: '/a#details', handled: ['a'] });
});

test('native queued Back dispatch follows completed abort-listener navigation', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const result = await page.evaluate(async observesNavigation => {
    const { Router } = await import('/router.js');
    const observer = observesNavigation ? (await import('/router-observer.js')).observeNavigation() : null;
    history.replaceState(null, '', '/home');
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const handled = [];
    let newer;
    const router = new Router({ ...(observer ? { driver: observer.driver } : {}), routes: { '/home': { name: 'home' }, '/a': { name: 'a' }, '/c': { name: 'c' } }, handler(match) {
      observer?.record('handler:enter', match);
      handled.push(match.name);
      if (match.name === 'a') {
        match.signal.addEventListener('abort', () => { newer = router.navigate('c'); }, { once: true });
        if (observer) {
          work.promise.then(() => observer.record('handler:fulfilled', match),
            error => observer.record('handler:rejected', match, { error: error.name }));
        }
        entered.resolve(); return work.promise;
      }
      observer?.record('handler:fulfilled', match);
    } });
    observer?.connect(router);
    try {
      await router.start(); await router.getInitialDispatch();
      const a = router.navigate('a'); await entered.promise;
      const back = router.back();
      const first = await Promise.all([a.finished, back]);
      const outcomes = [...first, await newer.finished];
      observer?.record('helpers:settled', null, { outcomes });
      return { outcomes, current: router.getCurrent().name, path: location.pathname, handled, contract: observer?.snapshot('before-cleanup') ?? null };
    } finally { observer?.stop(); router.destroy(); work.resolve(); }
  }, !!test.info().config.metadata.routerNativeTrace);
  // The raw Navigation API also dispatches this queued traversal after C finishes.
  // Driver scheduling is retained; Router does not compensate history.
  const { contract, ...outcome } = result;
  if (contract) { console.log('Router abort-reentry Back contract:', JSON.stringify(contract)); }
  expect(outcome).toEqual({ outcomes: [false, true, true], current: 'home', path: '/home', handled: ['home', 'a', 'c', 'home'] });
  expect(errors).toEqual([]);
});

test('native nested state notification keeps initial Match state current', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/a');
    const router = new Router({ routes: { '/a': { name: 'a' } } });
    const change = () => navigation.updateCurrentEntry({ state: { ...navigation.currentEntry.getState(), fromObserver: true } });
    navigation.addEventListener('currententrychange', change, { once: true });
    try {
      await router.start(); await router.getInitialDispatch();
      return router.getCurrent().state;
    } finally { navigation.removeEventListener('currententrychange', change); router.destroy(); }
  });
  expect(result).toEqual({ fromObserver: true });
});

for (const stateReadAction of ['navigate', 'stop']) {
  test(`native refresh state read can ${stateReadAction} without a stale replacement`, async({ page }) => {
    const result = await page.evaluate(async action => {
      const { Router, navigationDriver } = await import('/router.js');
      history.replaceState(null, '', '/a');
      const native = navigationDriver();
      let notify = false;
      let newer;
      const driver = { ...native, get currentEntry() {
        const entry = native.currentEntry;
        return { url: entry.url, key: entry.key, index: entry.index, getState() {
          if (notify) {
            notify = false;
            if (action === 'stop') { router.stop(); } else { newer = router.navigate('b'); }
          }
          return entry.getState();
        } };
      } };
      const router = new Router({ driver, routes: { '/a': { name: 'a' }, '/b': { name: 'b' } } });
      try {
        await router.start(); await router.getInitialDispatch(); notify = true;
        return { outcome: await router.refresh(), newer: newer ? await newer.finished : null,
          path: location.pathname, running: router.isRunning() };
      } finally { router.destroy(); }
    }, stateReadAction);
    expect(result).toEqual({ outcome: false, newer: stateReadAction === 'stop' ? null : true,
      path: stateReadAction === 'stop' ? '/a' : '/b', running: stateReadAction !== 'stop' });
  });
}

test('native currententrychange during initial marking preserves the newer match', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/a');
    const handled = [];
    let newer;
    const router = new Router({ routes: { '/a': { name: 'a' }, '/b': { name: 'b' } }, handler(match) { handled.push(match.name); } });
    const change = () => { newer = router.navigate('b'); };
    navigation.addEventListener('currententrychange', change, { once: true });
    try {
      await router.start();
      return { initial: (await router.getInitialDispatch()).status, newer: await newer.finished,
        path: location.pathname, current: router.getCurrent().name, aborted: router.getCurrent().signal.aborted, handled };
    } finally { navigation.removeEventListener('currententrychange', change); router.destroy(); }
  });
  expect(result).toEqual({ initial: 'cancelled', newer: true, path: '/b', current: 'b', aborted: false, handled: ['b'] });
  expect(errors).toEqual([]);
});

for (const expectedAsync of [false, true]) {
  for (const expectedInitial of [false, true]) {
    test(`native named redirect persistence is ${expectedAsync ? 'async' : 'sync'} and ${expectedInitial ? 'initial' : 'subsequent'}`, async({ page }) => {
      const result = await page.evaluate(async({ asynchronous, initial }) => {
        const { Router } = await import('/router.js');
        history.replaceState(null, '', initial ? '/red?drop=1#old' : '/blue/catalog');
        const entered = Promise.withResolvers();
        const work = Promise.withResolvers();
        let paused = initial;
        const router = new Router({ routes: {
          '/:desk': { name: 'desk', redirect() { const target = { name: 'catalog' }; return asynchronous ? Promise.resolve(target) : target; } },
          '/:desk/catalog': { name: 'catalog', handler(match) { if (paused) { entered.resolve(match); return work.promise; } } },
        } });
        try {
          await router.start();
          if (!initial) { await router.getInitialDispatch(); paused = true; }
          const completion = initial ? router.getInitialDispatch() : router.navigate('/red?drop=1#old').finished;
          let settled = false;
          completion.then(() => { settled = true; });
          const first = await Promise.race([entered.promise.then(match => ({ match })), completion.then(value => ({ value }))]);
          const early = settled;
          work.resolve();
          const outcome = await completion;
          return { desk: first.match?.params.desk, early, outcome: initial ? outcome.status : outcome,
            path: location.pathname + location.search + location.hash, current: router.getCurrent().name };
        } finally { router.destroy(); work.resolve(); }
      }, { asynchronous: expectedAsync, initial: expectedInitial });
      expect(result).toEqual({ desk: 'red', early: false, outcome: expectedInitial ? 'matched' : true, path: '/red/catalog?drop=1#old', current: 'catalog' });
    });
  }
}
