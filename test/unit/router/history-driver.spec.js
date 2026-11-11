import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Router, historyDriver } from '@mnjs/router';
import { driverConformance } from '../../router/conformance/index.js';

const META = '@mnjs/router/history';
const contexts = [];
function context(state, url = 'https://routes.example/') {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM('<!doctype html><main></main>', { url, virtualConsole: console });
  const window = dom.window;
  window.history.replaceState(state, '');
  const driver = historyDriver({ window });
  const listeners = new AbortController();
  const result = { window, driver, errors, listeners, routers: [], close() {
    for (const router of this.routers) { router.destroy(); }
    listeners.abort(); window.close();
  } };
  contexts.push(result);
  return result;
}
afterEach(() => { vi.restoreAllMocks(); for (const item of contexts.splice(0)) { item.close(); } });

driverConformance({ name: 'historyDriver', createDriver() {
  const fixture = context();
  return { driver: fixture.driver, dispose: () => fixture.close() };
}, describe, it, assert });

function intercept(fixture, handler = () => {}) {
  const events = [];
  fixture.driver.addEventListener('navigate', event => { events.push(event); event.intercept({ handler: () => handler(event) }); }, { signal: fixture.listeners.signal });
  return events;
}

it('requires a Window only when the history factory is called', () => {
  assert.throws(() => historyDriver(), /browser Window/);
});

for (const state of [undefined, null, 7, 'text', [1, { a: 2 }], new Date('2026-01-01'), new Map([['a', 1]]), { '@mnjs/router': true, nested: { a: 1 } }]) {
  it(`preserves structured-clone state (${Object.prototype.toString.call(state)}) across a fresh driver`, async() => {
    const fixture = context(state);
    const before = fixture.driver.currentEntry;
    assert.deepEqual(before.getState(), state);
    const publicState = before.getState();
    if (publicState && typeof publicState === 'object') { assert.notEqual(publicState, before.getState()); }
    const replacement = historyDriver({ window: fixture.window });
    assert.deepEqual(replacement.currentEntry.getState(), state);
    assert.notEqual(replacement.currentEntry.key, before.key);
    assert.equal(replacement.currentEntry.index, 0);
    assert.equal(replacement.entries().length, 1);
    await assert.rejects(replacement.traverseTo(before.key).finished, { name: 'InvalidStateError' });
  });
}

it('keeps plain state fields and router markers in native history while reserving its own metadata', async() => {
  const fixture = context({ existing: 1, '@mnjs/router': true });
  assert.equal(fixture.window.history.state.existing, 1);
  assert.equal(fixture.window.history.state['@mnjs/router'], true);
  assert.equal(typeof fixture.window.history.state[META].key, 'string');
  assert.deepEqual(fixture.driver.currentEntry.getState(), { existing: 1, '@mnjs/router': true });
  assert.throws(() => fixture.driver.updateCurrentEntry({ state: { [META]: false } }), /reserves/);
  await assert.rejects(fixture.driver.navigate('/a', { state: { [META]: false } }).finished, /reserves/);
  assert.deepEqual(fixture.driver.currentEntry.getState(), { existing: 1, '@mnjs/router': true });
});

it('preserves root cycles, aliases and Map references through state storage and reads', async() => {
  const state = { value: 1, list: [], map: new Map() };
  state.self = state; state.list.push(state); state.map.set('root', state);
  const fixture = context(state); intercept(fixture);
  const check = actual => {
    assert.equal(actual.self, actual);
    assert.equal(actual.list[0], actual);
    assert.equal(actual.map.get('root'), actual);
    assert.equal(Object.hasOwn(actual, META), false);
  };
  check(fixture.driver.currentEntry.getState());
  await fixture.driver.navigate('/a', { state }).finished;
  check(fixture.driver.currentEntry.getState());
  fixture.driver.updateCurrentEntry({ state });
  check(fixture.driver.currentEntry.getState());
  check(historyDriver({ window: fixture.window }).currentEntry.getState());
  assert.equal(Object.hasOwn(state, META), false);
});

it('resets the dense known window after foreign History writes and unknown traversal', async() => {
  const fixture = context();
  const { driver, window } = fixture;
  intercept(fixture);
  await driver.navigate('/a').finished;
  const known = driver.currentEntry;
  window.history.pushState({ foreign: true }, '', '/outside');
  assert.equal(driver.entries().length, 1);
  assert.equal(driver.currentEntry.index, 0);
  assert.deepEqual(driver.currentEntry.getState(), { foreign: true });
  await assert.rejects(driver.traverseTo(known.key).finished, { name: 'InvalidStateError' });
  const arrived = new Promise(resolve => driver.addEventListener('navigate', resolve, { signal: fixture.listeners.signal }));
  window.history.back();
  const event = await arrived;
  assert.equal(event.cancelable, false);
  assert.equal(event.navigationType, 'traverse');
  assert.equal(driver.entries().length, 1);
  assert.equal(driver.currentEntry.index, 0);
  assert.equal(driver.currentEntry.url, 'https://routes.example/a');
});

for (const read of ['currentEntry', 'entries']) {
  it(`cancels pending routing work when ${read} detects an unknown History entry`, async() => {
    const fixture = context(); const { driver, window } = fixture;
    const gate = Promise.withResolvers(); const ready = [];
    const router = new Router({ driver, routes: { home: { path: '/' }, page: { path: '/page' } },
      handler(match) { if (match.name === 'page') { return gate.promise; } },
    });
    fixture.routers.push(router);
    router.on('route:ready', match => ready.push(match.name));
    await router.start(); await router.getInitialDispatch();
    const pending = router.navigate('page');
    await pending.committed;
    const match = router.getCurrent();
    window.history.pushState({ foreign: true }, '', '/outside');
    try {
      const entry = read === 'currentEntry' ? driver.currentEntry : driver.entries()[0];
      assert.equal(entry.url, 'https://routes.example/outside');
      assert.equal(match.signal.aborted, true);
      assert.equal(await pending.finished, false);
    } finally { gate.resolve(); }
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(ready, ['home']);
    assert.equal(await router.navigate('home').finished, true);
  });
}

it('preserves newer routing started while a detected reset writes its metadata', async() => {
  const fixture = context(); const { driver, window } = fixture;
  const gate = Promise.withResolvers();
  const router = new Router({ driver, routes: { home: { path: '/' }, page: { path: '/page' }, newer: { path: '/newer' } },
    handler(match) { if (match.name === 'page') { return gate.promise; } },
  });
  fixture.routers.push(router);
  await router.start(); await router.getInitialDispatch();
  const pending = router.navigate('page'); await pending.committed;
  window.history.pushState({}, '', '/outside');
  const replace = window.history.replaceState.bind(window.history);
  let newer;
  vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
    replace(...args);
    if (!newer) { newer = router.navigate('newer'); }
  });
  try {
    assert.equal(driver.currentEntry.url, 'https://routes.example/newer');
    assert.equal(await newer.finished, true);
    assert.equal(await pending.finished, false);
    assert.equal(router.getCurrent().name, 'newer');
    assert.equal(router.getCurrent().signal.aborted, false);
  } finally { gate.resolve(); }
});

it('preserves navigation started by canceled work during an unknown-entry pop', async() => {
  const fixture = context(); const { driver, window } = fixture;
  const gate = Promise.withResolvers(); const events = [];
  let newer;
  driver.addEventListener('navigate', event => {
    events.push(event);
    event.intercept({ handler: () => event.destination.url.endsWith('/slow') ? gate.promise : undefined });
    if (event.destination.url.endsWith('/slow')) {
      event.signal.addEventListener('abort', () => { newer = driver.navigate('/newer'); }, { once: true });
    }
  }, { signal: fixture.listeners.signal });
  await driver.navigate('/a').finished;
  window.history.pushState({}, '', '/foreign');
  const pending = driver.navigate('/slow'); await pending.committed;
  const arrived = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  window.history.go(-2); await arrived;
  try {
    assert.equal((await newer.finished).url, 'https://routes.example/newer');
    await assert.rejects(pending.finished, { name: 'AbortError' });
    assert.equal(events.at(-1).signal.aborted, false);
    assert.deepEqual(events.map(event => new URL(event.destination.url).pathname), ['/a', '/slow', '/newer']);
  } finally { gate.resolve(); }
});

it('keeps completed History signals live while pending handlers remain cancellable', async() => {
  const fixture = context(); const { driver } = fixture;
  const gate = Promise.withResolvers();
  const events = intercept(fixture, event => event.destination.url.endsWith('/slow') ? gate.promise : undefined);
  const pending = driver.navigate('/slow'); await pending.committed;
  let settled = false;
  pending.finished.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  assert.equal(events[0].signal.aborted, false);
  gate.resolve(); await pending.finished;
  assert.equal(events[0].signal.aborted, false);
  await driver.navigate('/next').finished;
  assert.equal(events[0].signal.aborted, false);
  assert.equal(events[1].signal.aborted, false);
});

it('keeps a completed Router Match live across an ignored fragment, then cancels it on replacement or stop', async() => {
  const fixture = context(); const { driver, window } = fixture;
  const handled = [];
  const router = new Router({ driver, routes: { home: { path: '/' }, a: { path: '/a' }, b: { path: '/b' } },
    handler(match) { handled.push(match.name); },
  });
  fixture.routers.push(router);
  await router.start(); await router.getInitialDispatch();
  await router.navigate('a').finished; const current = router.getCurrent();
  const changed = new Promise(resolve => window.addEventListener('hashchange', resolve, { once: true }));
  window.location.hash = 'details'; await changed;
  assert.equal(router.getCurrent(), current);
  assert.equal(current.signal.aborted, false);
  assert.deepEqual(handled, ['home', 'a']);
  await router.navigate('b').finished;
  assert.equal(current.signal.aborted, true);
  const replacement = router.getCurrent(); assert.equal(replacement.signal.aborted, false);
  router.stop(); assert.equal(replacement.signal.aborted, true);
});

it('synthetic pagehide leaves completed signals live but cancels pending History work', async() => {
  const fixture = context(); const { driver, window } = fixture;
  const gate = Promise.withResolvers();
  const events = intercept(fixture, event => event.destination.url.endsWith('/pending') ? gate.promise : undefined);
  await driver.navigate('/complete').finished;
  window.dispatchEvent(new window.Event('pagehide'));
  assert.equal(events[0].signal.aborted, false);
  const pending = driver.navigate('/pending'); await pending.committed;
  try {
    window.dispatchEvent(new window.Event('pagehide'));
    await assert.rejects(pending.finished, { name: 'AbortError' });
    assert.equal(events[1].signal.aborted, true);
  } finally { gate.resolve(); }
});

for (const history of ['auto', 'replace']) {
  it(`exposes proposed ${history} replacement state before commit and preserves old entry snapshots`, async() => {
    const fixture = context({ value: 'old' }); const { driver } = fixture;
    const old = driver.currentEntry;
    driver.updateCurrentEntry({ state: { value: 'updated-old' } });
    const input = { value: 'new', nested: { count: 1 } }; let destination; let proposed;
    driver.addEventListener('navigate', event => {
      destination = event.destination;
      proposed = destination.getState();
      const copy = destination.getState(); if (copy.nested) { copy.nested.count = 99; }
      event.intercept();
    }, { signal: fixture.listeners.signal });
    const pending = driver.navigate('/', { history, state: input }); input.nested.count = 2;
    await pending.finished;
    assert.deepEqual(proposed, { value: 'new', nested: { count: 1 } });
    assert.deepEqual(destination.getState(), { value: 'new', nested: { count: 1 } });
    assert.deepEqual(old.getState(), { value: 'updated-old' });
    driver.updateCurrentEntry({ state: { value: 'later' } });
    assert.deepEqual(destination.getState(), { value: 'later' });
    assert.deepEqual(old.getState(), { value: 'updated-old' });
  });
}

for (const asynchronous of [false, true]) {
  for (const conditional of [false, true]) {
    it(`${asynchronous ? 'async' : 'sync'} replacement redirect ${conditional ? 'selects from' : 'forwards'} new state`, async() => {
      const fixture = context({ value: 'old' }); const { driver } = fixture;
      let enabled = false;
      const router = new Router({ driver, routes: {
        source: { path: '/', redirect(match) {
          if (!enabled) { return; }
          const target = !conditional || match.state.value === 'new' ? '/new' : '/old';
          return asynchronous ? Promise.resolve(target) : target;
        } },
        fresh: { path: '/new' }, stale: { path: '/old' },
      } });
      fixture.routers.push(router);
      await router.start(); await router.getInitialDispatch(); enabled = true;
      assert.equal(await router.navigate('source', {}, { history: 'replace', state: { value: 'new' } }).finished, true);
      assert.equal(router.getCurrent().name, 'fresh');
      assert.deepEqual(router.getCurrent().state, { value: 'new' });
    });
  }
}

it('joins duplicate traversal readiness and cancels pending work on last unsubscribe', async() => {
  const fixture = context();
  const { driver } = fixture;
  const gate = Promise.withResolvers();
  let blocked = false;
  const events = intercept(fixture, () => blocked ? gate.promise : undefined);
  await driver.navigate('/a').finished;
  await driver.navigate('/b').finished;
  blocked = true;
  const one = driver.back(); const two = driver.back();
  assert.equal(one.finished, two.finished);
  await one.committed;
  let done = false;
  one.finished.finally(() => { done = true; }).catch(() => {});
  await Promise.resolve(); assert.equal(done, false);
  fixture.listeners.abort();
  await assert.rejects(one.finished, { name: 'AbortError' });
  await assert.rejects(two.finished, { name: 'AbortError' });
  assert.equal(events.at(-1).signal.aborted, true);
  gate.reject(new Error('late obsolete work'));
});

it('rejects distinct concurrent traversal without canceling the valid request or changing its destination', async() => {
  const fixture = context(); const { driver } = fixture;
  const gate = Promise.withResolvers(); let hold = false;
  intercept(fixture, () => hold ? gate.promise : undefined);
  const a = await driver.navigate('/a').finished;
  const b = await driver.navigate('/b').finished;
  const c = await driver.navigate('/c').finished; hold = true;
  const first = driver.traverseTo(b.key);
  await assert.rejects(driver.traverseTo(a.key).finished, { name: 'InvalidStateError' });
  await assert.rejects(driver.traverseTo('unknown').finished, { name: 'InvalidStateError' });
  assert.equal(await driver.traverseTo(c.key).finished, c);
  assert.equal(await first.committed, b);
  let settled = false; first.finished.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  gate.resolve(); assert.equal(await first.finished, b);
  hold = false;
  assert.equal(await driver.traverseTo(a.key).finished, a);
});

it('permits another traversal after supersession without keeping an unobservable physical gate', async() => {
  const fixture = context(); const { driver } = fixture; intercept(fixture);
  await driver.navigate('/a').finished;
  await driver.navigate('/b').finished; const c = await driver.navigate('/c').finished;
  const back = driver.back();
  await driver.navigate('/new').finished;
  await assert.rejects(back.finished, { name: 'AbortError' });
  assert.equal(await driver.back().finished, c);
});

it('cancels a queued traversal if the owner unsubscribes before popstate', async() => {
  const fixture = context(); intercept(fixture);
  await fixture.driver.navigate('/a').finished;
  const pending = fixture.driver.back();
  fixture.listeners.abort();
  await assert.rejects(pending.finished, { name: 'AbortError' });
});

for (const operation of ['back', 'traverseTo']) {
  it(`rejects detached ${operation} before issuing go and permits traversal after rebind`, async() => {
    const fixture = context(); const { driver, window } = fixture; intercept(fixture);
    const a = await driver.navigate('/a').finished; const b = await driver.navigate('/b').finished;
    fixture.listeners.abort();
    const go = vi.spyOn(window.history, 'go');
    const result = operation === 'back' ? driver.back() : driver.traverseTo(a.key);
    assert.equal(go.mock.calls.length, 0, 'Detached helpers must not issue unobserved browser traversal');
    const outcomes = await Promise.allSettled([result.committed, result.finished]);
    assert.deepEqual(outcomes.map(outcome => [outcome.status, outcome.reason.name]), [
      ['rejected', 'InvalidStateError'], ['rejected', 'InvalidStateError'],
    ]);
    assert.equal(outcomes[0].reason, outcomes[1].reason);
    assert.equal(driver.currentEntry, b);
    const next = new AbortController();
    driver.addEventListener('navigate', event => event.intercept(), { signal: next.signal });
    try {
      const active = driver.back();
      assert.equal(await active.committed, a); assert.equal(await active.finished, a);
      assert.equal(await driver.traverseTo(b.key).finished, b);
      assert.equal(go.mock.calls.length, 2);
    } finally { next.abort(); }
  });
}

it('keeps fresh unsubscribed current-entry no-ops and rejects unavailable destinations', async() => {
  const fixture = context(); const { driver, window } = fixture;
  const current = driver.currentEntry; const go = vi.spyOn(window.history, 'go');
  const noop = driver.traverseTo(current.key);
  assert.equal(await noop.committed, current); assert.equal(await noop.finished, current);
  for (const result of [driver.back(), driver.traverseTo('unknown')]) {
    const outcomes = await Promise.allSettled([result.committed, result.finished]);
    assert.deepEqual(outcomes.map(outcome => [outcome.status, outcome.reason.name]), [
      ['rejected', 'InvalidStateError'], ['rejected', 'InvalidStateError'],
    ]);
  }
  assert.equal(go.mock.calls.length, 0);
  intercept(fixture);
  await driver.navigate('/active').finished;
  assert.equal(await driver.back().finished, current);
});

it('observes a traversal completed while detached before a retained driver binds again', async() => {
  const fixture = context(); const { driver, window } = fixture; intercept(fixture);
  const a = await driver.navigate('/a').finished;
  await driver.navigate('/b').finished; await driver.navigate('/c').finished;
  const arrived = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  const back = driver.back(); fixture.listeners.abort();
  await assert.rejects(back.finished, { name: 'AbortError' }); await arrived;
  const next = new AbortController();
  driver.addEventListener('navigate', event => event.intercept(), { signal: next.signal });
  try { assert.equal(await driver.traverseTo(a.key).finished, a); } finally { next.abort(); }
});

it('rebinds a retained driver after stop without retaining detached listeners', async() => {
  const fixture = context();
  const router = new Router({ driver: fixture.driver, routes: { a: { path: '/a' }, b: { path: '/b' } } });
  fixture.routers.push(router);
  await router.start(); await router.getInitialDispatch();
  await router.navigate('a').finished; router.stop();
  fixture.window.history.replaceState({ detached: true }, '', '/b');
  await router.start();
  assert.equal((await router.getInitialDispatch()).status, 'matched');
  assert.equal(router.getCurrent().name, 'b');
  assert.deepEqual(router.getCurrent().state, { detached: true });
  assert.equal(fixture.driver.entries().length, 1);
});

for (const failure of [new Error('handler failed'), new DOMException('independent fetch', 'AbortError')]) {
  it(`preserves operational ${failure.name} through Router error and finished`, async() => {
    const fixture = context();
    const router = new Router({ driver: fixture.driver, routes: { a: { path: '/a' } }, handler() { throw failure; } });
    fixture.routers.push(router);
    const errors = []; router.on('route:error', error => errors.push(error));
    await router.start(); await router.getInitialDispatch();
    await assert.rejects(router.navigate('a').finished, error => error === failure);
    assert.deepEqual(errors, [failure]);
    assert.equal(fixture.window.location.pathname, '/a');
  });
}

it('keeps listener lifetime, duplicate registration and dispatch removal observable', async() => {
  const fixture = context();
  const { driver } = fixture;
  const calls = [];
  const second = new AbortController();
  const first = event => { calls.push('first'); second.abort(); event.intercept(); };
  driver.addEventListener('navigate', first, { signal: fixture.listeners.signal });
  driver.addEventListener('navigate', first, { signal: fixture.listeners.signal });
  driver.addEventListener('navigate', () => calls.push('second'), { signal: second.signal });
  assert.throws(() => driver.addEventListener('other', first), /Unsupported event/);
  await driver.navigate('/a').finished;
  assert.deepEqual(calls, ['first']);
});

it('rejects invalid URL, history mode and unclonable state before changing history', async() => {
  const fixture = context(); intercept(fixture);
  const { driver } = fixture;
  for (const [url, options, expected] of [
    ['http://[', {}, 'SyntaxError'], ['/a', { history: 'wrong' }, 'TypeError'],
    // eslint-disable-next-line no-script-url -- Exercise rejection of a script URL.
    ['javascript:void(0)', {}, 'NotSupportedError'],
    ['/a', { state: () => {} }, 'DataCloneError'],
  ]) {
    await assert.rejects(driver.navigate(url, options).finished, { name: expected });
    assert.equal(driver.currentEntry.url, 'https://routes.example/');
  }
});

it('hands unclaimed programmatic navigation and reload to the browser', async() => {
  const fixture = context();
  for (const operation of [() => fixture.driver.navigate('/outside'), () => fixture.driver.navigate('/outside', { history: 'replace' }), () => fixture.driver.reload()]) {
    await assert.rejects(operation().finished, { name: 'AbortError' });
  }
  assert.equal(fixture.errors.length, 3); // JSDOM records the real Location calls it cannot implement.
});

for (const [attributes, mouse] of [
  [{}, { button: 1 }], [{}, { altKey: true }], [{}, { ctrlKey: true }], [{}, { metaKey: true }], [{}, { shiftKey: true }],
  [{ target: 'other-frame' }, {}], [{ download: '' }, {}],
  [{ href: 'https://elsewhere.example/a' }, {}], [{ href: 'mailto:test@example.test' }, {}],
  [{ href: '/#details' }, {}], [{ href: 'http://[' }, {}],
]) {
  it(`leaves browser-owned link ${JSON.stringify([attributes, mouse])} untouched`, () => {
    const fixture = context(); const events = intercept(fixture);
    const anchor = fixture.window.document.createElement('a');
    anchor.href = '/a';
    for (const [name, value] of Object.entries(attributes)) { anchor.setAttribute(name, value); }
    fixture.window.document.body.append(anchor);
    const event = new fixture.window.MouseEvent('click', { bubbles: true, cancelable: true, ...mouse });
    anchor.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(events.length, 0);
  });
}

it('intercepts delegated links, respects base URL and preserves explicit self targets', async() => {
  const fixture = context(); const events = intercept(fixture);
  fixture.window.document.head.innerHTML = '<base href="/base/" target="_blank">';
  fixture.window.document.body.innerHTML = '<a href="item" target="_SELF"><span>Item</span></a>';
  const event = new fixture.window.MouseEvent('click', { bubbles: true, cancelable: true });
  fixture.window.document.querySelector('span').dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/base/item');
  assert.equal(events[0].userInitiated, false);
  await Promise.resolve();
});

it('respects a base target and earlier prevented clicks, ignores nonlinks and forms', () => {
  const fixture = context();
  fixture.window.document.addEventListener('click', event => {
    if (event.target.id === 'prevented') { event.preventDefault(); }
  });
  const events = intercept(fixture);
  fixture.window.document.head.innerHTML = '<base target="_blank">';
  fixture.window.document.body.innerHTML = '<a href="/a">Other frame</a><a id="prevented" href="/a">Prevented</a><a>No href</a><button>Submit</button><form></form>';
  for (const node of fixture.window.document.querySelectorAll('a,button')) {
    node.dispatchEvent(new fixture.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
  const submit = new fixture.window.Event('submit', { bubbles: true, cancelable: true });
  fixture.window.document.querySelector('form').dispatchEvent(submit);
  assert.equal(submit.defaultPrevented, false);
  assert.equal(events.length, 0);
});

it('keeps an unclaimed click browser-owned but prevents a vetoed click', () => {
  const fixture = context();
  let veto = false;
  fixture.driver.addEventListener('navigate', event => { if (veto) { event.preventDefault(); } }, { signal: fixture.listeners.signal });
  const anchor = fixture.window.document.createElement('a'); anchor.href = '/outside';
  fixture.window.document.body.append(anchor);
  const first = new fixture.window.MouseEvent('click', { bubbles: true, cancelable: true });
  anchor.dispatchEvent(first); assert.equal(first.defaultPrevented, false);
  veto = true;
  const second = new fixture.window.MouseEvent('click', { bubbles: true, cancelable: true });
  anchor.dispatchEvent(second); assert.equal(second.defaultPrevented, true);
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/');
});

it('deduplicates popstate plus hashchange while accepting a standalone fragment notification', () => {
  const fixture = context(); const events = intercept(fixture);
  fixture.window.history.pushState(null, '', '/#details');
  fixture.window.dispatchEvent(new fixture.window.HashChangeEvent('hashchange'));
  assert.equal(events.length, 1); assert.equal(events[0].hashChange, true);
  fixture.window.dispatchEvent(new fixture.window.HashChangeEvent('hashchange'));
  assert.equal(events.length, 1);
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/#details');
});

for (const read of [false, true]) {
  it(`keeps fragment event classification stable with public entry reads (${read})`, async() => {
    const fixture = context(); const { driver, window } = fixture; intercept(fixture);
    const arrived = new Promise(resolve => driver.addEventListener('navigate', resolve, { signal: fixture.listeners.signal }));
    window.location.hash = 'details';
    if (read) {
      assert.equal(driver.currentEntry.url, 'https://routes.example/#details');
      driver.entries();
    }
    const event = await arrived;
    assert.equal(event.hashChange, true);
    assert.equal(event.destination.url, 'https://routes.example/#details');
  });
}

it('ignores an obsolete pop notification after an earlier host listener navigates', async() => {
  const fixture = context(); const { driver, window } = fixture;
  let armed = false; let newer;
  window.addEventListener('popstate', () => { if (armed) { armed = false; newer = driver.navigate('/newer'); } });
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); const handled = [];
  intercept(fixture, event => {
    handled.push(new URL(event.destination.url).pathname);
    if (event.destination.url.endsWith('/newer')) { entered.resolve(); return gate.promise; }
  });
  await driver.navigate('/a').finished; await driver.navigate('/b').finished; armed = true;
  const back = driver.back(); await entered.promise;
  await assert.rejects(back.finished, { name: 'AbortError' });
  gate.resolve(); await newer.finished;
  assert.deepEqual(handled, ['/a', '/b', '/newer']);
  assert.equal((await driver.back().finished).url, 'https://routes.example/a');
});

it('dispatches traversal between distinct keys at the same URL', async() => {
  const fixture = context(); const { driver } = fixture; const events = intercept(fixture);
  const a = await driver.navigate('/a', { state: 1 }).finished;
  const b = await driver.navigate('/a', { history: 'push', state: 2 }).finished;
  assert.notEqual(a.key, b.key);
  assert.equal(await driver.back().finished, a);
  assert.equal(events.at(-1).navigationType, 'traverse');
  assert.equal(events.at(-1).hashChange, false);
  assert.equal(driver.currentEntry.getState(), 1);
});

it('exposes listener errors through the host while dispatch continues', async() => {
  const fixture = context(); const failure = new Error('listener failed'); const scheduled = [];
  vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(callback => scheduled.push(callback));
  fixture.driver.addEventListener('navigate', () => { throw failure; }, { signal: fixture.listeners.signal });
  const events = intercept(fixture);
  await fixture.driver.navigate('/a').finished;
  assert.equal(events.length, 1); assert.equal(scheduled.length, 1);
  assert.throws(scheduled[0], error => error === failure);
});

it('rejects late, canceled and cross-origin interception at the public event boundary', async() => {
  const fixture = context();
  let seen;
  fixture.driver.addEventListener('navigate', event => {
    seen = event;
    if (!event.canIntercept) { assert.throws(() => event.intercept(), { name: 'SecurityError' }); } else { event.preventDefault(); assert.throws(() => event.intercept(), { name: 'InvalidStateError' }); }
  }, { signal: fixture.listeners.signal });
  await assert.rejects(fixture.driver.navigate('/a').finished, { name: 'AbortError' });
  assert.throws(() => seen.intercept(), { name: 'InvalidStateError' });
  seen.preventDefault();
  await assert.rejects(fixture.driver.navigate('https://elsewhere.example/').finished, { name: 'AbortError' });
});

it('rejects browser write failures without recording an uncommitted entry', async() => {
  const fixture = context(); intercept(fixture);
  const failure = new DOMException('Browser quota exhausted', 'QuotaExceededError');
  const original = fixture.window.history.pushState;
  fixture.window.history.pushState = () => { throw failure; };
  const result = fixture.driver.navigate('/a');
  await assert.rejects(result.committed, error => error === failure);
  await assert.rejects(result.finished, error => error === failure);
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/');
  assert.equal(fixture.driver.entries().length, 1);
  fixture.window.history.pushState = original;
  await fixture.driver.navigate('/a').finished;
});

it('rejects a failed unknown-entry stamp and can retry the ordinary read', () => {
  const fixture = context();
  fixture.window.history.replaceState({ foreign: true }, '', '/outside');
  const original = fixture.window.history.replaceState;
  const failure = new DOMException('Browser quota exhausted', 'QuotaExceededError');
  fixture.window.history.replaceState = () => { throw failure; };
  assert.throws(() => fixture.driver.currentEntry, error => error === failure);
  fixture.window.history.replaceState = original;
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/outside');
  assert.deepEqual(fixture.driver.currentEntry.getState(), { foreign: true });
});

it('rejects synchronous traversal failure and releases the pending receipt', async() => {
  const fixture = context(); intercept(fixture);
  await fixture.driver.navigate('/a').finished;
  const original = fixture.window.history.go;
  const failure = new DOMException('Inactive document', 'SecurityError');
  fixture.window.history.go = () => { throw failure; };
  await assert.rejects(fixture.driver.back().finished, error => error === failure);
  fixture.window.history.go = original;
  assert.equal((await fixture.driver.back().finished).url, 'https://routes.example/');
});

it('publishes newer navigation authority before abort listeners can reenter', async() => {
  const fixture = context(); const work = Promise.withResolvers(); let newest;
  intercept(fixture, event => {
    if (event.destination.url.endsWith('/a')) {
      event.signal.addEventListener('abort', () => { newest = fixture.driver.navigate('/c'); }, { once: true });
      return work.promise;
    }
  });
  const a = fixture.driver.navigate('/a'); await a.committed;
  const b = fixture.driver.navigate('/b');
  await assert.rejects(a.finished, { name: 'AbortError' });
  await assert.rejects(b.finished, { name: 'AbortError' });
  await newest.finished;
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/c');
  work.resolve();
});

for (const mode of ['push', 'replace']) {
  it(`cancels a queued Back receipt when an intervening ${mode} supersedes it`, async() => {
    const fixture = context(); const { driver } = fixture;
    const work = Promise.withResolvers(); let gated = false;
    intercept(fixture, event => {
      if (gated && (event.navigationType === 'traverse' || event.destination.url.endsWith('/d'))) {
        return work.promise;
      }
    });
    await driver.navigate('/a').finished;
    await driver.navigate('/b', { state: { page: 'b' } }).finished;
    await driver.navigate('/c').finished; gated = true;
    const back = driver.back();
    const newer = driver.navigate('/d', { history: mode });
    await assert.rejects(back.finished, { name: 'AbortError' });
    work.resolve();
    // The host may either cancel its queued traversal or commit it later.
    await newer.finished.catch(error => assert.equal(error.name, 'AbortError'));
  });
}

it('settles a forward request whose entry an intervening push removes', async() => {
  const fixture = context(); intercept(fixture);
  const { driver } = fixture;
  await driver.navigate('/a').finished;
  const forward = await driver.navigate('/b').finished;
  await driver.back().finished;
  const queued = driver.traverseTo(forward.key);
  await driver.navigate('/replacement').finished;
  await assert.rejects(queued.finished, { name: 'AbortError' });
});

it('releases its own failed subscription setup so the same listener can retry', async() => {
  const fixture = context();
  fixture.window.history.replaceState({ foreign: true }, '', '/outside');
  const original = fixture.window.history.replaceState;
  const failure = new DOMException('Browser quota exhausted', 'QuotaExceededError');
  fixture.window.history.replaceState = () => { throw failure; };
  let calls = 0; const listener = event => { calls++; event.intercept(); };
  assert.throws(() => fixture.driver.addEventListener('navigate', listener, { signal: fixture.listeners.signal }), error => error === failure);
  fixture.window.history.replaceState = original;
  fixture.driver.addEventListener('navigate', listener, { signal: fixture.listeners.signal });
  await fixture.driver.navigate('/a').finished;
  assert.equal(calls, 1);
});

it('does not acquire browser listeners after its signal aborts during setup', () => {
  const fixture = context();
  fixture.window.history.replaceState({ foreign: true }, '', '/outside');
  const original = fixture.window.history.replaceState;
  fixture.window.history.replaceState = function(...args) {
    original.apply(this, args); fixture.listeners.abort();
  };
  const windowAdds = vi.spyOn(fixture.window, 'addEventListener');
  const documentAdds = vi.spyOn(fixture.window.document, 'addEventListener');
  fixture.driver.addEventListener('navigate', () => {}, { signal: fixture.listeners.signal });
  assert.deepEqual(windowAdds.mock.calls.filter(([type]) => ['popstate', 'hashchange', 'pagehide'].includes(type)), []);
  assert.deepEqual(documentAdds.mock.calls.filter(([type]) => type === 'click'), []);
});

it('preserves explicit standalone reload state before the document handoff', async() => {
  const fixture = context({ before: true });
  const key = fixture.driver.currentEntry.key;
  await assert.rejects(fixture.driver.reload({ state: { after: true } }).finished, { name: 'AbortError' });
  assert.deepEqual(fixture.driver.currentEntry.getState(), { after: true });
  assert.equal(fixture.driver.currentEntry.key, key);
  assert.equal(fixture.errors.length, 1);
});

it('does not hand an obsolete unclaimed operation to Location after abort reentry', async() => {
  const fixture = context(); let newer;
  fixture.driver.addEventListener('navigate', event => {
    if (event.destination.url.endsWith('/outside')) {
      event.signal.addEventListener('abort', () => { newer = fixture.driver.navigate('/current'); }, { once: true });
    } else { event.intercept(); }
  }, { signal: fixture.listeners.signal });
  await assert.rejects(fixture.driver.navigate('/outside').finished, { name: 'AbortError' });
  await newer.finished;
  assert.equal(fixture.driver.currentEntry.url, 'https://routes.example/current');
  assert.deepEqual(fixture.errors, []);
});

it('settles pending traversal when a detectable foreign write resets its known window', async() => {
  const fixture = context(); intercept(fixture);
  await fixture.driver.navigate('/a').finished;
  const queued = fixture.driver.back();
  let cancelled = false; queued.finished.catch(() => { cancelled = true; });
  fixture.window.history.replaceState({ foreign: true }, '', '/outside');
  assert.equal(fixture.driver.entries().length, 1);
  await Promise.resolve(); assert.equal(cancelled, true);
  await assert.rejects(queued.finished, { name: 'AbortError' });
});

it('keeps navigation started by an outgoing abort listener authoritative during popstate', async() => {
  const fixture = context(); const { driver } = fixture;
  const gate = Promise.withResolvers();
  let newer;
  intercept(fixture, event => {
    if (event.destination.url.endsWith('/b')) {
      event.signal.addEventListener('abort', () => { newer = driver.navigate('/c'); }, { once: true });
      return gate.promise;
    }
  });
  await driver.navigate('/a').finished;
  const pending = driver.navigate('/b'); await pending.committed;
  const back = driver.back();
  assert.equal((await back.committed).url, 'https://routes.example/a');
  await assert.rejects(back.finished, { name: 'AbortError' });
  await assert.rejects(pending.finished, { name: 'AbortError' });
  await newer.finished;
  assert.equal(driver.currentEntry.url, 'https://routes.example/c');
  gate.resolve();
});

it('cancels traversal completion when its navigate listener starts a newer navigation', async() => {
  const fixture = context(); const { driver } = fixture;
  let newer;
  driver.addEventListener('navigate', event => {
    if (event.navigationType === 'traverse') { newer = driver.navigate('/c'); } else { event.intercept(); }
  }, { signal: fixture.listeners.signal });
  await driver.navigate('/a').finished;
  const back = driver.back();
  await back.committed;
  await assert.rejects(back.finished, { name: 'AbortError' });
  await newer.finished;
  assert.equal(driver.currentEntry.url, 'https://routes.example/c');
});

it('preserves a newer navigation triggered by a public History write observer', async() => {
  const fixture = context(); const { driver, window } = fixture;
  const handled = []; intercept(fixture, event => handled.push(event.destination.url));
  const original = window.history.pushState;
  let newer;
  window.history.pushState = function(...args) {
    original.apply(this, args);
    if (window.location.pathname === '/a') { newer = driver.navigate('/c'); }
  };
  const stale = driver.navigate('/a');
  await assert.rejects(stale.finished, { name: 'AbortError' });
  await newer.finished;
  assert.equal(driver.currentEntry.url, 'https://routes.example/c');
  assert.deepEqual(handled, ['https://routes.example/c']);
});
