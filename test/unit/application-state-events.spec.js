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

  it('delivers payloads and context during activation including pending stop permission', async function() {
    const startReady = readiness();
    const stopReady = readiness();
    const handler = vi.fn();
    const app = createApp({
      stateEvents() { return { changed: 'onChanged' }; },
      onChanged: handler,
      onBeforeStart() { state.trigger('changed', 'before:start'); },
      prepareStart() { return startReady.promise; },
      onStart() { state.trigger('changed', 'start'); },
      onBeforeStop() { state.trigger('changed', 'before:stop'); },
      prepareStop() { return stopReady.promise; },
      onStop() { state.trigger('changed', 'stop'); },
      onBeforeDestroy() { state.trigger('changed', 'before:destroy'); }
    });
    state.trigger('changed', 'constructed');
    const starting = app.start();
    state.trigger('changed', 'starting');
    expect(handler).not.toHaveBeenCalled();
    startReady.resolve();
    expect(await starting).toBe(true);
    state.trigger('changed', state, 42);
    const stopping = app.stop();
    expect(app.isRunning()).toBe(true);
    state.trigger('changed', 'stopping');
    stopReady.resolve();
    expect(await stopping).toBe(true);
    state.trigger('changed', 'stopped');
    await app.destroy();
    state.trigger('changed', 'destroyed');
    expect(handler.mock.calls).toEqual([['start'], [state, 42], ['before:stop'], ['stopping']]);
    expect(handler.mock.contexts).toEqual([app, app, app, app]);
  });

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
    await app.restart();
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
      onBeforeStart() { state.set('filter', 'initial'); },
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

  ['stop', 'restart'].forEach(operation => {
    it(`keeps delivery when ${operation} permission rejects`, async function() {
      const ready = readiness();
      const handler = vi.fn();
      let rejectStop = true;
      const app = createApp({
        stateEvents: { changed: handler },
        prepareStop() { if (rejectStop) { return ready.promise; } }
      });
      await app.start();
      const stopping = app[operation]();
      state.trigger('changed', 'pending');
      ready.reject(new Error('denied'));
      await expect(stopping).rejects.toThrow('denied');
      expect(app.isRunning()).toBe(true);
      state.trigger('changed', 'restored');
      expect(handler.mock.calls).toEqual([['pending'], ['restored']]);
      rejectStop = false;
    });
  });

  it('keeps delivery through an adopted stop phase then suppresses replacement startup', async function() {
    const ready = readiness();
    const started = readiness();
    const startReady = readiness();
    const handler = vi.fn();
    let replacing = false;
    const app = createApp({
      stateEvents: { changed: handler },
      prepareStop() { return ready.promise; },
      prepareStart() { if (replacing) { started.resolve(); return startReady.promise; } }
    });
    await app.start();
    const stopping = app.stop();
    replacing = true;
    const starting = app.start();
    expect(await stopping).toBe(false);
    expect(app.isRunning()).toBe(true);
    state.trigger('changed', 'adopted');
    ready.resolve();
    await started.promise;
    expect(app.isRunning()).toBe(false);
    state.trigger('changed', 'starting');
    startReady.resolve();
    await starting;
    state.trigger('changed', 'started');
    expect(handler.mock.calls).toEqual([['adopted'], ['started']]);
  });

  it('preserves activation when reentrant stop replacement rejects', async function() {
    let replacement;
    let replace = true;
    let deny = true;
    const handler = vi.fn();
    const app = createApp({
      stateEvents: { changed: handler },
      onBeforeStop() {
        if (replace) { replace = false; replacement = this.restart(); }
      },
      prepareStop() { if (deny) { throw new Error('denied'); } }
    });
    await app.start();
    const stopped = app.stop();
    await expect(replacement).rejects.toThrow('denied');
    expect(await stopped).toBe(false);
    expect(app.isRunning()).toBe(true);
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
    deny = false;
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

  it('deactivates before view teardown and stays inactive after failed restart preparation', async function() {
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
    expect(handler).not.toHaveBeenCalled();
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
    expect(stopped).toHaveBeenCalledTimes(2);
    expect(app.isRunning()).toBe(false);
    expect(root.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();
    state.trigger('changed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('deactivates before an adopted start replaces the old Region', async function() {
    const ready = readiness();
    const handler = vi.fn();
    const activity = [];
    const first = new runtime.Region({ el: document.createElement('main') });
    const second = new runtime.Region({ el: document.createElement('main') });
    const app = createApp({
      stateEvents: { changed: handler },
      prepareStop() { return ready.promise; },
      onStart() {
        const root = this.showView(new runtime.View({ template: false }));
        root.on('before:destroy', () => {
          activity.push(this.isRunning());
          state.trigger('changed');
        });
      }
    });
    await app.start({ region: first });
    const oldRoot = app.getView();
    const stopping = app.stop();
    const starting = app.start({ region: second });
    expect(app.isRunning()).toBe(true);
    ready.resolve();
    expect(await stopping).toBe(false);
    expect(await starting).toBe(true);
    expect(activity).toEqual([false]);
    expect(handler).not.toHaveBeenCalled();
    expect(oldRoot.isDestroyed()).toBe(true);
    expect(app.getRegion()).toBe(second);
    expect(app.isRunning()).toBe(true);
    await app.destroy();
    first.destroy();
    second.destroy();
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
