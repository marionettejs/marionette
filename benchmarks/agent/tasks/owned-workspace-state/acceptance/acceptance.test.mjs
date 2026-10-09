import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { View, Application } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
function controlledLifecycle() {
  const requests = [];
  const waiting = [];
  const queued = [];
  const active = new Set();
  let releases = 0;
  const lifecycle = {
    ready(signal) {
      const deferred = Promise.withResolvers();
      const request = { ...deferred, signal };
      requests.push(request);
      if (waiting.length) { waiting.shift()(request); } else { queued.push(request); }
      return deferred.promise;
    },
    subscribe() {
      const subscription = {};
      active.add(subscription);
      return () => {
        assert.equal(active.delete(subscription), true, 'session must be released exactly once');
        releases++;
      };
    }
  };
  return { lifecycle, requests, active, get releases() { return releases; },
    nextReady() { return queued.length ? Promise.resolve(queued.shift()) : new Promise(resolve => waiting.push(resolve)); }
  };
}
test('owned state survives deferred Application restart and session cleanup', async() => {
  const sources = [];
  const makeState = role => {
    const state = {
      role,
      disposed: 0,
      dispose() {
        this.disposed++;
      }
    };
    sources.push(state);
    return state;
  };
  const domain = {
    id: 7,
    dispose() {
      throw new Error('Domain must not be disposed');
    }
  };
  const control = controlledLifecycle();
  const result = solution.createStateWorkspace(host(), makeState, domain, control.lifecycle);
  assert.ok(result.app instanceof Application);
  assert.equal(result.app.getChildApp('editor'), result.child);
  assert.equal(result.child.getName(), 'editor');
  const canceled = result.app.start();
  const canceledReadiness = await control.nextReady();
  assert.equal(result.app.isRunning(), false);
  assert.equal(result.child.getView(), undefined);
  assert.equal(control.active.size, 0);
  assert.equal(await result.app.stop(), true);
  assert.equal(await canceled, false);
  assert.equal(canceledReadiness.signal.aborted, true);
  canceledReadiness.resolve();
  assert.equal(result.view, undefined);
  const started = result.app.start();
  const initialReadiness = await control.nextReady();
  initialReadiness.resolve();
  assert.equal(await started, true);
  assert.equal(control.active.size, 1);
  const firstView = result.view;
  assert.ok(firstView instanceof View);
  assert.equal(firstView.model, domain);
  assert.equal(result.child.getView(), firstView);
  assert.equal(result.app.getState().role, 'app');
  assert.equal(result.child.getState().role, 'child');
  assert.equal(firstView.getState().role, 'view');
  const restarting = result.app.restart();
  const staleReadiness = await control.nextReady();
  assert.equal(firstView.isDestroyed(), false);
  assert.equal(result.child.getView(), firstView);
  assert.equal(control.active.size, 1);
  assert.equal(control.releases, 0);
  assert.equal(result.app.isRunning(), true);
  assert.equal(sources.find(s => s.role === 'app').disposed, 0);
  assert.equal(sources.find(s => s.role === 'child').disposed, 0);
  assert.equal(sources.find(s => s.role === 'view').disposed, 0);
  const replacement = result.app.restart();
  const replacementReadiness = await control.nextReady();
  assert.notEqual(replacement, restarting);
  assert.equal(await restarting, false);
  assert.equal(staleReadiness.signal.aborted, true);
  staleReadiness.resolve();
  replacementReadiness.resolve();
  assert.equal(await replacement, true);
  assert.equal(result.view, firstView);
  assert.equal(control.active.size, 1);
  assert.equal(control.releases, 0);
  const canceledRestart = result.app.restart();
  const canceledRestartReadiness = await control.nextReady();
  assert.equal(await result.app.stop(), true);
  assert.equal(await canceledRestart, false);
  assert.equal(canceledRestartReadiness.signal.aborted, true);
  canceledRestartReadiness.resolve();
  assert.equal(firstView.isDestroyed(), true);
  assert.equal(control.active.size, 0);
  assert.equal(control.releases, 1);
  assert.equal(sources.find(s => s.role === 'view').disposed, 1);
  const latestRestart = result.app.restart();
  const latestReadiness = await control.nextReady();
  latestReadiness.resolve();
  assert.equal(await latestRestart, true);
  assert.equal(control.active.size, 1);
  assert.notEqual(result.view, firstView);
  assert.equal(result.child.isRunning(), true);
  assert.equal(result.view.model, domain);
  await result.app.destroy();
  await result.app.destroy();
  assert.equal(result.child.isDestroyed(), true);
  assert.equal(control.active.size, 0);
  assert.equal(control.releases, 2);
  assert.equal(sources.length, 4);
  sources.forEach(state => assert.equal(state.disposed, 1));
});

for (const event of ['before:start', 'start', 'resolved']) {
  test(`owned workspace cancels child startup when parent restarts at child ${event}`, async() => {
    const readiness = Promise.withResolvers();
    let calls = 0;
    let subscriptions = 0;
    const state = { dispose() {} };
    const workspace = solution.createStateWorkspace(document.createElement('main'), () => state, {}, {
      ready() { return ++calls === 1 ? Promise.resolve() : readiness.promise; },
      subscribe() { subscriptions++; return () => { subscriptions--; }; }
    });
    let replacement;
    let cancellation;
    if (event === 'resolved') {
      workspace.child.once('before:start', () => {
        // Join the actual pending child start before the parent awaits it. The
        // extra microtask runs after that await, but before the parent commits.
        cancellation = workspace.child.start().then(() => {
          queueMicrotask(() => { replacement = workspace.app.restart(); });
        });
      });
    } else {
      workspace.child.once(event, () => { replacement = workspace.app.restart(); });
    }
    try {
      assert.equal(await workspace.app.start(), false);
      await cancellation;
      assert.equal(calls, 2);
      assert.equal(workspace.app.isRunning(), false);
      assert.equal(workspace.child.isRunning(), false);
      assert.equal(workspace.child.getView(), undefined);
      assert.equal(subscriptions, 0);
      readiness.resolve();
      assert.equal(await replacement, true);
      assert.equal(workspace.child.isRunning(), true);
      assert.equal(workspace.child.getView().isDestroyed(), false);
      assert.equal(subscriptions, 1);
    } finally { workspace.app.destroy(); }
    assert.equal(subscriptions, 0);
  });
}
