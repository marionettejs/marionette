import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarionette } from 'marionette';
import { Model, StateApi } from '@mnjs/data';

describe('Application state events follow running state', function() {
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
    const promise = new Promise(done => { resolve = done; });
    pending.push(resolve);
    return { promise, resolve };
  }

  it('delivers native payloads with the owner context only during the running phase', async function() {
    const startReady = readiness();
    const stopReady = readiness();
    const handler = vi.fn();
    const app = createApp({
      stateEvents() { return { changed: 'onChanged' }; },
      onChanged: handler,
      onBeforeStart() { state.trigger('changed', 'before:start'); return startReady.promise; },
      onStart() { state.trigger('changed', 'start'); },
      onBeforeStop() { state.trigger('changed', 'before:stop'); return stopReady.promise; },
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
    expect(handler.mock.calls).toEqual([['start'], [state, 42]]);
    expect(handler.mock.contexts).toEqual([app, app]);

    const stopping = app.stop();
    state.trigger('changed', 'stopping');
    stopReady.resolve();
    expect(await stopping).toBe(true);
    state.trigger('changed', 'stopped');
    await app.destroy();
    state.trigger('changed', 'destroyed');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('seeds state without superseding startup and restarts only for running changes', async function() {
    const options = { filter: 'open' };
    const beforeStart = vi.fn();
    const onStart = vi.fn();
    const app = createApp({
      stateEvents: { 'change:filter': 'restart' },
      onBeforeStart(owner, startOptions) {
        beforeStart(startOptions);
        state.set('filter', 'open');
      },
      onStart
    });
    expect(await app.start(options)).toBe(true);
    expect(beforeStart).toHaveBeenCalledExactlyOnceWith(options);
    expect(onStart).toHaveBeenCalledTimes(1);

    const restarted = new Promise(resolve => app.once('start', resolve));
    state.set('filter', 'closed');
    await restarted;
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(app.getState()).toBe(state);

    await app.stop();
    state.set('filter', 'all');
    expect(app.isRunning()).toBe(false);
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it('keeps readiness changes without replaying them when startup succeeds', async function() {
    const ready = readiness();
    const handler = vi.fn();
    const initialFilter = vi.fn();
    const app = createApp({
      stateEvents: { 'change:filter': handler },
      onBeforeStart() { return ready.promise; },
      onStart() { initialFilter(state.get('filter')); }
    });
    const starting = app.start();
    state.set('filter', 'open');
    state.set('filter', 'closed');
    ready.resolve();
    await starting;
    expect(initialFilter).toHaveBeenCalledExactlyOnceWith('closed');
    expect(handler).not.toHaveBeenCalled();
    state.set('filter', 'all');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('waits for child readiness before delivering parent state events', async function() {
    const ready = readiness();
    const entered = readiness();
    const handler = vi.fn();
    const parent = createApp({ stateEvents: { changed: handler } });
    const child = createApp({
      onBeforeStart() { entered.resolve(); return ready.promise; },
      onStart() { state.trigger('changed'); }
    });
    parent.addChildApp('panel', child);
    const starting = parent.start();
    await entered.promise;
    state.trigger('changed');
    ready.resolve();
    await starting;
    expect(handler).not.toHaveBeenCalled();
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not reactivate after canceled readiness finishes late', async function() {
    const ready = readiness();
    const handler = vi.fn();
    const app = createApp({
      stateEvents: { changed: handler },
      onBeforeStart() { return ready.promise; }
    });
    const starting = app.start();
    await app.stop();
    expect(await starting).toBe(false);
    ready.resolve();
    await ready.promise;
    state.trigger('changed');
    expect(app.isRunning()).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    await app.start();
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stays inactive after failed startup and delivers after a successful retry', async function() {
    const error = new Error('startup unavailable');
    const handler = vi.fn();
    const app = createApp({
      stateEvents: { changed: handler },
      onBeforeStart: vi.fn().mockRejectedValueOnce(error)
    });
    await expect(app.start()).rejects.toBe(error);
    state.trigger('changed');
    expect(handler).not.toHaveBeenCalled();
    await app.start();
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resumes delivery when failed stop readiness restores running state', async function() {
    const error = new Error('stop unavailable');
    const handler = vi.fn();
    const app = createApp({
      stateEvents: { changed: handler },
      onBeforeStop: vi.fn().mockImplementationOnce(async() => {
        state.trigger('changed');
        throw error;
      })
    });
    await app.start();
    await expect(app.stop()).rejects.toBe(error);
    expect(handler).not.toHaveBeenCalled();
    expect(app.isRunning()).toBe(true);
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('resumes delivery when a child cancels its parent stop', async function() {
    const handler = vi.fn();
    const parent = createApp({ stateEvents: { changed: handler } });
    const child = createApp({
      onBeforeStop: vi.fn().mockImplementationOnce(function() { void this.start(); })
    });
    parent.addChildApp('panel', child);
    await parent.start();
    expect(await parent.stop()).toBe(false);
    expect(parent.isRunning()).toBe(true);
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not deliver during restart or after a failed restart startup', async function() {
    const error = new Error('reload unavailable');
    const ready = readiness();
    const entered = readiness();
    const handler = vi.fn();
    const app = createApp({
      stateEvents: { changed: handler },
      onBeforeStart: vi.fn().mockResolvedValueOnce(undefined).mockImplementationOnce(async() => {
        entered.resolve();
        await ready.promise;
        throw error;
      })
    });
    await app.start();
    const restarting = app.restart();
    await entered.promise;
    state.trigger('changed');
    ready.resolve();
    await expect(restarting).rejects.toBe(error);
    expect(app.isRunning()).toBe(false);
    state.trigger('changed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('keeps one subscription across restarts and releases it before disposing owned state', async function() {
    const handler = vi.fn();
    const cleanup = vi.fn();
    const dispose = vi.fn(() => expect(cleanup).toHaveBeenCalledTimes(1));
    const subscribe = vi.fn((...args) => {
      const release = StateApi.subscribe(...args);
      return () => { cleanup(); release(); };
    });
    runtime.setStateApi({ subscribe, disposeOwned: dispose });
    const App = runtime.Application.extend({
      createState() { return state; },
      stateEvents: { changed: handler }
    });
    const app = new App();
    owners.push(app);
    await app.start();
    await app.restart();
    await app.restart();
    state.trigger('changed');
    await app.stop();
    expect(app.getState()).toBe(state);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
    await app.destroy();
    expect(dispose).toHaveBeenCalledExactlyOnceWith(state);
    state.trigger('changed');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('lets another state owner observe changes while the Application is stopped', async function() {
    const appHandler = vi.fn();
    const objectHandler = vi.fn();
    const app = createApp({ stateEvents: { changed: appHandler } });
    const Observer = runtime.MnObject.extend({ stateEvents: { changed: objectHandler } });
    const observer = new Observer({ state });
    owners.push(observer);
    state.trigger('changed');
    await app.start();
    state.trigger('changed');
    await app.stop();
    state.trigger('changed');
    expect(appHandler).toHaveBeenCalledTimes(1);
    expect(objectHandler).toHaveBeenCalledTimes(3);
  });
});
