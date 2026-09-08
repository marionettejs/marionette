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
  assert.equal(first.isDestroyed(), true);
  assert.equal(control.active.size, 0);
  assert.equal(control.releases, 1);
  restartReadiness.resolve();
  assert.equal(await restarted, true);
  assert.equal(control.active.size, 1);
  assert.equal(first.isDestroyed(), true);
  assert.notEqual(result.view, first);
  assert.equal(result.view.getState(), shared);
  assert.equal(result.view.getState().count, 9);
  await result.app.stop();
  assert.equal(control.releases, 2);
  const pendingStart = result.app.start();
  const pendingReadiness = await control.nextReady();
  await result.app.destroy();
  assert.equal(await pendingStart, false);
  assert.equal(pendingReadiness.signal.aborted, true);
  pendingReadiness.resolve();
  assert.equal(await result.app.start(), false);
  assert.equal(control.active.size, 0);
  assert.equal(control.releases, 2);
  assert.equal(result.child.isDestroyed(), true);
  assert.equal(result.view.isDestroyed(), true);
});
