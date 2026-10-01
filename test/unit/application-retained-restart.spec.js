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

  it('requires stop/start to change an active host', async() => {
    const app = make();
    await app.start();
    const root = app.showView(new View({ template: false }));
    const region = new Region({ el: document.createElement('div') });
    expect(await app.restart({ region })).toBe(true);
    expect(app.getRegion()).not.toBe(region);
    expect(app.getView()).toBe(root);
    await app.stop();
    expect(await app.start({ region })).toBe(true);
    expect(app.getRegion()).toBe(region);
    await app.destroy();
    region.destroy();
  });
});
