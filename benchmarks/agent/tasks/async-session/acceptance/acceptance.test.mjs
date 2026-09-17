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
test('stale provider acquisition and active subscription both release resources', { timeout: 3000 }, async() => {
  const requests = [deferred(), deferred(), deferred()];
  let acquired = 0;
  const calls = [];
  let afterDestroy = false;
  const afterDestroyProviders = [];
  const session = solution.createSession(() => {
    if (afterDestroy) {
      const acquiredProvider = provider();
      afterDestroyProviders.push(acquiredProvider);
      return Promise.resolve(acquiredProvider);
    }
    const d = deferred();
    assert.ok(acquired < requests.length, 'Unexpected provider acquisition');
    requests[acquired++].resolve(d);
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
  const staleRequest = await requests[0].promise;
  const second = session.start();
  staleRequest.resolve(stale);
  assert.equal(await first, false);
  (await requests[1].promise).resolve(active);
  assert.equal(await second, true);
  assert.equal(stale.closed, 1);
  assert.equal(stale.listeners.size, 0);
  [...active.listeners].forEach(fn => fn('hello'));
  assert.deepEqual(calls, ['hello']);
  await session.stop();
  await session.stop();
  assert.equal(active.listeners.size, 0);
  assert.equal(active.closed, 1);
  const third = session.start();
  await requests[2].promise;
  const late = provider();
  const destruction = session.destroy();
  (await requests[2].promise).resolve(late);
  await destruction;
  assert.equal(await third, false);
  assert.equal(late.closed, 1);
  afterDestroy = true;
  assert.equal(await session.start(), false);
  afterDestroyProviders.forEach(acquiredProvider => {
    assert.equal(acquiredProvider.closed, 1);
    assert.equal(acquiredProvider.listeners.size, 0);
  });
});
