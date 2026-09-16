import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application } from 'marionette';

const apps = [];
const gates = [];
function gate() {
  const deferred = Promise.withResolvers();
  gates.push(deferred);
  return deferred;
}
function application(methods) {
  const app = new (Application.extend(methods))();
  apps.push(app);
  return app;
}
afterEach(async() => {
  gates.splice(0).forEach(deferred => deferred.resolve());
  for (const app of apps.splice(0)) { await app.destroy(); }
});

describe('Application preparation', () => {
  it('notifies before startup, awaits preparation, and forwards one result to completion', async() => {
    const ready = gate();
    const options = { route: 'inbox' };
    const result = [{ title: 'Inbox' }];
    const calls = [];
    let receiver;
    const app = application({
      onBeforeStart(...args) { calls.push(['before:method', args]); },
      prepareStart(...args) { receiver = this; calls.push(['prepare', args]); return ready.promise; },
      onStart(...args) { calls.push(['start:method', args]); }
    });
    app.on('before:start', (...args) => calls.push(['before:event', args]));
    app.on('start', (...args) => calls.push(['start:event', args]));

    const started = app.start(options);
    expect(calls.map(([name]) => name)).toEqual(['before:method', 'before:event', 'prepare']);
    expect(calls[0][1]).toEqual([app, options]);
    expect(calls[1][1]).toEqual([app, options]);
    expect(receiver).toBe(app);
    expect(calls[2][1]).toEqual([options, { signal: expect.any(AbortSignal) }]);
    expect(app.isRunning()).toBe(false);
    ready.resolve(result);
    expect(await started).toBe(true);
    expect(calls.slice(3)).toEqual([
      ['start:method', [app, options, result]],
      ['start:event', [app, options, result]]
    ]);
    expect(calls[3][1][2]).toBe(result);
  });

  for (const [operation, before, prepare] of [
    ['start', 'onBeforeStart', 'prepareStart'],
    ['stop', 'onBeforeStop', 'prepareStop'],
    ['destroy', 'onBeforeDestroy', 'prepareDestroy']
  ]) {
    it(`${operation} ignores notification Promises and awaits only its preparation method`, async() => {
      const notification = gate();
      const ready = gate();
      const prepareWork = vi.fn(() => ready.promise);
      const app = application({ [before]() { return notification.promise; }, [prepare]: prepareWork });
      if (operation === 'stop') { await app.start(); }
      const options = { source: 'test' };
      app.on(`before:${operation}`, () => notification.promise);
      const finished = vi.fn();
      const pending = app[operation](options).then(finished);
      await Promise.resolve();
      expect(prepareWork).toHaveBeenCalledWith(options, { signal: expect.any(AbortSignal) });
      expect(finished).not.toHaveBeenCalled();
      ready.resolve();
      await pending;
      expect(finished).toHaveBeenCalledWith(true);
      notification.resolve();
    });
  }

  for (const [operation, prepare, completion] of [
    ['stop', 'prepareStop', 'onStop'],
    ['destroy', 'prepareDestroy', 'onDestroy']
  ]) {
    it(`${operation} discards preparation results and keeps two completion arguments`, async() => {
      const onCompletion = vi.fn();
      const event = vi.fn();
      const result = { readiness: 'complete' };
      const options = { source: 'test' };
      const app = application({
        [prepare]() { return Promise.resolve(result); },
        [completion]: onCompletion
      });
      app.on(operation, event);
      await app.start();
      expect(await app[operation](options)).toBe(true);
      expect(onCompletion).toHaveBeenCalledExactlyOnceWith(app, options);
      expect(event).toHaveBeenCalledExactlyOnceWith(app, options);
    });
  }

  for (const listener of ['method', 'event']) {
    it(`does not begin preparation after the before:start ${listener} supersedes startup`, async() => {
      const prepareStart = vi.fn();
      let stopped;
      const app = application({ prepareStart });
      const stop = () => { stopped = app.stop(); };
      if (listener === 'method') { app.onBeforeStart = stop; } else { app.on('before:start', stop); }
      expect(await app.start()).toBe(false);
      expect(await stopped).toBe(true);
      expect(prepareStart).not.toHaveBeenCalled();
    });
  }

  for (const replacementKind of ['restart', 'destroy']) {
    it(`starts a fresh stop phase when a before:stop listener requests ${replacementKind}`, async() => {
      const prepareStop = vi.fn();
      const beforeStop = vi.fn();
      const beforeDestroy = vi.fn();
      const app = application({ prepareStop });
      const options = { source: 'original' };
      const replacementOptions = { source: 'replacement' };
      let replacement;
      app.on('before:stop', beforeStop);
      app.on('before:destroy', beforeDestroy);
      app.once('before:stop', () => { replacement = app[replacementKind](replacementOptions); });
      await app.start();
      expect(await app.stop(options)).toBe(false);
      expect(await replacement).toBe(true);
      expect(beforeStop.mock.calls).toEqual([[app, options], [app, replacementOptions]]);
      expect(prepareStop).toHaveBeenCalledExactlyOnceWith(replacementOptions, { signal: expect.any(AbortSignal) });
      expect(beforeDestroy).toHaveBeenCalledTimes(replacementKind === 'destroy' ? 1 : 0);
      expect(app.isRunning()).toBe(replacementKind === 'restart');
      expect(app.isDestroyed()).toBe(replacementKind === 'destroy');
    });
  }

  it('does not begin stop preparation after its notification starts a replacement operation', async() => {
    const prepareStop = vi.fn();
    const app = application({ prepareStop });
    await app.start();
    let replacement;
    app.once('before:stop', () => { replacement = app.start(); });
    expect(await app.stop()).toBe(false);
    expect(await replacement).toBe(true);
    expect(prepareStop).not.toHaveBeenCalled();
    expect(app.isRunning()).toBe(true);
  });

  for (const [operation, before, prepare] of [
    ['start', 'onBeforeStart', 'prepareStart'],
    ['stop', 'onBeforeStop', 'prepareStop'],
    ['destroy', 'onBeforeDestroy', 'prepareDestroy']
  ]) {
    it(`${operation} rejects a synchronous notification failure before preparation`, async() => {
      const error = new Error('notification failed');
      const prepareWork = vi.fn();
      const app = application({ [before]() { throw error; }, [prepare]: prepareWork });
      if (operation === 'stop') { await app.start(); }
      await expect(app[operation]()).rejects.toBe(error);
      expect(prepareWork).not.toHaveBeenCalled();
      expect(app.isRunning()).toBe(operation === 'stop');
      expect(app.isDestroyed()).toBe(false);
      app[before] = undefined;
    });
  }

  it('forwards synchronous results and uses undefined when no preparation method exists', async() => {
    const onStart = vi.fn();
    const value = { id: 'session' };
    const prepared = application({ prepareStart() { return value; }, onStart });
    const empty = application({ onStart });
    expect(await prepared.start()).toBe(true);
    expect(onStart).toHaveBeenCalledWith(prepared, undefined, value);
    expect(await empty.start()).toBe(true);
    expect(onStart).toHaveBeenCalledWith(empty, undefined, undefined);
  });

  it('forwards only the current preparation result after restart supersedes startup', async() => {
    const first = gate();
    const second = gate();
    const signals = [];
    const onStart = vi.fn();
    const app = application({
      prepareStart(options, { signal }) {
        signals.push(signal);
        return signals.length === 1 ? first.promise : second.promise;
      },
      onStart
    });
    const oldStart = app.start();
    const restarted = app.restart();
    expect(await oldStart).toBe(false);
    expect(signals[0].aborted).toBe(true);
    second.resolve('current');
    expect(await restarted).toBe(true);
    first.resolve('obsolete');
    await first.promise;
    expect(onStart).toHaveBeenCalledExactlyOnceWith(app, undefined, 'current');
  });
});
