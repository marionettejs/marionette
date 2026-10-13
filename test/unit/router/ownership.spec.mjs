import { test, onTestFinished } from 'vitest';
import assert from 'node:assert/strict';
import * as Marionette from 'marionette';
import { createRouter, createMemoryHistory } from '@mnjs/router';
import { createPatientOwner } from '../../router/owner.mjs';
import { careRoutes } from '../../router/routes.mjs';
const deferred = () => Promise.withResolvers();
const drain = () => new Promise(resolve => setImmediate(resolve));
async function fixture() {
  const runtime = Marionette.createMarionette();
  const mount = document.createElement('section');
  document.body.append(mount);
  const region = new runtime.Region({ el: mount });
  const patients = [];
  const feeds = [];
  const Owner = createPatientOwner(runtime, {
    loadPatient(id, { signal }) { const gate = { id, signal, ...deferred() }; patients.push(gate); return gate.promise; },
    loadInteractions(options, { signal }) { const gate = { options, signal, ...deferred() }; feeds.push(gate); return gate.promise; },
  });
  const owner = new Owner({ hostRegion: region });
  await owner.start();
  const history = createMemoryHistory('https://care.example/alpha/schedule');
  const errors = [];
  const router = createRouter({ routes: careRoutes, history, dispatch: context => owner.accept(context, region), onError: error => errors.push(error) });
  await router.start();
  onTestFinished(async() => {
    router.dispose(); owner.destroy(); region.destroy(); mount.remove();
    for (const item of [...patients, ...feeds]) {item.resolve([]);}
    await drain();
  });
  return { runtime, owner, router, region, mount, patients, feeds, errors };
}
const patientTarget = (patientId, interactionId, workspace = 'alpha') => ({ name: 'patient:interaction', params: { workspace, patientId, interactionId } });

test('new router + real Marionette retain patient preparation and dispatch only newest interaction', async() => {
  const { router, patients, feeds, mount } = await fixture();
  const first = router.navigate(patientTarget('p1', 'i1'));
  const second = router.navigate(patientTarget('p1', 'i2'));
  assert.equal(patients.length, 1);
  assert.equal(patients[0].signal.aborted, false);
  assert.equal((await first).status, 'superseded');
  patients[0].resolve({ id: 'p1' });
  await drain();
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].options.interactionId, 'i2');
  assert.match(mount.textContent, /Loading interactions/);
  feeds[0].resolve(['Interaction i2']);
  assert.equal((await second).status, 'handled');
  assert.match(mount.textContent, /Interaction i2/);
});

test('same feed target changes and explicit refresh retain shell while canceling old feed preparation', async() => {
  const { router, patients, feeds, region } = await fixture();
  const first = router.navigate(patientTarget('p1', 'i1'));
  patients[0].resolve({ id: 'p1' });
  await drain();
  const shell = region.currentView;
  const feed = shell.getRegion('content').currentView;
  const second = router.navigate(patientTarget('p1', 'i2'));
  await drain();
  assert.equal(feeds[0].signal.aborted, true);
  assert.equal(region.currentView, shell);
  assert.equal(shell.getRegion('content').currentView, feed);
  feeds[1].resolve(['i2']);
  await second;
  feeds[0].resolve(['stale i1']);
  await first;
  await drain();
  assert.equal(feed.el.textContent, 'i2');
  const refresh = router.refresh();
  await drain();
  assert.equal(feeds.length, 3);
  feeds[2].resolve(['fresh i2']);
  await refresh;
  assert.equal(shell.getRegion('content').currentView, feed);
  assert.equal(feed.el.textContent, 'fresh i2');
});

test('workspace/patient switch destroys previous shell and cancels its requests, including noncooperative results', async() => {
  const { router, patients, feeds, region, mount } = await fixture();
  const a = router.navigate(patientTarget('p1', 'i1'));
  patients[0].resolve({ id: 'p1' });
  await drain();
  const shell = region.currentView;
  const b = router.navigate(patientTarget('p1', 'i2', 'beta'));
  assert.equal(shell.isDestroyed(), true);
  assert.equal(feeds[0].signal.aborted, true);
  assert.equal(patients.length, 2);
  patients[1].resolve({ id: 'p1' });
  await drain();
  feeds[1].resolve(['beta i2']);
  await b;
  feeds[0].resolve(['old alpha i1']);
  await a;
  await drain();
  assert.equal(mount.textContent, 'Patient sidebarbeta i2');
});

test('host destruction fences effects even when route remains current; reentry works', async() => {
  const { router, owner, patients, feeds, region, mount } = await fixture();
  const task = router.navigate(patientTarget('p1', 'i1'));
  patients[0].resolve({ id: 'p1' });
  await drain();
  const routeContext = router.lastDispatch;
  region.empty();
  assert.equal(routeContext.isCurrent(), true); // Different authorities by design.
  assert.equal(owner.getChildApp('patient').isRunning(), false);
  assert.equal(feeds[0].signal.aborted, true);
  feeds[0].resolve(['must not mount']);
  await task;
  await drain();
  assert.equal(mount.textContent, '');
  const reentry = router.navigate(patientTarget('p1', 'i2'));
  patients[1].resolve({ id: 'p1' });
  await drain();
  feeds[1].resolve(['reentered']);
  await reentry;
  assert.match(mount.textContent, /reentered/);
});

test('stop during patient preparation prevents children starting after the late result', async() => {
  const { router, owner, patients, feeds, mount } = await fixture();
  const task = router.navigate(patientTarget('p1', 'i1'));
  owner.stop();
  assert.equal(patients[0].signal.aborted, true);
  patients[0].resolve({ id: 'p1' });
  await task;
  await drain();
  assert.equal(feeds.length, 0);
  assert.equal(mount.textContent, '');
});

test('A to B to A creates fresh preparation; old A cannot regain authority by matching resource ID', async() => {
  const { router, patients, feeds, mount } = await fixture();
  const oldA = router.navigate(patientTarget('a', 'old'));
  const b = router.navigate(patientTarget('b', 'b'));
  const newA = router.navigate(patientTarget('a', 'new'));
  assert.deepEqual(patients.map(item => item.id), ['a', 'b', 'a']);
  assert.equal(patients[0].signal.aborted, true);
  assert.equal(patients[1].signal.aborted, true);
  patients[2].resolve({ id: 'a' });
  await drain();
  feeds[0].resolve(['new A']);
  await newA;
  patients[0].resolve({ id: 'a' });
  patients[1].resolve({ id: 'b' });
  await Promise.all([oldA, b]);
  await drain();
  assert.equal(feeds.length, 1);
  assert.equal(mount.textContent, 'Patient sidebarnew A');
});

test('recoverable initial feed error retains retry shell and same-URL reentry retries it', async() => {
  const { router, patients, feeds, region, errors } = await fixture();
  const initial = router.navigate(patientTarget('p', 'i'));
  patients[0].resolve({ id: 'p' });
  await drain();
  const shell = region.currentView;
  const feed = shell.getRegion('content').currentView;
  feeds[0].reject(Object.assign(new Error('offline'), { kind: 'data' }));
  assert.equal((await initial).status, 'handled'); // Handler settled; UI is Retry, not ready data.
  assert.equal(feed.el.textContent, 'Retry interactions');
  assert.equal(feed.isDestroyed(), false);
  const retry = router.navigate(patientTarget('p', 'i'));
  await drain();
  feeds[1].resolve(['loaded after retry']);
  await retry;
  assert.equal(shell.getRegion('content').currentView, feed);
  assert.equal(feed.el.textContent, 'loaded after retry');
  assert.deepEqual(errors, []);
});

test('Application.start ignores active new options; restart explicitly reprepares', async() => {
  const inputs = [];
  const App = Marionette.Application.extend({ prepareStart(options) { inputs.push(options.id); } });
  const app = new App();
  onTestFinished(() => app.destroy());
  await app.start({ id: 'a' });
  await app.start({ id: 'b' });
  assert.deepEqual(inputs, ['a']);
  await app.restart({ id: 'c' });
  assert.deepEqual(inputs, ['a', 'c']);
});

test('synchronous startup failure does not imply activation rollback', async() => {
  const App = Marionette.Application.extend({ onStart() { throw new Error('render failure'); } });
  const app = new App();
  onTestFinished(() => app.destroy());
  await assert.rejects(app.start(), /render failure/);
  assert.equal(app.isRunning(), true);
});

test('borrowed host destruction before any shell exists cancels preparation and ends its owner', async() => {
  const { router, owner, patients, feeds, region, errors } = await fixture();
  const task = router.navigate(patientTarget('p1', 'i1'));
  assert.equal(region.currentView, undefined);
  region.destroy();
  assert.equal(owner.isDestroyed(), true);
  assert.equal(patients[0].signal.aborted, true);
  patients[0].resolve({ id: 'p1' });
  await task;
  await drain();
  assert.equal(feeds.length, 0);
  assert.deepEqual(errors, []);
  await router.navigate(patientTarget('p2', 'i2'));
  assert.equal(patients.length, 1);
});

test('date reflection leaves feature work owned by the feed; date restart supersedes target request without remount', async() => {
  const { router, owner, patients, feeds, region } = await fixture();
  const selected = router.navigate(patientTarget('p', 'target'));
  patients[0].resolve({ id: 'p' });
  await drain();
  const shell = region.currentView;
  const feedView = shell.getRegion('content').currentView;
  const feed = owner.getChildApp('patient').getChildApp('feed');
  await router.reflect({ name: 'patient:interactions', params: { workspace: 'alpha', patientId: 'p' } });
  assert.equal(feeds[0].signal.aborted, false); // Route abort does not own shared/feature work.
  const date = feed.restart({ kind: 'date', date: '2026-10-01' });
  assert.equal(feeds[0].signal.aborted, true); // The feature's operation does.
  feeds[1].resolve(['October 1']);
  await date;
  feeds[0].resolve(['old target']);
  await selected;
  await drain();
  assert.equal(shell.getRegion('content').currentView, feedView);
  assert.equal(feedView.el.textContent, 'October 1');
  assert.match(router.location.href, /patient\/p\/interactions$/);
});
