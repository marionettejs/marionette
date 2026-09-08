import './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MnObject, Application } from 'marionette';
import * as solution from '../solution.mjs';
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
test('stale provider acquisition and active subscription both release resources', async() => {
  const requests = [];
  const calls = [];
  const session = solution.createSession(() => {
    const d = deferred();
    requests.push(d);
    return d.promise;
  }, message => calls.push(message));
  assert.equal(session instanceof Application, false);
  assert.equal(session instanceof MnObject, false);
  const provider = () => {
    const listeners = new Set();
    let closed = 0;
    return {
      listeners,
      get closed() {
        return closed;
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      close() {
        closed++;
      }
    };
  };
  const stale = provider();
  const active = provider();
  const first = session.start();
  const second = session.start();
  requests[1].resolve(active);
  assert.equal(await second, true);
  requests[0].resolve(stale);
  assert.equal(await first, false);
  assert.equal(stale.closed, 1);
  assert.equal(stale.listeners.size, 0);
  [...active.listeners].forEach(fn => fn('hello'));
  assert.deepEqual(calls, ['hello']);
  session.stop();
  session.stop();
  assert.equal(active.listeners.size, 0);
  assert.equal(active.closed, 1);
  const third = session.start();
  const late = provider();
  session.destroy();
  requests[2].resolve(late);
  assert.equal(await third, false);
  assert.equal(late.closed, 1);
  assert.equal(await session.start(), false);
});
