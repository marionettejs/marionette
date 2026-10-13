import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const app = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../package.json', import.meta.url));
const playwright = require('playwright');
const origin = 'https://router.prototype.test';
const pathFor = id => `/alpha/patient/p1/interactions/${id}`;
const vendors = {
  '/vendor/underscore.js': `${app}/node_modules/underscore/underscore-umd.js`,
  '/vendor/backbone.js': `${app}/node_modules/backbone/backbone.js`,
  '/vendor/marionette.mjs': `${app}/dist/marionette.js`,
  '/vendor/utils.mjs': `${app}/packages/utils/dist/index.js`,
  '/vendor/radio.mjs': `${app}/packages/radio/dist/index.js`,
};
const sourceHashes = {};
for (const [url, filename] of Object.entries(vendors)) {
  sourceHashes[url] = { filename, sha256: createHash('sha256').update(await readFile(filename)).digest('hex') };
}
const cases = [];
const test = (name, mode, run, options = {}) => cases.push({ name, mode, run, options });
const snap = page => page.evaluate(() => ({
  href: location.href, length: history.length, state: history.state,
  events: window.fixture.events, errors: window.fixture.errors, completed: window.fixture.completed,
  renders: window.fixture.renderCount, legacy: window.fixture.legacyCount,
  heading: document.querySelector('#panel h1')?.textContent,
  current: window.fixture.router.location, lastId: window.fixture.router.lastDispatch?.id,
  writes: window.browserLedger.writes, pops: window.browserLedger.pops, listeners: window.browserLedger.popListeners.size,
  fragment: window.Backbone.history.fragment,
}));
const go = (page, interactionId, navigationOptions = {}) => page.evaluate(async({ id, options }) => {
  const result = await window.fixture.go(id, options); return result.status;
}, { id: interactionId, options: navigationOptions });
const turn = page => page.evaluate(() => window.fixture.twoFrames());
async function traverse(page, method, expectedCount) {
  await page.evaluate(direction => history[direction](), method);
  await page.waitForFunction(count => window.fixture.events.length === count, expectedCount);
  await turn(page);
}

for (const mode of ['native', 'backbone']) {
  test('push, replace, Back, Forward, repeat, refresh', mode, async page => {
    const initial = await snap(page);
    assert.equal(initial.listeners, 1);
    assert.equal(await go(page, 'b'), 'handled');
    const pushed = await snap(page);
    assert.equal(pushed.length, initial.length + 1);
    assert.equal(pushed.events.length, 2);
    assert.equal(pushed.writes.length, initial.writes.length + 1);
    assert.equal(await go(page, 'c', { history: 'replace' }), 'handled');
    const replaced = await snap(page);
    assert.equal(replaced.length, pushed.length);
    assert.equal(replaced.writes.at(-1).method, 'replaceState');
    if (mode === 'native') {
      assert.notEqual(pushed.current.key, initial.current.key);
      assert.equal(replaced.current.key, pushed.current.key);
    }
    await traverse(page, 'back', 4);
    assert.equal((await snap(page)).heading, 'a');
    await traverse(page, 'forward', 5);
    const forward = await snap(page);
    assert.equal(forward.heading, 'c');
    assert.equal(forward.writes.length, replaced.writes.length);
    assert.equal(forward.events.at(-1).kind, mode === 'native' ? 'traverse' : 'host');
    await go(page, 'c', { info: { entryTarget: 'row-20' } });
    assert.equal((await snap(page)).events.at(-1).kind, 'repeat');
    assert.deepEqual((await snap(page)).events.at(-1).info, { entryTarget: 'row-20' });
    await page.evaluate(() => window.fixture.router.refresh());
    const refreshed = await snap(page);
    assert.equal(refreshed.events.at(-1).kind, 'refresh');
    assert.equal(refreshed.writes.length, forward.writes.length);
    assert.equal(refreshed.listeners, 1);
  });

  test('reflection invalidates pending work without redispatch; traversal resumes', mode, async page => {
    await page.evaluate(() => { window.fixture.hold('slow'); void window.fixture.go('slow'); });
    const pending = await snap(page);
    const result = await page.evaluate(async() => (await window.fixture.reflect()).status);
    assert.equal(result, 'reflected');
    const reflected = await snap(page);
    assert.equal(reflected.events.length, pending.events.length);
    assert.equal(reflected.renders, pending.renders);
    assert.equal(reflected.current.href, `${origin}/alpha/patient/p1/interactions`);
    assert.equal(reflected.lastId, pending.lastId);
    await page.evaluate(() => window.fixture.release('slow'));
    await page.waitForFunction(() => window.fixture.completed.includes('slow'));
    assert.equal((await snap(page)).heading, 'a');
    await traverse(page, 'back', 3);
    await traverse(page, 'forward', 4);
    assert.equal((await snap(page)).heading, 'feed');
    if (mode === 'backbone') {assert.equal((await snap(page)).fragment, 'alpha/patient/p1/interactions');}
  });

  test('late noncooperative success, stale rejection, and traversal interruption', mode, async page => {
    await page.evaluate(() => { window.fixture.hold('slow'); void window.fixture.go('slow'); });
    await go(page, 'b');
    await page.evaluate(() => window.fixture.release('slow'));
    await page.waitForFunction(() => window.fixture.completed.includes('slow'));
    assert.equal((await snap(page)).heading, 'b');
    await page.evaluate(() => { window.fixture.hold('bad'); void window.fixture.go('bad'); });
    await traverse(page, 'back', 5);
    await page.evaluate(() => window.fixture.reject('bad'));
    await page.waitForFunction(() => window.fixture.completed.includes('bad'));
    const final = await snap(page);
    assert.equal(final.heading, 'b');
    assert.deepEqual(final.errors, []);
    assert.equal(await page.evaluate(async() => (await window.fixture.tasks.get('bad')).status), 'superseded');
  });

  test('focus and nested scroll require presentation policy; disposal removes listener', mode, async page => {
    await page.evaluate(() => {
      history.scrollRestoration = 'manual';
      document.querySelector('#keeper').focus();
      document.querySelector('#panel').scrollTop = 400;
    });
    await go(page, 'b');
    await turn(page);
    const before = await page.evaluate(() => ({ focus: document.activeElement.id, scroll: document.querySelector('#panel').scrollTop }));
    assert.equal(before.focus, 'keeper');
    assert.equal(before.scroll, 400);
    assert.equal(await page.evaluate(() => window.fixture.presentTarget('does-not-exist')), false);
    assert.equal(await page.evaluate(() => window.fixture.presentTarget()), true);
    const presented = await page.evaluate(() => {
      const panel = document.querySelector('#panel'); const target = document.querySelector('#row-20');
      const p = panel.getBoundingClientRect(); const t = target.getBoundingClientRect();
      return { focus: document.activeElement.id, scroll: panel.scrollTop, visible: t.top >= p.top && t.bottom <= p.bottom };
    });
    assert.equal(presented.focus, 'row-20'); assert.ok(presented.scroll > 400); assert.ok(presented.visible);
    await traverse(page, 'back', 3);
    // Router does not restore a previous selected element or per-entry panel offset.
    const back = await page.evaluate(() => ({ focus: document.activeElement.id, scroll: document.querySelector('#panel').scrollTop }));
    assert.notEqual(back.focus, 'row-20'); assert.notEqual(back.scroll, 400);
    await page.evaluate(() => window.fixture.dispose());
    assert.equal((await snap(page)).listeners, 0);
    assert.equal(await go(page, 'after-dispose'), 'disposed');
    return { before, presented, afterBack: back, scrollRestoration: 'manual (explicit fixture policy)' };
  });
}

test('native entry state, reflection preservation, clone failure, and foreign entry', 'native', async page => {
  await go(page, 'b', { state: { selected: 7 } });
  const before = await snap(page);
  await page.evaluate(() => window.fixture.reflect());
  const after = await snap(page);
  assert.deepEqual(after.current.state, { selected: 7 });
  assert.equal(after.current.key, before.current.key);
  assert.equal(after.state.external, 'preserved');
  const cloneError = await page.evaluate(() => {
    try { window.fixture.go('bad-clone', { state: { callback() {} } }); } catch (error) { return error.name; }
  });
  assert.equal(cloneError, 'DataCloneError');
  assert.equal((await snap(page)).href, after.href);
  await traverse(page, 'back', 3); // Original adopted entry.
  const writes = (await snap(page)).writes.length;
  await traverse(page, 'back', 4); // Foreign seeded entry.
  const foreign = await snap(page);
  assert.equal(foreign.current.key, null);
  assert.equal(foreign.state.foreign, true);
  assert.equal(foreign.writes.length, writes);
}, { seed: [{ href: pathFor('foreign'), state: { foreign: true } }, { href: pathFor('a'), state: { external: 'preserved' } }] });

for (const mode of ['native', 'backbone']) {
  test('equal-URL distinct entries expose transport capability', mode, async page => {
    const initial = await snap(page);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => window.browserLedger.pops === 1);
    await turn(page);
    const after = await snap(page);
    assert.equal(after.href, initial.href);
    assert.equal(after.state.marker, 'first');
    assert.equal(after.events.length, mode === 'native' ? 2 : 1);
    if (mode === 'native') {assert.equal(after.current.key, null);}
    return { nativePopDelivered: true, dispatchesAdded: after.events.length - initial.events.length,
      limitation: mode === 'backbone' ? 'Backbone suppresses equal-fragment POP; bridge has no entry-state/key guarantee.' : null };
  }, { seed: [{ href: pathFor('a'), state: { marker: 'first' } }, { href: pathFor('a'), state: { marker: 'second' } }] });
}

test('legacy silent writes cancel modern work; Radio migration and host replay dispatch once', 'backbone', async page => {
  await page.evaluate(() => { window.fixture.hold('slow'); void window.fixture.go('slow'); });
  const before = await snap(page);
  await page.evaluate(() => window.fixture.legacy('schedule'));
  const legacy = await snap(page);
  assert.equal(legacy.heading, 'legacy schedule');
  assert.equal(legacy.href, `${origin}/alpha/schedule`);
  assert.equal(legacy.events.length, before.events.length + 1);
  assert.equal(legacy.writes.length, before.writes.length + 1);
  await page.evaluate(() => window.fixture.release('slow'));
  await page.waitForFunction(() => window.fixture.completed.includes('slow'));
  assert.equal((await snap(page)).heading, 'legacy schedule');
  await page.evaluate(() => window.fixture.legacy('patient:interaction', 'p1', 'radio', { entryTarget: 'row-3' }));
  const radio = await snap(page);
  assert.equal(radio.heading, 'radio');
  assert.equal(radio.events.length, legacy.events.length + 1);
  assert.equal(radio.writes.length, legacy.writes.length + 1);
  assert.deepEqual(radio.events.at(-1).info, { entryTarget: 'row-3' });
  await traverse(page, 'back', radio.events.length + 1);
  assert.equal((await snap(page)).heading, 'legacy schedule');
  assert.equal((await snap(page)).legacy, 2);
  await traverse(page, 'forward', radio.events.length + 2);
  assert.equal((await snap(page)).heading, 'radio');
  const count = (await snap(page)).events.length;
  await page.evaluate(() => window.fixture.hostNavigate('alpha/worklist/mine', { trigger: true }));
  assert.equal((await snap(page)).events.length, count + 1);
  assert.equal((await snap(page)).heading, 'legacy mine');
  const unsupported = await page.evaluate(() => {
    const errors = [];
    try { window.fixture.go('state', { state: { selected: 1 } }); } catch (error) { errors.push(error.message); }
    try { window.fixture.router.navigate('/alpha/patient/p1/interactions/hash#target'); } catch (error) { errors.push(error.message); }
    return errors;
  });
  assert.equal(unsupported.length, 2);
});

test('nested modern redirect from a legacy route has no stale host echo', 'backbone', async page => {
  await page.evaluate(() => window.fixture.hostNavigate('alpha/schedule', { trigger: true }));
  const state = await snap(page);
  assert.equal(state.heading, 'redirected');
  assert.equal(state.href, `${origin}${pathFor('redirected')}`);
  assert.equal(state.events.length, 2);
  assert.equal(state.events.at(-1).kind, 'push');
}, { redirectLegacy: true });

test('product history fixture wrapper and product back preserve their separate policy', 'backbone', async page => {
  const initial = await snap(page);
  assert.equal(initial.listeners, 2); // One route listener and one product observer.
  await go(page, 'b');
  await go(page, 'c');
  const beforeBack = await snap(page);
  await page.evaluate(() => window.fixture.productBack());
  const afterBack = await snap(page);
  assert.equal(afterBack.heading, 'b');
  assert.equal(afterBack.events.length, 4);
  assert.equal(afterBack.writes.length, beforeBack.writes.length + 1);
  assert.equal(afterBack.length, beforeBack.length + 1); // Product go:back pushes.
  assert.equal(afterBack.writes.at(-1).method, 'pushState');
  assert.equal((await page.evaluate(() => window.fixture.historyChanges)).length, 3);
  await traverse(page, 'back', 5);
  assert.equal((await snap(page)).heading, 'c');
  await page.evaluate(() => window.fixture.dispose());
  assert.equal(await page.evaluate(() => window.fixture.bridgeRestored), true);
  assert.equal((await snap(page)).listeners, 0); // Portable fixture releases its own product observer.
  return { routeListeners: 1, productObservers: 1, productBackPushes: true,
    serviceListenerAfterDestroy: 0, bridgeRestoredOriginalWrapper: true };
}, { withHistoryService: true });

test('direct host replay redirect suppresses stale echo', 'backbone', async page => {
  await page.evaluate(() => window.fixture.hostReplay('alpha/schedule'));
  const state = await snap(page);
  assert.equal(state.heading, 'redirected');
  assert.equal(state.events.length, 2);
  assert.equal(state.events.at(-1).kind, 'push');
}, { redirectLegacy: true });

test('native traversal legacy redirect suppresses stale echo', 'backbone', async page => {
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => window.fixture.events.length >= 2);
  await turn(page);
  const state = await snap(page);
  assert.equal(state.heading, 'redirected');
  assert.equal(state.events.length, 2);
  assert.equal(state.href, `${origin}${pathFor('redirected')}`);
}, { redirectLegacy: true, seed: [{ href: '/alpha/schedule', state: {} }, { href: pathFor('a'), state: {} }] });

test('HistoryService synchronous nested navigation cannot publish the outer match', 'backbone', async page => {
  assert.equal(await go(page, 'outer'), 'superseded');
  const state = await snap(page);
  assert.equal(state.heading, 'inner');
  assert.equal(state.href, `${origin}${pathFor('inner')}`);
  assert.equal(state.events.length, 2);
  assert.equal(await page.evaluate(() => window.fixture.router.lastDispatch.match.params.interactionId), 'inner');
}, { withHistoryService: true, redirectService: true });

test('bridge-only detach preserves legacy routing and the HistoryService wrapper', 'backbone', async page => {
  await page.evaluate(() => window.fixture.detachBridge());
  assert.equal(await page.evaluate(() => window.fixture.bridgeRestored), true);
  const before = await snap(page);
  assert.equal(before.listeners, 2);
  await page.evaluate(() => window.fixture.legacy('schedule'));
  await page.evaluate(() => window.fixture.hostNavigate('alpha/worklist/mine', { trigger: true }));
  const after = await snap(page);
  assert.equal(after.heading, 'legacy mine');
  assert.equal(after.events.length, before.events.length);
  assert.equal((await page.evaluate(() => window.fixture.historyChanges)).length, 2);
}, { withHistoryService: true });

const results = [];
for (const name of ['chromium', 'firefox', 'webkit']) {
  const browser = await playwright[name].launch({ headless: true, timeout: 15000 });
  try {
    for (const scenario of cases) {
      const context = await browser.newContext({ viewport: { width: 900, height: 650 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) {return route.abort();}
        const path = url.pathname;
        let body;
        if (route.request().resourceType() === 'document') {body = await readFile(new URL('./fixture.html', import.meta.url));} else if (vendors[path]) {body = await readFile(vendors[path]);} else if (path === '/vendor/backbone-export.mjs') {body = 'export default window.Backbone;';} else if (path === '/vendor/underscore-export.mjs') {body = 'export const { bind, drop, each, extend, isArray, isEqual, pick, reduce, reject, result, uniqueId } = window._;';} else if ((path.startsWith('/packages/router/dist/') || path.startsWith('/test/router/')) && !path.includes('..')) {body = await readFile(new URL(`../..${path}`, import.meta.url));} else {return route.fulfill({ status: 404, body: 'Unknown fixture resource' });}
        await route.fulfill({ status: 200, body, contentType: route.request().resourceType() === 'document' ? 'text/html' : 'text/javascript' });
      });
      await page.addInitScript(settings => {
        window.fixtureOptions = settings;
        window.browserLedger = { writes: [], pops: 0, popListeners: new Set() };
        const ledger = window.browserLedger;
        const add = window.addEventListener; const remove = window.removeEventListener;
        const wrappers = new Map();
        window.addEventListener = function(type, listener, options) {
          if (type !== 'popstate') {return add.call(this, type, listener, options);}
          let wrapper = wrappers.get(listener);
          if (!wrapper) { wrapper = function(event) { ledger.pops++; return listener.call(this, event); }; wrappers.set(listener, wrapper); }
          ledger.popListeners.add(listener);
          return add.call(this, type, wrapper, options);
        };
        window.removeEventListener = function(type, listener, options) {
          if (type !== 'popstate') {return remove.call(this, type, listener, options);}
          ledger.popListeners.delete(listener);
          return remove.call(this, type, wrappers.get(listener) ?? listener, options);
        };
        for (const method of ['pushState', 'replaceState']) {
          const original = history[method];
          history[method] = function(state, title, url) {
            const result = original.call(this, state, title, url);
            ledger.writes.push({ method, href: location.href, state });
            return result;
          };
        }
      }, { mode: scenario.mode, ...scenario.options });
      const result = { engine: name, version: browser.version(), mode: scenario.mode, scenario: scenario.name };
      try {
        await page.goto(`${origin}${pathFor('a')}`, { waitUntil: 'load' });
        await page.waitForFunction(() => window.fixtureReady === true);
        result.observations = await scenario.run(page);
        assert.deepEqual(pageErrors, []);
        result.status = 'passed';
      } catch (error) {
        result.status = 'failed'; result.error = error.stack; result.pageErrors = pageErrors;
        try { result.state = await snap(page); } catch { /* Initialization can fail before a fixture exists. */ }
      } finally { await context.close(); }
      results.push(result);
      console.log(`${name} ${scenario.mode}: ${result.status} — ${scenario.name}`);
      if (result.status === 'failed') {console.log(result.error);}
    }
  } finally { await browser.close(); }
}
await writeFile(new URL('../tmp/router-browser-results.json', import.meta.url), JSON.stringify({
  runAt: new Date().toISOString(), node: process.version, playwright: require('playwright/package.json').version,
  headless: true, isolatedSyntheticOrigin: origin, sourceHashes, results,
}, null, 2) + '\n');
const failed = results.filter(result => result.status !== 'passed');
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {process.exitCode = 1;}
