import '../../benchmarks/agent/support/environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAsyncPanel } from '../../benchmarks/agent/tasks/async-panel/reference/solution.mjs';
import { createSession } from '../../benchmarks/agent/tasks/async-session/reference/solution.mjs';
import { createStateWorkspace as ownedWorkspace } from '../../benchmarks/agent/tasks/owned-workspace-state/reference/solution.mjs';
import { createStateWorkspace as borrowedWorkspace } from '../../benchmarks/agent/tasks/borrowed-workspace-state/reference/solution.mjs';

for (const cancel of ['open', 'stop', 'destroy']) {
  test(`async panel ignores rejected loads after ${cancel}`, async() => {
    const obsolete = Promise.withResolvers();
    const el = document.createElement('main');
    const panel = createAsyncPanel(el, id => id === 'old' ? obsolete.promise : Promise.resolve('current'));
    const pending = panel.open('old');
    try {
      if (cancel === 'open') { await panel.open('new'); } else { panel[cancel](); }
      obsolete.reject(new Error('obsolete load'));
      assert.equal(await pending, false);
      assert.equal(el.textContent, cancel === 'open' ? 'current' : '');
    } finally { panel.destroy(); }
  });
}

test('async panel preserves current load failures', async() => {
  const failure = new Error('current load');
  const panel = createAsyncPanel(document.createElement('main'), () => Promise.reject(failure));
  try { await assert.rejects(panel.open('current'), error => error === failure); } finally { panel.destroy(); }
});

for (const cancel of ['stop', 'destroy', 'start']) {
  test(`async session unsubscribes before closing after synchronous ${cancel}`, async() => {
    const calls = [];
    let acquired = 0;
    let cancellation;
    const provider = label => {
      let closed = false;
      return {
        subscribe(onMessage) {
          if (label === 'first') { onMessage('ready'); }
          return () => {
            assert.equal(closed, false, 'unsubscribe must precede provider close');
            calls.push(`${label}:unsubscribe`);
          };
        },
        close() { assert.equal(closed, false); closed = true; calls.push(`${label}:close`); }
      };
    };
    const session = createSession(() => Promise.resolve(provider(++acquired === 1 ? 'first' : 'replacement')),
      () => { cancellation = session[cancel](); });
    try {
      assert.equal(await session.start(), false);
      await cancellation;
      assert.deepEqual(calls, ['first:unsubscribe', 'first:close']);
      await session.stop();
      assert.deepEqual(calls, cancel === 'start' ?
        ['first:unsubscribe', 'first:close', 'replacement:unsubscribe', 'replacement:close'] :
        ['first:unsubscribe', 'first:close']);
    } finally { await session.destroy(); }
    assert.equal(calls.length, cancel === 'start' ? 4 : 2);
  });
}

for (const [ownership, createWorkspace] of [['owned', ownedWorkspace], ['borrowed', borrowedWorkspace]]) {
  for (const event of ['before:start', 'start', 'resolved']) {
    test(`${ownership} workspace cancels child startup when parent restarts at child ${event}`, async() => {
      const readiness = Promise.withResolvers();
      let calls = 0;
      let subscriptions = 0;
      const state = { dispose() {} };
      const workspace = createWorkspace(document.createElement('main'), ownership === 'owned' ? () => state : state, {}, {
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
}

for (const [ownership, createWorkspace] of [['owned', ownedWorkspace], ['borrowed', borrowedWorkspace]]) {
  test(`${ownership} workspace reports a destroyed required child explicitly`, async() => {
    const state = { dispose() {} };
    const workspace = createWorkspace(document.createElement('main'), ownership === 'owned' ? () => state : state, {}, {
      ready() { return Promise.resolve(); },
      subscribe() { throw new Error('Canceled startup must not subscribe'); }
    });
    workspace.child.destroy();
    try {
      await assert.rejects(workspace.app.start(), /^Error: Editor startup canceled$/);
      assert.equal(workspace.app.isRunning(), false);
    } finally { workspace.app.destroy(); }
  });
}
