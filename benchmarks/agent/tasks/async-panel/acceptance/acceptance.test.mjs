import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Region, Application } from 'marionette';
import * as solution from '../solution.mjs';
const host = () => {
  const el = document.createElement('main');
  document.body.append(el);
  return el;
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {
    promise,
    resolve,
    reject
  };
};
test('out-of-order completion, stop, failures and destroy are deterministic', async() => {
  const requests = new Map();
  const app = solution.createAsyncPanel(host(), id => {
    const request = deferred();
    requests.set(id, request);
    return request.promise;
  });
  assert.equal(app instanceof Application, false);
  assert.ok(app.region instanceof Region);
  const older = app.open('old');
  const newer = app.open('new');
  requests.get('new').resolve('New');
  assert.equal(await newer, true);
  requests.get('old').resolve('Old');
  assert.equal(await older, false);
  assert.equal(app.region.currentView.el.textContent, 'New');
  const failure = app.open('fail');
  requests.get('fail').reject(new Error('offline'));
  await assert.rejects(failure, /offline/);
  assert.equal(app.region.currentView.el.textContent, 'New');
  const stopped = app.open('stop');
  app.stop();
  requests.get('stop').resolve('late');
  assert.equal(await stopped, false);
  assert.equal(app.region.hasView(), false);
  const pending = app.open('destroy');
  app.destroy();
  requests.get('destroy').resolve('late');
  assert.equal(await pending, false);
  assert.equal(await app.open('unused'), false);
  assert.equal(requests.has('unused'), false);
});
