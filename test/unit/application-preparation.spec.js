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

  it('start ignores notification Promises and awaits only its preparation method', async() => {
    const notification = gate();
    const ready = gate();
    const prepareWork = vi.fn(() => ready.promise);
    const app = application({ onBeforeStart() { return notification.promise; }, prepareStart: prepareWork });
    const options = { source: 'test' };
    app.on('before:start', () => notification.promise);
    const finished = vi.fn();
    const pending = app.start(options).then(finished);
    await Promise.resolve();
    expect(prepareWork).toHaveBeenCalledWith(options, { signal: expect.any(AbortSignal) });
    expect(finished).not.toHaveBeenCalled();
    ready.resolve();
    await pending;
    expect(finished).toHaveBeenCalledWith(true);
    notification.resolve();
  });
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

  it('start rejects a synchronous notification failure before preparation', async() => {
    const error = new Error('notification failed');
    const prepareWork = vi.fn();
    const app = application({ onBeforeStart() { throw error; }, prepareStart: prepareWork });
    await expect(app.start()).rejects.toBe(error);
    expect(prepareWork).not.toHaveBeenCalled();
    expect(app.isRunning()).toBe(false);
    expect(app.isDestroyed()).toBe(false);
  });
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
