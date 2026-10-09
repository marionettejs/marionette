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

for (const cancel of ['stop', 'destroy']) {
  test(`async session releases a subscription acquired during synchronous ${cancel}`, async() => {
    let closed = 0;
    let released = 0;
    const provider = {
      subscribe(onMessage) { onMessage('ready'); return () => { released++; }; },
      close() { closed++; }
    };
    const session = createSession(() => Promise.resolve(provider), () => session[cancel]());
    try {
      assert.equal(await session.start(), false);
      assert.equal(closed, 1);
      assert.equal(released, 1);
    } finally { session.destroy(); }
    assert.equal(closed, 1);
    assert.equal(released, 1);
  });
}

for (const [ownership, createWorkspace] of [['owned', ownedWorkspace], ['borrowed', borrowedWorkspace]]) {
  for (const event of ['before:start', 'start']) {
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
      workspace.child.once(event, () => { replacement = workspace.app.restart(); });
      try {
        assert.equal(await workspace.app.start(), false);
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
