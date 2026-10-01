import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, View } from 'marionette';
import { Model, StateApi } from '@mnjs/data';

const apps = [];
function make(properties = {}) {
  const app = new (Application.extend(properties))({ region: { el: document.createElement('main') } });
  apps.push(app);
  return app;
}
afterEach(async() => {
  for (const app of apps.splice(0)) { await app.destroy(); }
});

describe('synchronous Application stop', () => {
  it('stops descendants and destroys its root before returning a boolean', async() => {
    const calls = [];
    const app = make({
      onBeforeStop() { calls.push('owner:before'); },
      onStop() { calls.push('owner:stop'); }
    });
    const Child = Application.extend({ onStop() { calls.push(this.getName()); } });
    const first = app.addChildApp('first', new Child());
    const second = app.addChildApp('second', new Child());
    await app.start();
    await first.start();
    await second.start();
    const root = app.showView(new (View.extend({ template: false, onDestroy() { calls.push('root'); } }))());
    expect(app.stop({ source: 'test' })).toBe(true);
    expect(calls).toEqual(['owner:before', 'first', 'second', 'root', 'owner:stop']);
    expect(app.isRunning()).toBe(false);
    expect(first.isRunning()).toBe(false);
    expect(second.isRunning()).toBe(false);
    expect(root.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();
    expect(app.stop()).toBe(true);
    expect(calls).toHaveLength(5);
  });

  it('cancels pending preparation and suppresses stale completion immediately', async() => {
    const ready = Promise.withResolvers();
    let signal;
    const completed = vi.fn();
    const app = make({
      prepareStart(options, context) { signal = context.signal; return ready.promise; },
      onStart: completed
    });
    const started = app.start();
    expect(app.stop()).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(app.isRunning()).toBe(false);
    expect(await started).toBe(false);
    ready.resolve();
    await ready.promise;
    expect(completed).not.toHaveBeenCalled();
  });

  it('does not notify released hooks after cancellation destroys the Application', async() => {
    const beforeStop = vi.fn();
    const app = make({
      prepareStart(options, { signal }) {
        signal.addEventListener('abort', () => this.destroy(), { once: true });
        return new Promise(() => {});
      },
      onBeforeStop: beforeStop
    });
    const pending = app.start();
    expect(app.stop()).toBe(true);
    expect(await pending).toBe(false);
    expect(app.isDestroyed()).toBe(true);
    expect(app.getRegion()).toBeUndefined();
    expect(beforeStop).not.toHaveBeenCalled();
  });

  it('does not await notification promises', async() => {
    const notification = Promise.withResolvers();
    const calls = [];
    const app = make({
      onBeforeStop() { calls.push('before'); return notification.promise; },
      onStop() { calls.push('stop'); return notification.promise; }
    });
    await app.start();
    expect(app.stop()).toBe(true);
    expect(calls).toEqual(['before', 'stop']);
    expect(app.isRunning()).toBe(false);
    notification.resolve();
  });

  it('makes stopped state visible before completion and suppresses state delivery', async() => {
    const state = new Model();
    const changed = vi.fn();
    const app = make({
      state, State: StateApi, stateEvents: { change: changed },
      onStop() { expect(this.isRunning()).toBe(false); state.set('value', 'stopped'); }
    });
    await app.start();
    state.set('value', 'running');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(app.stop()).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
    await app.destroy();
    state.destroy();
  });

  it('blocks descendant activation during cleanup and permits it after completion', async() => {
    const attempts = [];
    let child;
    const app = make({
      onBeforeStop() { attempts.push(child.start()); },
      onStop() { attempts.push(child.restart()); }
    });
    child = app.addChildApp('child', new Application());
    await app.start();
    expect(app.stop()).toBe(true);
    expect(await Promise.all(attempts)).toEqual([false, true]);
    expect(await child.start()).toBe(true);
  });

  it('completes stop when before:stop requests restart', async() => {
    const app = make();
    await app.start();
    const root = app.showView(new View({ template: false }));
    let restart;
    app.once('before:stop', () => { restart = app.restart(); });
    expect(app.stop()).toBe(true);
    expect(root.isDestroyed()).toBe(true);
    expect(await restart).toBe(false);
    expect(app.isRunning()).toBe(false);
  });

  it('allows a completed stop callback to start a fresh run', async() => {
    let started;
    const app = make({ onStop() { started = this.start(); } });
    await app.start();
    const root = app.showView(new View({ template: false }));
    expect(app.stop()).toBe(true);
    expect(root.isDestroyed()).toBe(true);
    expect(await started).toBe(true);
  });

  it('throws notification failures synchronously', async() => {
    const error = new Error('stop failed');
    const app = make();
    await app.start();
    app.once('before:stop', () => { throw error; });
    expect(() => app.stop()).toThrow(error);
  });
  it('blocks start while stop cleanup is executing', async() => {
    const app = make();
    await app.start();
    const root = app.showView(new View({ template: false }));
    let started;
    app.once('before:stop', () => { started = app.start({ region: app.getRegion() }); });
    expect(app.stop()).toBe(true);
    expect(await started).toBe(false);
    expect(root.isDestroyed()).toBe(true);
    expect(app.isRunning()).toBe(false);
  });

  it('ignores nested stop while cleanup runs and after completion', async() => {
    const results = [];
    const app = make({
      onBeforeStop() { results.push(this.stop()); },
      onStop() { results.push(this.stop()); }
    });
    await app.start();
    expect(app.stop()).toBe(true);
    expect(results).toEqual([true, true]);
  });

  it('stops every child when a child completion requests owner restart', async() => {
    let restarted;
    const app = make();
    const first = app.addChildApp('first', new Application());
    const second = app.addChildApp('second', new Application());
    await app.start();
    await first.start();
    await second.start();
    first.once('stop', () => { restarted = app.restart(); });
    expect(app.stop()).toBe(true);
    expect(first.isRunning()).toBe(false);
    expect(second.isRunning()).toBe(false);
    expect(await restarted).toBe(false);
  });

  it('blocks activation from abort listeners during stop', async() => {
    const ready = Promise.withResolvers();
    let replacement;
    let app;
    app = make({ prepareStart(options, { signal }) {
      if (!options?.hold) { return; }
      signal.addEventListener('abort', () => { replacement = this.restart(); }, { once: true });
      return ready.promise;
    } });
    const original = app.start({ hold: true });
    expect(app.stop()).toBe(true);
    expect(await original).toBe(false);
    expect(await replacement).toBe(false);
    ready.resolve();
  });

  it('lets abort listeners replace newer asynchronous preparation', async() => {
    const ready = Promise.withResolvers();
    let stopped;
    const app = make({ prepareStart(options, { signal }) {
      if (!options?.hold) { return; }
      signal.addEventListener('abort', () => { stopped = this.stop(); }, { once: true });
      return ready.promise;
    } });
    const original = app.start({ hold: true });
    const replacement = app.restart();
    expect(stopped).toBe(true);
    expect(await original).toBe(false);
    expect(await replacement).toBe(false);
    ready.resolve();
  });

});
