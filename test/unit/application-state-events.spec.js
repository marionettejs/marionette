import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarionette } from 'marionette';
import { Model, StateApi } from '@mnjs/data';

describe('Application state events follow activation', function() {
  let runtime;
  let state;
  let owners;
  let pending;

  beforeEach(function() {
    runtime = createMarionette();
    runtime.setStateApi(StateApi);
    state = new Model();
    owners = [];
    pending = [];
  });

  afterEach(async function() {
    pending.forEach(resolve => resolve());
    for (const owner of owners) { await owner.destroy(); }
    state.destroy();
  });

  function createApp(properties = {}) {
    const App = runtime.Application.extend(properties);
    const app = new App({ state });
    owners.push(app);
    return app;
  }

  function readiness() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    pending.push(resolve);
    return { promise, resolve, reject };
  }

  it('seeds reusable form state before its UI and persistence handlers activate', async function() {
    const render = vi.fn();
    const persist = vi.fn();
    const initial = vi.fn();
    const app = createApp({
      stateEvents: { 'change:responseId': render, 'change:saveMode': persist },
      onBeforeStart() { state.set({ responseId: null, saveMode: 'save' }); },
      onStart() { initial(state.toObject()); }
    });
    await app.start();
    expect(render).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(initial).toHaveBeenCalledExactlyOnceWith({ responseId: null, saveMode: 'save' });
    state.set({ responseId: 'response', saveMode: 'next' });
    expect(render).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    await app.stop();
    await app.start();
    expect(app.getState()).toBe(state);
    expect(render).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(initial).toHaveBeenCalledTimes(2);
  });

  it('does not let initialization or stopped writes restart the feature', async function() {
    let restarted;
    const starts = vi.fn();
    const app = createApp({
      stateEvents: { 'change:filter': function() { restarted = this.restart(); } },
      onBeforeStart() { if (!this.isRunning()) { state.set('filter', 'initial'); } },
      onStart: starts
    });
    expect(await app.start()).toBe(true);
    expect(starts).toHaveBeenCalledTimes(1);
    state.set('filter', 'next');
    expect(await restarted).toBe(true);
    expect(starts).toHaveBeenCalledTimes(2);
    await app.stop();
    state.set('filter', 'stopped');
    expect(app.isRunning()).toBe(false);
    expect(starts).toHaveBeenCalledTimes(2);
  });

  it('retains readiness writes without replay and waits for explicitly started children', async function() {
    const ready = readiness();
    const handler = vi.fn();
    const initial = vi.fn();
    const child = createApp({ prepareStart() { return ready.promise; } });
    const parent = createApp({
      stateEvents: { 'change:value': handler },
      prepareStart() { return child.start(); },
      onStart() { initial(state.get('value')); }
    });
    parent.addChildApp('child', child);
    const starting = parent.start();
    state.set('value', 1);
    state.set('value', 2);
    ready.resolve();
    await starting;
    expect(initial).toHaveBeenCalledExactlyOnceWith(2);
    expect(handler).not.toHaveBeenCalled();
    state.set('value', 3);
    expect(handler).toHaveBeenCalledTimes(1);
  });


  it('forwards state payloads with Application context and releases delivery on destroy', async function() {
    const handler = vi.fn();
    const app = createApp({ stateEvents: { changed: handler } });
    await app.start();
    state.trigger('changed', state, 42);
    expect(handler).toHaveBeenCalledExactlyOnceWith(state, 42);
    expect(handler.mock.contexts).toEqual([app]);
    app.stop();
    state.trigger('changed', state, 43);
    expect(handler).toHaveBeenCalledTimes(1);
    await app.start();
    state.trigger('changed', state, 44);
    expect(handler.mock.calls).toEqual([[state, 42], [state, 44]]);
    expect(handler.mock.contexts).toEqual([app, app]);
    app.destroy();
    state.trigger('changed', state, 45);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('suppresses canceled and failed startup including late completions', async function() {
    const ready = readiness();
    const handler = vi.fn();
    let fail = false;
    const app = createApp({
      stateEvents: { changed: handler },
      prepareStart() { if (fail) { throw new Error('failed'); } return ready.promise; }
    });
    const starting = app.start();
    await app.stop();
    expect(await starting).toBe(false);
    ready.resolve();
    await ready.promise;
    state.trigger('changed');
    fail = true;
    await expect(app.start()).rejects.toThrow('failed');
    state.trigger('changed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('retains activation and its root after failed restart preparation', async function() {
    const handler = vi.fn();
    let fail = false;
    const app = createApp({
      stateEvents: { changed: handler },
      prepareStart() { if (fail) { throw new Error('failed'); } },
      onStart() {
        const view = new runtime.View({ template: false });
        view.on('before:destroy', () => state.trigger('changed', 'teardown'));
        this.setView(view);
      }
    });
    await app.start();
    fail = true;
    await expect(app.restart()).rejects.toThrow('failed');
    state.trigger('changed', 'failed');
    expect(handler.mock.calls).toEqual([['failed']]);
    expect(app.getView().isDestroyed()).toBe(false);
    await app.stop();
    expect(handler.mock.calls).toEqual([['failed']]);
  });

  it('does not deliver to later configured handlers after an earlier handler destroys the app', async function() {
    const later = vi.fn();
    let destroying;
    const app = createApp({ stateEvents: { 'change:value': function() { destroying = this.destroy(); }, change: later } });
    await app.start();
    state.set('value', 1);
    await destroying;
    expect(later).not.toHaveBeenCalled();
  });

  it('fully stops a new run from its restart completion handler', async function() {
    const handler = vi.fn();
    const stopped = vi.fn();
    let starts = 0;
    let stopping;
    let root;
    const app = createApp({
      stateEvents: { changed: handler },
      onStart() {
        root = this.setView(new runtime.View({ template: false }));
        if (++starts === 2) { stopping = this.stop(); }
      },
      onStop: stopped
    });
    await app.start();
    expect(await app.restart()).toBe(true);
    expect(await stopping).toBe(true);
    expect(stopped).toHaveBeenCalledTimes(1);
    expect(app.isRunning()).toBe(false);
    expect(root.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();
    state.trigger('changed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps other owners and explicit listeners independent and releases subscriptions once', async function() {
    const cleanups = [];
    const disposeOwned = vi.fn();
    runtime.setStateApi({
      ...StateApi,
      subscribe(...args) {
        const cleanup = vi.fn(StateApi.subscribe(...args));
        cleanups.push(cleanup);
        return cleanup;
      },
      disposeOwned
    });
    const handler = vi.fn();
    const observer = vi.fn();
    const direct = vi.fn();
    const App = runtime.Application.extend({ createState: () => state, stateEvents: { changed: handler } });
    const app = new App();
    owners.push(app);
    const view = new runtime.View({ state, stateEvents: { changed: observer }, template: false });
    owners.push(view);
    app.listenTo(state, 'changed', direct);
    state.trigger('changed');
    await app.start();
    state.trigger('changed');
    await app.stop();
    state.trigger('changed');
    await app.start();
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(2);
    expect(observer).toHaveBeenCalledTimes(4);
    expect(direct).toHaveBeenCalledTimes(4);
    expect(cleanups).toHaveLength(2);
    await app.destroy();
    await app.destroy();
    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(disposeOwned).toHaveBeenCalledExactlyOnceWith(state);
    state.trigger('changed');
    expect(observer).toHaveBeenCalledTimes(5);
    expect(direct).toHaveBeenCalledTimes(4);
  });
});
