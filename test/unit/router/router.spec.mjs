import { test, onTestFinished, vi } from 'vitest';
import assert from 'node:assert/strict';
import { createRoutes, createMemoryHistory, createBrowserHistory, createRouter } from '@mnjs/router';
import { careRoutes } from '../../router/routes.mjs';

const deferred = () => Promise.withResolvers();
const drain = () => new Promise(resolve => setImmediate(resolve));
const target = (patientId, interactionId) => ({ name: 'patient:interaction', params: { workspace: 'alpha', patientId, interactionId } });
function setup(dispatch, extra = {}) {
  const history = createMemoryHistory('https://care.example/alpha/patient/a/workflow');
  const errors = [];
  const router = createRouter({ routes: careRoutes, history, dispatch, onError: error => errors.push(error), ...extra });
  return { router, history, errors };
}

test('real URLs round-trip named IDs, aliases, encoded delimiters, search and hash', () => {
  const href = careRoutes.href({ ...target('a/b', 'q?x=1'), search: [['group', 'notes'], ['group', 'calls']], hash: 'item 2' });
  assert.equal(href, '/alpha/patient/a%2Fb/interactions/q%3Fx%3D1?group=notes&group=calls#item%202');
  assert.deepEqual(careRoutes.match(href).params, { workspace: 'alpha', patientId: 'a/b', interactionId: 'q?x=1' });
  const alias = careRoutes.match('/alpha/patient/dashboard/p1');
  assert.equal(alias.alias, true);
  assert.equal(careRoutes.href(alias), '/alpha/patient/p1/workflow');
  assert.equal(careRoutes.match('/alpha/patient/p1/workflow/'), null);
  assert.equal(careRoutes.match('/alpha/unknown'), null);
  assert.throws(() => careRoutes.match('/alpha/patient/%xy/workflow'), URIError);
  assert.throws(() => careRoutes.href(target('..', 'x')), TypeError);
  assert.throws(() => createRoutes({ bad: '/program/:id/action/:id' }), /Duplicate/);
});

test('URL is visible before dispatch; same URL carries new transient intent without a duplicate entry', async() => {
  const seen = [];
  const { router, history } = setup(ctx => { seen.push([history.read().href, ctx.info, ctx.kind]); });
  onTestFinished(() => router.dispose());
  assert.equal((await router.start()).status, 'handled');
  const intent = { entryTarget: { comments: true } };
  await router.navigate(target('p', 'i'), { info: intent });
  await router.navigate(target('p', 'i'), { info: { entryTarget: { attachments: true } } });
  assert.equal(history.inspect().entries.length, 2);
  assert.equal(seen[1][0], 'https://care.example/alpha/patient/p/interactions/i');
  assert.equal(seen[1][1], intent);
  assert.equal(seen[2][2], 'repeat');
  assert.equal(history.read().state, undefined);
});

test('late noncooperative work loses publish authority and settles promptly on supersession', async() => {
  const old = deferred();
  const published = [];
  let oldContext;
  const { router } = setup(async ctx => {
    if (ctx.match.params.patientId === 'old') {
      oldContext = ctx;
      await old.promise;
    }
    ctx.runIfCurrent(() => published.push(ctx.match.params.patientId));
  });
  onTestFinished(() => router.dispose());
  const pending = router.navigate(target('old', 'i'));
  await router.navigate(target('new', 'i'));
  assert.equal((await pending).status, 'superseded');
  assert.equal(oldContext.signal.aborted, true);
  old.resolve();
  await drain();
  assert.deepEqual(published, ['new']);
});

test('late rejected work is observed and cannot report an obsolete route error', async() => {
  const old = deferred();
  const { router, errors } = setup(ctx => ctx.match.params.patientId === 'old' ? old.promise : undefined);
  onTestFinished(() => router.dispose());
  const pending = router.navigate(target('old', 'i'));
  await router.navigate(target('new', 'i'));
  old.reject(new Error('obsolete failure'));
  await pending;
  await drain();
  assert.deepEqual(errors, []);
});

test('synchronous redirect cannot be overwritten by the source dispatch', async() => {
  const { router, history } = setup(ctx => {
    if (ctx.match.name === 'legacy:patient:flow') {
      return router.navigate({ name: 'patient:flow', params: { ...ctx.match.params, patientId: 'resolved' } }, { history: 'replace' });
    }
  });
  onTestFinished(() => router.dispose());
  const result = await router.navigate('/alpha/flow/f1');
  assert.equal(result.status, 'superseded');
  assert.equal(new URL(router.location.href).pathname, '/alpha/patient/resolved/flow/f1');
  assert.equal(history.inspect().entries.length, 2);
});

test('abort-triggered navigation wins before superseded handler can run', async() => {
  const seen = [];
  const { router } = setup(ctx => {
    seen.push(ctx.match.params.patientId);
    if (ctx.match.params.patientId === 'a') {ctx.signal.addEventListener('abort', () => { router.navigate(target('c', 'i')); }, { once: true });}
  });
  onTestFinished(() => router.dispose());
  await router.navigate(target('a', 'i'));
  const result = await router.navigate(target('b', 'i'));
  await drain();
  assert.equal(result.status, 'superseded');
  assert.deepEqual(seen, ['a', 'c']);
  assert.match(router.location.href, /patient\/c\//);
});

test('refresh redispatches current entry with a distinct cause; reflect does not reload', async() => {
  const seen = [];
  const { router, history } = setup(ctx => seen.push(ctx));
  onTestFinished(() => router.dispose());
  await router.navigate(target('p', 'i'));
  const key = router.location.key;
  await router.refresh();
  assert.equal(seen.at(-1).kind, 'refresh');
  assert.equal(router.location.key, key);
  const before = router.lastDispatch;
  const result = await router.reflect({ name: 'patient:interactions', params: { workspace: 'alpha', patientId: 'p' } });
  assert.equal(result.status, 'reflected');
  assert.equal(seen.length, 2);
  assert.equal(before.isCurrent(), false);
  assert.equal(router.lastDispatch, before);
  assert.equal(history.inspect().entries.length, 2);
  assert.equal(router.location.key, key);
});

test('Back/Forward uses entry identity, restores explicit state, and never pushes', async() => {
  const seen = [];
  const { router, history } = setup(ctx => seen.push(ctx));
  onTestFinished(() => router.dispose());
  await router.start();
  await router.navigate(target('p', '1'), { state: { scrollAnchor: 'row-1' } });
  const first = router.location;
  await router.navigate(target('p', '2'));
  router.go(-1);
  await drain();
  assert.equal(router.location.key, first.key);
  assert.deepEqual(seen.at(-1).location.state, { scrollAnchor: 'row-1' });
  assert.equal(seen.at(-1).kind, 'traverse');
  router.go(1);
  await drain();
  assert.match(router.location.href, /interactions\/2$/);
  assert.equal(history.inspect().entries.length, 3);
});

test('history write failure preserves active route; foreign URLs never reach transport', async() => {
  let prior;
  const { router, history } = setup(ctx => { prior = ctx; });
  onTestFinished(() => router.dispose());
  await router.start();
  assert.throws(() => router.navigate(target('p', 'i'), { state: () => {} }), { name: 'DataCloneError' });
  assert.equal(prior.isCurrent(), true);
  assert.equal(history.inspect().entries.length, 1);
  assert.throws(() => router.navigate('https://evil.example/a'), TypeError);
  assert.throws(() => router.navigate('javascript' + ':alert(1)'), TypeError);
});

test('current handler failure reports once and retains the destination URL', async() => {
  const failure = new Error('load failed');
  const { router, errors } = setup(() => { throw failure; });
  onTestFinished(() => router.dispose());
  const result = await router.navigate(target('p', 'i'));
  assert.equal(result.status, 'failed');
  assert.equal(result.error, failure);
  assert.deepEqual(errors, [failure]);
  assert.match(router.location.href, /patient\/p\/interactions\/i$/);
});

test('rejected asynchronous error reporting is observed without changing the route outcome', async() => {
  const reports = [];
  const reporter = vi.spyOn(console, 'error').mockImplementation((...args) => reports.push(args));
  onTestFinished(() => reporter.mockRestore());
  const failure = new Error('route failure');
  const reportFailure = new Error('reporter failure');
  const { router } = setup(() => { throw failure; }, { onError: () => Promise.reject(reportFailure) });
  onTestFinished(() => router.dispose());
  const outcome = await router.navigate(target('p', 'i'));
  await drain();
  assert.equal(outcome.status, 'failed');
  assert.equal(outcome.error, failure);
  assert.equal(reports.length, 1);
  assert.equal(reports[0][1], reportFailure);
});

test('owner abort/dispose removes listener, invalidates work, and leaves application ownership external', async() => {
  const owner = new AbortController();
  const work = deferred();
  let ctx;
  const { router, history } = setup(context => { ctx = context; return work.promise; }, { signal: owner.signal });
  const task = router.start();
  assert.equal(history.inspect().subscriptions, 1);
  owner.abort();
  assert.equal((await task).status, 'superseded');
  assert.equal(ctx.runIfCurrent(() => assert.fail('stale')), false);
  assert.equal(history.inspect().subscriptions, 0);
  assert.equal((await router.navigate(target('p', 'i'))).status, 'disposed');
  router.dispose();
  work.resolve();
  await drain();
});

test('unknown URL is a destination for product not-found policy', async() => {
  let matched;
  const { router } = setup(ctx => { matched = ctx.match; });
  onTestFinished(() => router.dispose());
  await router.navigate('/alpha/no-such-page');
  assert.equal(matched, null);
  assert.match(router.location.href, /no-such-page$/);
});

test('malformed initial URLs, refresh and traversal share a usable error destination', async() => {
  const history = createMemoryHistory('https://care.example/alpha/patient/%xy/workflow');
  const seen = [];
  const router = createRouter({ routes: careRoutes, history, dispatch: context => seen.push(context) });
  onTestFinished(() => router.dispose());
  assert.equal((await router.start()).status, 'handled');
  assert.equal(seen[0].match, null);
  assert.equal(seen[0].info.malformedURL.name, 'URIError');
  await router.refresh();
  assert.equal(seen[1].info.malformedURL.name, 'URIError');
  await router.navigate('/alpha/schedule');
  router.go(-1);
  await drain();
  assert.equal(seen.at(-1).kind, 'traverse');
  assert.equal(seen.at(-1).info.malformedURL.name, 'URIError');
  assert.equal(history.inspect().subscriptions, 1);
});

test('Unicode literals round-trip and alias parameter mismatches fail at construction', () => {
  const routes = createRoutes({ cafe: '/café/:id' });
  assert.equal(routes.match(routes.href({ name: 'cafe', params: { id: 'é' } })).params.id, 'é');
  assert.throws(() => createRoutes({ patient: { path: '/patient/:patientId', aliases: ['/old/:id'] } }), /Alias parameters/);
});

test('pure resolver performs no history or dispatch work and leaves query values as strings', () => {
  const { router, history } = setup(() => assert.fail('unexpected dispatch'));
  const destination = router.resolve({ name: 'schedule', params: { workspace: 'alpha' },
    search: [['owner', '001'], ['active', 'false'], ['group', ''], ['group', 'two'], ['unknown', 'retain me']] });
  const query = new URL(destination.href).searchParams;
  assert.equal(query.get('owner'), '001');
  assert.equal(query.get('active'), 'false');
  assert.deepEqual(query.getAll('group'), ['', 'two']);
  assert.equal(query.get('absent'), null);
  assert.equal(query.get('unknown'), 'retain me');
  assert.equal(history.inspect().entries.length, 1);
  router.dispose();
});

test('obsolete lazy module success/rejection cannot activate, and a current retry succeeds', async() => {
  const requests = [];
  const activated = [];
  const { router, errors } = setup(async ctx => {
    const loaded = deferred();
    requests.push(loaded);
    const module = await loaded.promise; // Dynamic import itself cannot be aborted.
    ctx.runIfCurrent(() => module.activate());
  });
  onTestFinished(() => router.dispose());
  const a = router.navigate(target('a', 'i'));
  const b = router.navigate(target('b', 'i'));
  requests[1].reject(new Error('chunk load failed'));
  assert.equal((await b).status, 'failed');
  requests[0].resolve({ activate: () => activated.push('a') });
  await a;
  await drain();
  assert.deepEqual(activated, []);
  assert.equal(errors.length, 1);
  const retry = router.refresh();
  requests[2].resolve({ activate: () => activated.push('b') });
  await retry;
  assert.deepEqual(activated, ['b']);
});

test('rapid traversal cancels older work and a new push trims forward entries', async() => {
  const pending = [];
  const seen = [];
  const { router, history } = setup(ctx => {
    seen.push(ctx);
    if (ctx.kind === 'traverse') { const gate = deferred(); pending.push(gate); return gate.promise; }
  });
  onTestFinished(() => router.dispose());
  await router.start();
  await router.navigate(target('p', '1'));
  await router.navigate(target('p', '2'));
  router.go(-1);
  const first = seen.at(-1);
  router.go(-1);
  assert.equal(first.signal.aborted, true);
  assert.match(router.location.href, /workflow$/);
  await router.navigate(target('p', '3'));
  assert.equal(history.inspect().entries.length, 2);
  router.go(1);
  assert.match(router.location.href, /interactions\/3$/);
  pending.forEach(gate => gate.resolve());
  await drain();
});

test('replace/reflection preserve entry state when omitted; explicit null clears it', async() => {
  const { router } = setup(() => {});
  onTestFinished(() => router.dispose());
  await router.navigate(target('p', 'i'), { state: { anchor: 'list-item' } });
  await router.reflect({ name: 'patient:interactions', params: { workspace: 'alpha', patientId: 'p' } });
  assert.deepEqual(router.location.state, { anchor: 'list-item' });
  await router.navigate('/alpha/schedule', { history: 'replace', state: null });
  assert.equal(router.location.state, null);
});

test('browser adapter preserves foreign object fields and does not expect pushState to emit popstate', () => {
  const calls = [];
  const listeners = new Map();
  const window = {
    location: { href: 'https://care.example/alpha/schedule' },
    history: {
      state: { host: 'preserved' },
      pushState(state, _, href) { this.state = structuredClone(state); window.location.href = href; calls.push('push'); },
      replaceState(state, _, href) { this.state = structuredClone(state); window.location.href = href; calls.push('replace'); },
      go(delta) { calls.push(delta); },
    },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: name => listeners.delete(name),
  };
  const history = createBrowserHistory(window);
  let traversed;
  const release = history.subscribe(entry => { traversed = entry; });
  const initialKey = history.read().key;
  history.write('https://care.example/alpha/worklist/owned-by', { state: { anchor: 'a' } });
  assert.equal(traversed, undefined);
  assert.equal(window.history.state.host, 'preserved');
  assert.notEqual(history.read().key, initialKey);
  const key = history.read().key;
  history.write('https://care.example/alpha/worklist/shared-by', { replace: true });
  assert.equal(history.read().key, key);
  listeners.get('popstate')();
  assert.equal(traversed.key, key);
  window.history.state = null;
  listeners.get('popstate')();
  assert.equal(traversed.key, null);
  release();
  assert.equal(listeners.size, 0);
  assert.deepEqual(calls, ['replace', 'push', 'replace']);
});

test('host driver observations retain their cause and invalidate earlier authority', async() => {
  const seen = [];
  const history = createMemoryHistory('https://care.example/alpha/schedule');
  let publish;
  const nativeSubscribe = history.subscribe;
  history.subscribe = listener => { publish = listener; return nativeSubscribe(listener); };
  const router = createRouter({ routes: careRoutes, history, dispatch: context => seen.push(context) });
  onTestFinished(() => router.dispose());
  await router.start();
  const first = seen[0];
  const entry = history.write('https://care.example/alpha/worklist/owned-by');
  publish(entry, 'host');
  assert.equal(seen.at(-1).kind, 'host');
  assert.equal(first.signal.aborted, true);
  assert.equal(router.location.href, entry.href);
});

test('synchronous nested transport notification supersedes the outer write dispatch', async() => {
  const seen = [];
  const { router, history } = setup(context => seen.push(context));
  onTestFinished(() => router.dispose());
  await router.start();
  const write = history.write;
  history.write = (href, options) => {
    const entry = write(href, options);
    if (href.endsWith('/outer')) {void router.navigate(target('p', 'inner'));}
    return entry;
  };
  const result = await router.navigate(target('p', 'outer'));
  assert.equal(result.status, 'superseded');
  assert.equal(seen.length, 2);
  assert.equal(router.lastDispatch.match.params.interactionId, 'inner');
  assert.equal(router.location.href, history.read().href);
});
