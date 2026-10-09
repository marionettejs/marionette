import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Application } from 'marionette';
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
test('borrowed state survives deferred Application restart and canceled destroy', async() => {
  const shared = {
    count: 3,
    dispose() {
      throw new Error('Borrowed state must not be disposed');
    }
  };
  const domain = Object.freeze({
    id: 1
  });
  const control = controlledLifecycle();
  const result = solution.createStateWorkspace(host(), shared, domain, control.lifecycle);
  assert.ok(result.app instanceof Application);
  assert.equal(result.app.getChildApp('editor'), result.child);
  const started = result.app.start();
  const initialReadiness = await control.nextReady();
  assert.equal(result.child.getView(), undefined);
  assert.equal(control.active.size, 0);
  initialReadiness.resolve();
  assert.equal(await started, true);
  assert.equal(control.active.size, 1);
  assert.equal(result.app.getState(), shared);
  assert.equal(result.child.getState(), shared);
  assert.equal(result.view.getState(), shared);
  assert.equal(result.view.model, domain);
  const other = new Application();
  assert.throws(() => other.addChildApp('wrong', result.child));
  assert.equal(result.app.getChildApp('editor'), result.child);
  await other.destroy();
  const first = result.view;
  shared.count = 9;
  const restarted = result.app.restart();
  const restartReadiness = await control.nextReady();
  assert.equal(first.isDestroyed(), false);
  assert.equal(result.child.getView(), first);
  assert.equal(control.active.size, 1);
  assert.equal(control.releases, 0);
  restartReadiness.resolve();
  assert.equal(await restarted, true);
  assert.equal(control.active.size, 1);
  assert.equal(first.isDestroyed(), false);
  assert.equal(result.view, first);
  assert.equal(result.view.getState(), shared);
  assert.equal(result.view.getState().count, 9);
  const finalView = result.view;
  await result.app.stop();
  assert.equal(finalView.isDestroyed(), true);
  assert.equal(control.releases, 1);
  const pendingStart = result.app.start();
  const pendingReadiness = await control.nextReady();
  await result.app.destroy();
  assert.equal(await pendingStart, false);
  assert.equal(pendingReadiness.signal.aborted, true);
  pendingReadiness.resolve();
  assert.equal(await result.app.start(), false);
  assert.equal(control.active.size, 0);
  assert.equal(control.releases, 1);
  assert.equal(result.child.isDestroyed(), true);
  assert.equal(finalView.isDestroyed(), true);
});

for (const event of ['before:start', 'start', 'resolved']) {
  test(`borrowed workspace cancels child startup when parent restarts at child ${event}`, async() => {
    const readiness = Promise.withResolvers();
    let calls = 0;
    let subscriptions = 0;
    const state = { dispose() {} };
    const workspace = solution.createStateWorkspace(document.createElement('main'), state, {}, {
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
