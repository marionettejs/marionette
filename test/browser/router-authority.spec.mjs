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
      const router = new Router({ driver, routes: { a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' }, d: { path: '/d' } },
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

for (const expectedAction of ['navigate', 'veto', 'stop']) {
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
      const router = new Router({ routes: { a: { path: '/a' }, b: { path: '/b' } },
        intercept(url) {
          if (enabled && url.pathname === '/a') {
            enabled = false;
            if (action === 'stop') { router.stop(); } else { newer = router.navigate('b'); }
          }
          return true;
        }, handler(match) { handled.push(match.name); } });
      try {
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
      const router = new Router({ routes: { a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' }, d: { path: '/d' } }, handler(match) {
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
    const router = new Router({ routes: { a: { path: '/a' }, b: { path: '/b' }, c: { path: '/c' } },
      intercept(url) {
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

test('native queued Back dispatch follows completed abort-listener navigation', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/home');
    const entered = Promise.withResolvers();
    const work = Promise.withResolvers();
    const handled = [];
    let newer;
    const router = new Router({ routes: { home: { path: '/home' }, a: { path: '/a' }, c: { path: '/c' } }, handler(match) {
      handled.push(match.name);
      if (match.name === 'a') {
        match.signal.addEventListener('abort', () => { newer = router.navigate('c'); }, { once: true });
        entered.resolve(); return work.promise;
      }
    } });
    try {
      await router.start(); await router.getInitialDispatch();
      const a = router.navigate('a'); await entered.promise;
      const back = router.back();
      const first = await Promise.all([a.finished, back]);
      return { outcomes: [...first, await newer.finished], current: router.getCurrent().name, path: location.pathname, handled };
    } finally { router.destroy(); work.resolve(); }
  });
  // The raw Navigation API also dispatches this queued traversal after C finishes.
  // Driver scheduling is retained; Router does not compensate history.
  expect(result).toEqual({ outcomes: [false, true, true], current: 'home', path: '/home', handled: ['home', 'a', 'c', 'home'] });
  expect(errors).toEqual([]);
});

test('native state-update observer cannot replace a newer match state', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/a');
    let newer;
    const router = new Router({ routes: { a: { path: '/a' }, b: { path: '/b' } } });
    const change = () => { newer = router.navigate('b', {}, { history: 'replace', state: { resource: 'b' } }); };
    try {
      await router.start(); await router.getInitialDispatch();
      navigation.addEventListener('currententrychange', change, { once: true });
      router.updateState({ tab: 'a' });
      return { outcome: await newer.finished, current: router.getCurrent().name,
        state: router.getCurrent().state, path: location.pathname };
    } finally { navigation.removeEventListener('currententrychange', change); router.destroy(); }
  });
  expect(result).toEqual({ outcome: true, current: 'b', state: { resource: 'b' }, path: '/b' });
});

test('native currententrychange during initial marking preserves the newer match', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const result = await page.evaluate(async() => {
    const { Router } = await import('/router.js');
    history.replaceState(null, '', '/a');
    const handled = [];
    let newer;
    const router = new Router({ routes: { a: { path: '/a' }, b: { path: '/b' } }, handler(match) { handled.push(match.name); } });
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

for (const expectedMatched of [true, false]) {
  test(`native state updates preserve ${expectedMatched ? 'owned' : 'unowned'} entry eligibility`, async({ page }) => {
    const result = await page.evaluate(async matched => {
      const { Router } = await import('/router.js');
      history.replaceState(null, '', matched ? '/a' : '/outside');
      const router = new Router({ routes: { a: { path: '/a' }, b: { path: '/b' } } });
      try {
        await router.start(); await router.getInitialDispatch();
        router.updateState({ '@mnjs/router': !matched, tab: 'details' });
        await router.navigate('b').finished;
        const eligible = router.canGoBack();
        const wentBack = await router.back();
        return { eligible, wentBack, current: router.getCurrent().name, state: router.getCurrent().state };
      } finally { router.destroy(); }
    }, expectedMatched);
    expect(result).toEqual({ eligible: expectedMatched, wentBack: expectedMatched, current: expectedMatched ? 'a' : 'b', state: expectedMatched ? { tab: 'details' } : {} });
  });
}

for (const expectedAsync of [false, true]) {
  for (const expectedInitial of [false, true]) {
    test(`native named redirect persistence is ${expectedAsync ? 'async' : 'sync'} and ${expectedInitial ? 'initial' : 'subsequent'}`, async({ page }) => {
      const result = await page.evaluate(async({ asynchronous, initial }) => {
        const { Router } = await import('/router.js');
        history.replaceState(null, '', initial ? '/red?drop=1#old' : '/blue/catalog');
        const entered = Promise.withResolvers();
        const work = Promise.withResolvers();
        let paused = initial;
        const router = new Router({ persistParams: ['desk'], routes: {
          desk: { path: '/:desk', redirect() { const target = { name: 'catalog' }; return asynchronous ? Promise.resolve(target) : target; } },
          catalog: { path: '/:desk/catalog', handler(match) { if (paused) { entered.resolve(match); return work.promise; } } },
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
      expect(result).toEqual({ desk: 'red', early: false, outcome: expectedInitial ? 'matched' : true, path: '/red/catalog', current: 'catalog' });
    });
  }
}
