import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, View, Region } from 'marionette';
import { Model, StateApi } from '@mnjs/data';

const apps = [];
const hosts = [];
function make(properties = {}) {
  const host = document.createElement('main');
  document.body.append(host);
  hosts.push(host);
  const app = new (Application.extend(properties))({ region: { el: host } });
  apps.push(app);
  return app;
}
afterEach(async() => {
  for (const app of apps.splice(0)) { await app.destroy(); }
  hosts.splice(0).forEach(host => host.remove());
});

describe('retained Application restart', () => {
  it('keeps DOM, focus, children and event delivery active through supersession', async() => {
    const state = new Model();
    const requests = [];
    const results = [];
    const interactions = [];
    const stops = vi.fn();
    const app = make({
      state,
      State: StateApi,
      stateEvents: { 'change:filter': 'filterChanged' },
      viewEvents: { select: 'selected' },
      filterChanged() { interactions.push('state'); },
      selected(value) { interactions.push(value); },
      prepareStart(options, { signal }) {
        if (!options?.filter) { return; }
        const request = Promise.withResolvers();
        requests.push({ ...request, signal, options });
        return request.promise;
      },
      onStart(owner, options, result) {
        if (!this.getView()) { this.showView(new View({ template: () => '<input value="initial">' })); }
        if (options?.filter) { results.push([options.filter, result]); }
      },
      onStop: stops
    });
    const child = app.addChildApp('child', new Application());
    await app.start();
    await child.start();
    const root = app.getView();
    const input = root.el.querySelector('input');
    input.value = 'edited';
    input.focus();
    const first = app.restart({ filter: 'A' });
    const second = app.restart({ filter: 'B' });
    expect(await first).toBe(false);
    expect(requests[0].signal.aborted).toBe(true);
    expect(app.isRunning()).toBe(true);
    expect(child.isRunning()).toBe(true);
    expect(await app.start()).toBe(true);
    expect(requests[1].signal.aborted).toBe(false);
    state.set('filter', 'B');
    root.trigger('select', 'view');
    expect(interactions).toEqual(['state', 'view']);
    requests[1].resolve('latest');
    expect(await second).toBe(true);
    requests[0].resolve('obsolete');
    await requests[0].promise;
    await Promise.resolve();
    expect(results).toEqual([['B', 'latest']]);
    expect(app.getView()).toBe(root);
    expect(root.el.querySelector('input')).toBe(input);
    expect(input.value).toBe('edited');
    expect(document.activeElement).toBe(input);
    expect(stops).not.toHaveBeenCalled();
    await app.stop();
    expect(root.isDestroyed()).toBe(true);
    expect(child.isRunning()).toBe(false);
    await app.start();
    expect(app.getView()).not.toBe(root);
    state.destroy();
  });

  it('keeps the active presentation and children usable after failed re-preparation', async() => {
    const ready = Promise.withResolvers();
    const selected = vi.fn();
    const app = make({
      viewEvents: { select: selected },
      prepareStart(options) { if (options?.hold) { return ready.promise; } }
    });
    const child = app.addChildApp('child', new Application());
    await app.start();
    await child.start();
    const root = app.showView(new View({ template: () => '<input>' }));
    const input = root.el.querySelector('input');
    input.value = 'edited';
    input.focus();
    const failed = app.restart({ hold: true });
    const error = new Error('failed');
    ready.reject(error);
    await expect(failed).rejects.toBe(error);
    expect(app.getView()).toBe(root);
    expect(root.el.querySelector('input')).toBe(input);
    expect(input.value).toBe('edited');
    expect(document.activeElement).toBe(input);
    expect(app.isRunning()).toBe(true);
    expect(child.isRunning()).toBe(true);
    root.trigger('select', 'retry');
    expect(selected).toHaveBeenCalledExactlyOnceWith('retry');
  });

  for (const method of ['stop', 'destroy']) {
    it(`${method} invalidates preparation before stale transport settles`, async() => {
      const ready = Promise.withResolvers();
      let signal;
      const completions = vi.fn();
      const app = make({
        prepareStart(options, context) { if (options?.load) { signal = context.signal; return ready.promise; } },
        onStart: completions
      });
      await app.start();
      const root = app.showView(new View({ template: false }));
      const pending = app.restart({ load: true });
      const ended = app[method]();
      expect(signal.aborted).toBe(true);
      expect(await pending).toBe(false);
      expect(await ended).toBe(true);
      ready.resolve('late');
      await ready.promise;
      await Promise.resolve();
      expect(completions).toHaveBeenCalledTimes(1);
      expect(root.isDestroyed()).toBe(true);
      expect(app.isRunning()).toBe(false);
    });
  }

  it('supersedes initial startup and starts after stop without a teardown phase', async() => {
    const ready = Promise.withResolvers();
    const stops = vi.fn();
    const app = make({ prepareStart(options) { if (options?.hold) { return ready.promise; } }, onStop: stops });
    const root = app.setView(new View({ template: false }));
    const initial = app.start({ hold: true });
    expect(await app.restart()).toBe(true);
    expect(await initial).toBe(false);
    expect(app.getView()).toBe(root);
    expect(stops).not.toHaveBeenCalled();
    ready.resolve();
    await app.stop();
    expect(await app.restart()).toBe(true);
    expect(stops).toHaveBeenCalledTimes(1);
  });

  it('reports active re-preparation in onBeforeStart without a restart flag', async() => {
    const runs = [];
    const app = make({ onBeforeStart() { runs.push(this.isRunning()); } });
    await app.start();
    await app.restart();
    await app.stop();
    await app.restart();
    expect(runs).toEqual([false, true, false]);
  });

  it('joins restart readiness from stopped while retaining independently active children', async() => {
    const ready = Promise.withResolvers();
    let signal;
    const app = make({ prepareStart(options, context) { signal = context.signal; return ready.promise; } });
    const child = app.addChildApp('independent', new Application());
    await child.start();
    const restarting = app.restart({ value: 'latest' });
    expect(app.start()).toBe(restarting);
    expect(signal.aborted).toBe(false);
    expect(child.isRunning()).toBe(true);
    ready.resolve();
    expect(await restarting).toBe(true);
    expect(child.isRunning()).toBe(true);
  });

  it('adopts explicit stop readiness before re-preparing once with current options', async() => {
    const ready = Promise.withResolvers();
    const stop = vi.fn();
    const start = vi.fn();
    let stopSignal;
    const app = make({
      prepareStop(options, { signal }) { stopSignal = signal; return ready.promise; },
      onStop: stop,
      onStart: start
    });
    await app.start();
    const root = app.showView(new View({ template: false }));
    const stopping = app.stop({ permission: 'original' });
    const options = { query: 'latest' };
    const restarting = app.restart(options);
    expect(await stopping).toBe(false);
    expect(stopSignal.aborted).toBe(false);
    ready.resolve();
    expect(await restarting).toBe(true);
    expect(stop).toHaveBeenCalledExactlyOnceWith(app, { permission: 'original' });
    expect(start).toHaveBeenLastCalledWith(app, options, undefined);
    expect(root.isDestroyed()).toBe(true);
  });

  it('joins reactivation after an adopted stop and rejects when preparation fails', async() => {
    const stopReady = Promise.withResolvers();
    const failure = new Error('reactivation failed');
    const app = make({
      prepareStop() { return stopReady.promise; },
      prepareStart(options) { if (options?.fail) { throw failure; } }
    });
    await app.start();
    const root = app.showView(new View({ template: false }));
    const stopping = app.stop();
    const restarting = app.restart({ fail: true });
    const requested = new Region({ el: document.createElement('main') });
    await expect(app.start({ region: requested })).rejects.toMatchObject({ code: 'MN0041' });
    requested.destroy();
    const joined = app.start({ region: app.getRegion() });
    expect(joined).toBe(restarting);
    const rejection = joined.catch(error => error);
    expect(await stopping).toBe(false);
    stopReady.resolve();
    expect(await rejection).toBe(failure);
    expect(app.isRunning()).toBe(false);
    expect(root.isDestroyed()).toBe(true);
  });

  it('cancels new readiness after the adopted stop has completed teardown', async() => {
    const stopReady = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const startReady = Promise.withResolvers();
    let signal;
    const app = make({
      prepareStop() { return stopReady.promise; },
      prepareStart(options, context) {
        if (!options?.hold) { return; }
        signal = context.signal;
        entered.resolve();
        return startReady.promise;
      }
    });
    await app.start();
    const root = app.showView(new View({ template: false }));
    const stopping = app.stop();
    const restarting = app.restart({ hold: true });
    stopReady.resolve();
    await entered.promise;
    expect(root.isDestroyed()).toBe(true);
    expect(app.isRunning()).toBe(false);
    expect(await app.stop()).toBe(true);
    expect(await stopping).toBe(false);
    expect(await restarting).toBe(false);
    expect(signal.aborted).toBe(true);
    startReady.resolve();
    await startReady.promise;
    expect(app.isRunning()).toBe(false);
  });

  it('does not start preparation when onStop cancels adopted reactivation', async() => {
    const stopReady = Promise.withResolvers();
    const preparing = vi.fn();
    let canceled;
    const app = make({
      prepareStart: preparing,
      prepareStop() { return stopReady.promise; },
      onStop() { canceled = this.stop(); }
    });
    await app.start();
    const stopping = app.stop();
    const restarting = app.restart();
    stopReady.resolve();
    expect(await stopping).toBe(false);
    expect(await restarting).toBe(false);
    expect(await canceled).toBe(true);
    expect(preparing).toHaveBeenCalledTimes(1);
    expect(app.isRunning()).toBe(false);
  });

  it('keeps the selected host when superseding a start still waiting for stop permission', async() => {
    const ready = Promise.withResolvers();
    const app = make({ prepareStop() { return ready.promise; } });
    await app.start();
    const current = app.getRegion();
    const requested = new Region({ el: document.createElement('main') });
    const stopped = app.stop();
    const started = app.start({ region: requested });
    const restarted = app.restart();
    expect(await started).toBe(false);
    expect(await stopped).toBe(false);
    ready.resolve();
    expect(await restarted).toBe(true);
    expect(app.getRegion()).toBe(current);
    expect(requested.hasView()).toBe(false);
    await app.destroy();
    expect(requested.isDestroyed()).toBe(false);
    requested.destroy();
  });

  it('requires stop/start to change an active host', async() => {
    const app = make();
    await app.start();
    const root = app.showView(new View({ template: false }));
    const region = new Region({ el: document.createElement('div') });
    await expect(app.restart({ region })).rejects.toMatchObject({ code: 'MN0041' });
    expect(app.getView()).toBe(root);
    await app.stop();
    expect(await app.start({ region })).toBe(true);
    expect(app.getRegion()).toBe(region);
    await app.destroy();
    region.destroy();
  });
});
