import assert from 'node:assert/strict';
import { test, afterEach } from 'vitest';
import { Router, RouteApplication, memoryDriver, routeTable } from '@mnjs/router';

const owned = [];
afterEach(() => { for (const app of owned.splice(0).reverse()) { app.destroy(); } });
const own = app => { owned.push(app); return app; };

async function start(Root, url = 'https://router.test/') {
  const router = own(new Router({ driver: memoryDriver({ url }) }));
  const root = own(new Root());
  root.mountRoutes(router);
  await root.start();
  await router.start();
  await router.getInitialDispatch();
  return { router, root };
}

test('a numeric path key has the same route-name semantics as its string spelling', () => {
  const Numeric = RouteApplication.extend({ routes: { 404: { name: 'missing' } } });
  const router = own(new Router());
  own(new Numeric()).mountRoutes(router);
  assert.equal(router.url('missing'), '/404');
  assert.equal(router.match('https://router.test/404').name, 'missing');
});

test('explicit dispatch of an old Match cannot run before-route hooks or its handler', async() => {
  const calls = [];
  const Root = RouteApplication.extend({
    routes: { 'a': { name: 'a', handler: 'show' }, 'b': { name: 'b', handler: 'show' } },
    onBeforeRoute(match) { calls.push(`before:${ match.name }`); },
    show(match) { calls.push(match.name); },
  });
  const { root, router } = await start(Root);
  await router.navigate('a').finished;
  const previous = router.getCurrent();
  await router.navigate('b').finished;
  const expected = calls.slice();
  await root.routeTo(previous);
  assert.deepEqual(calls, expected);
});

test('navigation from a mounted child stop prevents the stale parent leaf handler', async() => {
  const calls = [];
  let router;
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child' } },
    onStop() { router.navigate('newer'); },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: { 'child': { mount: 'child' }, 'parent': { name: 'parent', handler: 'show' }, 'newer': { name: 'newer', handler: 'show' } },
    show(match) { calls.push(match.name); },
  });
  const started = await start(Root);
  router = started.router;
  await router.navigate('child').finished;
  assert.equal(await router.navigate('parent').finished, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['newer']);
});

test('routeTable composes relative paths and namespaced names from mounted classes', () => {
  const Patient = RouteApplication.extend({
    routes: {
      'workflow': { name: 'workflow', handler: 'show' },
      'flow/:flowId': { name: 'flow', handler: 'show' },
    },
  });
  const Patients = RouteApplication.extend({
    childApps: { patient: Patient },
    routes: {
      'patient/:patientId': { mount: 'patient', namespace: 'patient' },
      'schedule': { name: 'schedule' },
    },
  });
  const router = own(new Router({ driver: memoryDriver({ url: 'https://router.test/' }) }));
  router.mount(routeTable(Patients), { controller: own(new Patients()) });

  assert.equal(router.url('patient:flow', { patientId: 'p', flowId: 'f' }), '/patient/p/flow/f');
  assert.equal(router.url('schedule'), '/schedule');
  assert.deepEqual(router.getParamNames('patient:flow'), ['patientId', 'flowId']);
  router.destroy();
});

test('routeTable rejects undeclared mounts, unrouted children, childApps factories and nameless leaves', () => {
  const Child = RouteApplication.extend();
  assert.throws(() => routeTable(RouteApplication.extend({
    routes: { 'a/:id': { mount: 'missing' } },
  })), /must be a RouteApplication class in a childApps object/);
  assert.throws(() => routeTable(RouteApplication.extend({
    childApps: { child: Object },
    routes: { 'a/:id': { mount: 'child' } },
  })), /must be a RouteApplication class in a childApps object/);
  assert.throws(() => routeTable(RouteApplication.extend({
    childApps: () => ({ child: Child }),
    routes: { 'a/:id': { mount: 'child' } },
  })), /must be a RouteApplication class in a childApps object/);
  assert.throws(() => routeTable(RouteApplication.extend({
    routes: { page: { handler: 'show' } },
  })), /requires a name/);
});

test('mounted children are keyed by their own params and receive the rest of the branch', async() => {
  const calls = [];
  const starts = [];
  const Patient = RouteApplication.extend({
    routes: {
      'workflow': { name: 'workflow', handler: 'show' },
      'flow/:flowId': { name: 'flow', handler: 'show' },
    },
    onStart(app, options) {
      starts.push(options);
    },
    show(match, { signal }) {
      calls.push([match.name, match.params.flowId, signal === match.signal]);
    },
  });
  const Patients = RouteApplication.extend({
    childApps: { patient: Patient },
    routes: {
      ':workspace/patient/:patientId': { mount: 'patient', namespace: 'patient' },
    },
  });
  const { router, root } = await start(Patients);

  await router.navigate('patient:workflow', { workspace: 'one', patientId: 'a' }).finished;
  await router.navigate('patient:flow', { flowId: 'f' }).finished;
  await router.navigate('patient:workflow', { patientId: 'b' }).finished;
  assert.deepEqual(starts.map(({ workspace, patientId }) => [workspace, patientId]), [
    ['one', 'a'],
    ['one', 'b'],
  ], 'each child starts with its mount params; omitted params reuse the current match');
  assert.deepEqual(calls, [
    ['patient:workflow', undefined, true],
    ['patient:flow', 'f', true],
    ['patient:workflow', undefined, true],
  ]);
  router.destroy();
  root.destroy();
});

test('before:route runs at each level before that level selects or handles', async() => {
  const events = [];
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child', handler: 'show' } },
    onBeforeRoute(match) {
      events.push(`child:before:${ match.name }`);
    },
    show() {
      events.push('child:show');
    },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: { 'child': { mount: 'child' } },
    onBeforeRoute(match) {
      events.push(`root:before:${ match.name }`);
    },
  });
  const { router, root } = await start(Root);
  await router.navigate('child').finished;

  assert.deepEqual(events, ['root:before:child', 'child:before:child', 'child:show']);
  router.destroy();
  root.destroy();
});

test('a superseded child start never dispatches its stale branch', async() => {
  const calls = [];
  const gate = Promise.withResolvers();
  const Slow = RouteApplication.extend({
    routes: { '': { name: 'slow', handler: 'show' } },
    prepareStart() {
      return gate.promise;
    },
    show() {
      calls.push('slow');
    },
  });
  const Fast = RouteApplication.extend({
    routes: { '': { name: 'fast', handler: 'show' } },
    show() {
      calls.push('fast');
    },
  });
  const Root = RouteApplication.extend({
    childApps: { slow: Slow, fast: Fast },
    routes: [
      { path: 'slow', mount: 'slow' },
      { path: 'fast', mount: 'fast' },
    ],
  });
  const { router, root } = await start(Root);

  const first = router.navigate('slow');
  await first.committed;
  const second = router.navigate('fast');
  gate.resolve();
  assert.equal(await first.finished, false);
  assert.equal(await second.finished, true);
  assert.deepEqual(calls, ['fast']);
  assert.equal(root.getCurrent(), root.getChildApp('fast'));
  router.destroy();
  root.destroy();
});

test('a newer navigation joins a same-key child start instead of cancelling it', async() => {
  const gate = Promise.withResolvers();
  let starts = 0;
  const calls = [];
  const Patient = RouteApplication.extend({
    routes: {
      'workflow': { name: 'workflow', handler: 'show' },
      'flow': { name: 'flow', handler: 'show' },
    },
    prepareStart(options, { signal }) {
      starts++;
      return gate.promise.then(() => signal.aborted);
    },
    onStart(app, options, aborted) {
      calls.push(`started:aborted=${ aborted }`);
    },
    show(match) {
      calls.push(match.name);
    },
  });
  const Root = RouteApplication.extend({
    childApps: { patient: Patient },
    routes: { 'patient/:patientId': { mount: 'patient' } },
  });
  const { router, root } = await start(Root);

  const first = router.navigate('workflow', { patientId: 'p' });
  await first.committed;
  const second = router.navigate('flow', { patientId: 'p' });
  await second.committed;
  gate.resolve();
  assert.equal(await first.finished, false);
  assert.equal(await second.finished, true);
  assert.equal(starts, 1);
  assert.deepEqual(calls, ['started:aborted=false', 'flow']);
  router.destroy();
  root.destroy();
});

test('an abort between selection and the child branch skips the child handler', async() => {
  const calls = [];
  let router;
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child', handler: 'show' } },
    onStart() {
      router.navigate('elsewhere');
    },
    show(match) {
      calls.push(match.name);
    },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: {
      'child': { mount: 'child' },
      'elsewhere': { name: 'elsewhere', handler: 'show' },
    },
    show(match) {
      calls.push(match.name);
    },
  });
  const started = await start(Root);
  router = started.router;

  assert.equal(await router.navigate('child').finished, false);
  await new Promise(resolve => setTimeout(resolve));
  assert.deepEqual(calls, ['elsewhere']);
  router.destroy();
  started.root.destroy();
});

test('destroying the root during activation cancels the navigation without dispatching', async() => {
  const gate = Promise.withResolvers();
  const calls = [];
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child', handler: 'show' } },
    prepareStart() {
      return gate.promise;
    },
    show() {
      calls.push('child');
    },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: { 'child': { mount: 'child' } },
  });
  const { router, root } = await start(Root);

  const navigation = router.navigate('child');
  await navigation.committed;
  root.destroy();
  gate.resolve();
  assert.equal(await navigation.finished, false);
  assert.deepEqual(calls, []);
  assert.equal(router.hasRoute('child'), false, 'destroying the owner retires its routes');
  router.destroy();
});

test('failures go to the nearest handleRouteError with their phase, otherwise to route:error', async() => {
  const startup = new Error('startup');
  const page = new Error('page');
  const handled = [];
  const reported = [];
  const Child = RouteApplication.extend({
    routes: {
      'ok': { name: 'ok', handler: 'fail' },
      'broken': { name: 'broken', handler: 'fail' },
    },
    prepareStart({ id }) {
      if (id === 'bad') { throw startup; }
    },
    fail() {
      throw page;
    },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: { 'child/:id': { mount: 'child' } },
    handleRouteError(error, match, { mount, phase }) {
      if (error === page && match.name === 'broken') { throw error; }
      handled.push([error, mount, phase]);
    },
  });
  const { router, root } = await start(Root);
  router.on('route:error', error => reported.push(error));

  assert.equal(await router.navigate('ok', { id: 'bad' }).finished, true);
  assert.equal(await router.navigate('ok', { id: 'good' }).finished, true);
  await assert.rejects(router.navigate('broken').finished, page);
  assert.deepEqual(handled, [[startup, 'child', 'start'], [page, 'child', 'route']]);
  assert.deepEqual(reported, [page]);
  router.destroy();
  root.destroy();
});

test('a named redirect into a mount forwards params, query and hash', async() => {
  const seen = [];
  const Patient = RouteApplication.extend({
    routes: { 'workflow': { name: 'workflow', handler: 'show' } },
    show(match) {
      seen.push([match.params.patientId, match.url.search, match.url.hash]);
    },
  });
  const Root = RouteApplication.extend({
    childApps: { patient: Patient },
    routes: {
      'patient/:patientId': { mount: 'patient', namespace: 'patient' },
      'patient/dashboard/:patientId': { name: 'legacy:dashboard', redirect: { name: 'patient:workflow' } },
    },
  });
  const { router, root } = await start(Root, 'https://router.test/patient/dashboard/p?tab=1#top');

  assert.equal(router.getCurrent().name, 'patient:workflow');
  assert.deepEqual(seen, [['p', '?tab=1', '#top']]);
  router.destroy();
  root.destroy();
});

test('route data on other nodes does not confuse dispatch', async() => {
  const calls = [];
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child', handler: 'show' } },
    show() {
      calls.push('child');
    },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: { 'child': { mount: 'child' } },
  });
  const router = own(new Router({
    driver: memoryDriver({ url: 'https://router.test/' }),
    routes: [{ name: 'scope', path: '/:scope', data: { custom: true } }],
  }));
  const root = own(new Root());
  root.mountRoutes(router, { parent: 'scope' });
  await root.start();
  await router.start();
  await router.getInitialDispatch();
  await router.navigate('child', { scope: 's' }).finished;

  assert.deepEqual(calls, ['child']);
  router.destroy();
  root.destroy();
});

test('childRouteOptions and mount regions shape child startup', async() => {
  const requested = [];
  let started;
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child' } },
    onStart(app, options) {
      started = options;
    },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: { 'thing/:thingId': { mount: 'child', region: 'content' } },
    getView() {
      return {
        getRegion(name) {
          requested.push(name);
        },
      };
    },
    childRouteOptions(match, appName) {
      return { owner: appName };
    },
  });
  const { router, root } = await start(Root);
  await router.navigate('child', { thingId: 't' }).finished;

  assert.equal(started.owner, 'child');
  assert.equal(started.thingId, 't');
  assert.deepEqual(requested, ['content']);
  router.destroy();
  root.destroy();
});

test('same-key selections share one outcome; a different selection supersedes', async() => {
  const { Application } = await import('marionette');
  const gate = Promise.withResolvers();
  const failure = new Error('start failed');
  const Owner = RouteApplication.extend({
    childApps: {
      page: Application.extend({
        prepareStart() {
          return gate.promise;
        },
      }),
      other: Application,
    },
  });
  const owner = own(new Owner());
  await owner.start();
  const page = owner.getChildApp('page');

  const first = owner.switchTo('page', { key: { id: 1 } });
  const joined = owner.switchTo('page', { key: { id: 1 } });
  gate.resolve();
  assert.equal(await first, page, 'the earlier call keeps its result when joined');
  assert.equal(await joined, page);

  owner.clear();
  const again = Promise.withResolvers();
  page.prepareStart = () => again.promise.then(() => {
    throw failure;
  });
  const failing = owner.switchTo('page', { key: { id: 2 } });
  const joinedFailure = owner.switchTo('page', { key: { id: 2 } });
  again.resolve();
  await assert.rejects(failing, failure);
  await assert.rejects(joinedFailure, failure);

  const hold = Promise.withResolvers();
  page.prepareStart = () => hold.promise;
  const replaced = owner.switchTo('page', { key: { id: 3 } });
  const other = owner.switchTo('other');
  hold.resolve();
  assert.equal(await replaced, undefined, 'a different selection supersedes the earlier call');
  assert.equal(await other, owner.getChildApp('other'));
  owner.destroy();
});

test('a navigation started by onBeforeRoute keeps the stale handler from running', async() => {
  const calls = [];
  let router;
  const Root = RouteApplication.extend({
    routes: {
      'a': { name: 'a', handler: 'show' },
      'b': { name: 'b', handler: 'show' },
    },
    onBeforeRoute(match) {
      if (match.name === 'a') { router.navigate('b'); }
    },
    show(match) {
      calls.push(match.name);
    },
  });
  const started = await start(Root);
  router = started.router;

  assert.equal(await router.navigate('a').finished, false);
  await new Promise(resolve => setTimeout(resolve));
  assert.deepEqual(calls, ['b']);
  router.destroy();
  started.root.destroy();
});

test('a table mounted beneath another table dispatches only its own routes', async() => {
  const calls = [];
  const Inner = RouteApplication.extend({
    routes: { 'detail': { name: 'detail', handler: 'show' } },
    show() {
      calls.push('inner');
    },
  });
  const Outer = RouteApplication.extend({
    routes: { 'outer/:id': { name: 'outer', handler: 'show' } },
    show() {
      calls.push('outer');
    },
  });
  const router = own(new Router({ driver: memoryDriver({ url: 'https://router.test/' }) }));
  const outer = own(new Outer());
  const inner = own(new Inner());
  outer.mountRoutes(router);
  inner.mountRoutes(router, { parent: 'outer' });
  await outer.start();
  await inner.start();
  await router.start();
  await router.getInitialDispatch();
  await router.navigate('detail', { id: '1' }).finished;

  assert.deepEqual(calls, ['inner']);
  router.destroy();
  outer.destroy();
  inner.destroy();
});

test('a page of the parent stops a child selected through a mount', async() => {
  const Child = RouteApplication.extend({
    routes: { '': { name: 'child' } },
  });
  const Root = RouteApplication.extend({
    childApps: { child: Child },
    routes: {
      'child': { mount: 'child' },
      'list': { name: 'list' },
    },
  });
  const { router, root } = await start(Root);
  await router.navigate('child').finished;
  assert.equal(root.getChildApp('child').isRunning(), true);
  await router.navigate('list').finished;

  assert.equal(root.getChildApp('child').isRunning(), false);
  assert.equal(root.getCurrent(), null);
  router.destroy();
  root.destroy();
});
