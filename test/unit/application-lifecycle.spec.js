import { vi, describe, it, expect } from 'vitest';
'use strict';

import { Application } from 'marionette';
import { Radio } from '@mnjs/radio';

function defer() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function expectRejection(promise, expectedError) {
  try {
    await promise;
  } catch (error) {
    expect(error).to.equal(expectedError);
    return;
  }

  throw new Error('Expected promise to reject.');
}

function getState(app) {
  if (app.isDestroyed()) { return 'destroyed'; }
  return app.isRunning() ? 'running' : 'stopped';
}

const lifecycleTransitions = [
  ['stopped', 'start', true, 'running', ['before:start', 'start']],
  ['stopped', 'stop', true, 'stopped', []],
  ['stopped', 'restart', true, 'running', ['before:start', 'start']],
  ['stopped', 'destroy', true, 'destroyed', ['before:destroy', 'destroy']],
  ['running', 'start', true, 'running', []],
  ['running', 'stop', true, 'stopped', ['before:stop', 'stop']],
  ['running', 'restart', true, 'running', ['before:start', 'start']],
  ['running', 'destroy', true, 'destroyed', ['before:stop', 'stop', 'before:destroy', 'destroy']],
  ['destroyed', 'start', false, 'destroyed', []],
  ['destroyed', 'stop', true, 'destroyed', []],
  ['destroyed', 'restart', false, 'destroyed', []],
  ['destroyed', 'destroy', true, 'destroyed', []]
];

describe('Application lifecycle', function() {
  for (const [initialState, method, result, finalState, expectedEvents] of lifecycleTransitions) {
    it(`models ${initialState} -> ${method} -> ${finalState}`, async function() {
      const events = [];
      const TestApplication = Application.extend({
        onBeforeStart() { events.push('before:start'); },
        onStart() { events.push('start'); },
        onBeforeStop() { events.push('before:stop'); },
        onStop() { events.push('stop'); },
        onBeforeDestroy() { events.push('before:destroy'); },
        onDestroy() { events.push('destroy'); }
      });
      const app = new TestApplication();

      if (initialState === 'running') { await app.start(); }
      if (initialState === 'destroyed') { await app.destroy(); }
      events.length = 0;

      expect(await app[method]()).to.equal(result);
      expect(getState(app)).to.equal(finalState);
      expect(events).to.deep.equal(expectedEvents);

      if (!app.isDestroyed()) { await app.destroy(); }
    });
  }

  it('settles start only after asynchronous readiness completes', async function() {
    const readiness = defer();
    const events = [];
    let startContext;
    const TestApplication = Application.extend({
      prepareStart(options, context) {
        expect(options).to.deep.equal({ source: 'test' });
        expect(context.signal.aborted).toBe(false);
        startContext = context;
        events.push('before:start');
        return readiness.promise;
      },
      onStart(app, options) {
        expect(app).to.equal(this);
        expect(options).to.deep.equal({ source: 'test' });
        expect(arguments).to.have.length(3);
        events.push('start');
      }
    });
    const app = new TestApplication();
    app.on('before:start', (triggeredApp, options) => {
      expect(triggeredApp).to.equal(app);
      expect(options).to.deep.equal({ source: 'test' });
    });

    const start = app.start({ source: 'test' });

    expect(start).to.be.instanceOf(Promise);
    expect(app.isRunning()).toBe(false);
    expect(events).to.deep.equal(['before:start']);

    readiness.resolve();

    expect(await start).toBe(true);
    expect(app.isRunning()).toBe(true);
    expect(startContext.signal.aborted).toBe(false);
    expect(events).to.deep.equal(['before:start', 'start']);
  });

  it('does not await a before event listener return value', async function() {
    const listenerReadiness = defer();
    const app = new Application();
    app.on('before:start', () => listenerReadiness.promise);

    expect(await app.start()).toBe(true);
    expect(app.isRunning()).toBe(true);

    listenerReadiness.resolve();
    await app.destroy();
  });

  it('shares a compatible in-flight start and no-ops once running', async function() {
    const readiness = defer();
    const beforeStart = vi.fn().mockReturnValue(readiness.promise);
    const startEvent = vi.fn();
    const app = new (Application.extend({ prepareStart: beforeStart, onStart: startEvent }))();

    const first = app.start();
    const repeated = app.start();

    expect(repeated).to.equal(first);
    readiness.resolve();
    expect(await first).toBe(true);
    expect(await app.start()).toBe(true);
    expect(beforeStart).toHaveBeenCalledTimes(1);
    expect(startEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects a current start failure and permits retry', async function() {
    const error = new Error('readiness failed');
    const prepareStart = vi.fn();
    prepareStart.mockRejectedValueOnce(error);
    const app = new (Application.extend({ prepareStart }))();

    await expectRejection(app.start(), error);
    expect(app.isRunning()).toBe(false);
    expect(await app.start()).toBe(true);
    expect(app.isRunning()).toBe(true);
  });

  it('keeps running when the start completion hook fails', async function() {
    const error = new Error('start completion failed');
    const app = new (Application.extend({
      onStart() { throw error; }
    }))();

    await expectRejection(app.start(), error);

    expect(app.isRunning()).toBe(true);
  });

  it('reruns preparation without stop notifications', async function() {
    const events = [];
    const TestApplication = Application.extend({
      onBeforeStart() { events.push('before:start'); },
      onStart() { events.push('start'); },
      onBeforeStop() { events.push('before:stop'); },
      onStop() { events.push('stop'); }
    });
    const app = new TestApplication();
    await app.start();
    events.length = 0;

    expect(await app.restart()).toBe(true);

    expect(events).to.deep.equal(['before:start', 'start']);
    expect(app.isRunning()).toBe(true);
  });


  it('remains running when retained restart readiness fails', async function() {
    const error = new Error('restart failed');
    const events = [];
    const prepareStart = vi.fn();
    prepareStart.mockReturnValueOnce(undefined).mockRejectedValueOnce(error);
    const app = new (Application.extend({
      prepareStart,
      onStop() { events.push('stop'); }
    }))();
    await app.start();

    await expectRejection(app.restart(), error);

    expect(events).to.deep.equal([]);
    expect(app.isRunning()).toBe(true);
  });

  it('restarts during startup without exposing the invalidated start', async function() {
    const firstReadiness = defer();
    const events = [];
    let starts = 0;
    const TestApplication = Application.extend({
      prepareStart() {
        events.push('before:start');
        if (!starts++) { return firstReadiness.promise; }
      },
      onStart() { events.push('start'); },
      onBeforeStop() { events.push('before:stop'); },
      onStop() { events.push('stop'); }
    });
    const app = new TestApplication();

    const start = app.start();
    const restart = app.restart();

    expect(await start).toBe(false);
    expect(await restart).toBe(true);
    expect(events).to.deep.equal([
      'before:start',
      'before:start',
      'start'
    ]);

    firstReadiness.resolve();
    await firstReadiness.promise;
    await Promise.resolve();

    expect(events.filter(event => event === 'start')).to.have.length(1);
    expect(app.isRunning()).toBe(true);
  });

  it('lets destroy supersede startup and prevents stale lifecycle work', async function() {
    const readiness = defer();
    const events = [];
    const TestApplication = Application.extend({
      prepareStart() {
        events.push('before:start');
        return readiness.promise;
      },
      onStart() { events.push('start'); },
      onBeforeStop() { events.push('before:stop'); },
      onStop() { events.push('stop'); },
      onBeforeDestroy() { events.push('before:destroy'); },
      onDestroy() { events.push('destroy'); }
    });
    const app = new TestApplication();

    const start = app.start();
    const destroy = app.destroy();

    expect(await start).toBe(false);
    expect(await destroy).toBe(true);
    expect(app.isDestroyed()).toBe(true);

    readiness.resolve();
    await readiness.promise;
    await Promise.resolve();

    expect(events).to.deep.equal([
      'before:start',
      'before:stop',
      'stop',
      'before:destroy',
      'destroy'
    ]);
  });

  it('supports reentrant stop from before:start', async function() {
    let stop;
    const startEvent = vi.fn();
    const TestApplication = Application.extend({
      onBeforeStart() {
        stop = this.stop();
      },
      onStart: startEvent
    });
    const app = new TestApplication();

    expect(await app.start()).toBe(false);
    expect(await stop).toBe(true);
    expect(startEvent).not.toHaveBeenCalled();
    expect(app.isRunning()).toBe(false);
  });

  it('shares a reentrant start that is not awaited by its own readiness hook', async function() {
    let repeated;
    const app = new (Application.extend({
      prepareStart() {
        repeated = this.start();
      }
    }))();

    const start = app.start();

    expect(repeated).to.equal(start);
    expect(await start).toBe(true);
    expect(app.isRunning()).toBe(true);
  });

  it('keeps destroy authoritative during before:destroy reentry', async function() {
    let repeated;
    let stop;
    let start;
    let restart;
    const app = new (Application.extend({
      onBeforeDestroy(application) {
        repeated = application.destroy();
        stop = application.stop();
        start = application.start();
        restart = application.restart();
      }
    }))();

    const destroy = app.destroy();

    expect(repeated).to.equal(destroy);
    expect(await stop).toBe(true);
    expect(await start).toBe(false);
    expect(await restart).toBe(false);
    expect(await destroy).toBe(true);
    expect(app.isDestroyed()).toBe(true);
  });

  it('absorbs failure from readiness after startup is superseded', async function() {
    const readiness = defer();
    const error = new Error('stale failure');
    const startEvent = vi.fn();
    const app = new (Application.extend({
      prepareStart() { return readiness.promise; },
      onStart: startEvent
    }))();

    const start = app.start();
    expect(await app.stop()).toBe(true);
    expect(await start).toBe(false);

    readiness.reject(error);
    await expectRejection(readiness.promise, error);
    await Promise.resolve();

    expect(startEvent).not.toHaveBeenCalled();
    expect(app.isRunning()).toBe(false);
  });

  it('throws synchronously when destruction stop notification fails', async function() {
    const error = new Error('stop event failed');
    const app = new (Application.extend({
      onStop() { throw error; }
    }))();
    await app.start();

    expect(() => app.destroy()).toThrow(error);

    expect(app.isRunning()).toBe(false);
    expect(app.isDestroyed()).toBe(false);
  });

  it('settles completed operations before completion-handler reentry', async function() {
    let stop;
    let restart;
    const events = [];
    const TestApplication = Application.extend({
      onStart() {
        events.push('start');
        if (!stop) { stop = this.stop(); }
      },
      onStop() {
        events.push('stop');
        if (!restart) { restart = this.restart(); }
      }
    });
    const app = new TestApplication();

    expect(await app.start()).toBe(true);
    expect(await stop).toBe(true);
    expect(await restart).toBe(true);

    expect(events).to.deep.equal(['start', 'stop', 'start']);
    expect(app.isRunning()).toBe(true);
  });

  it('releases Application-owned Radio replies synchronously', async function() {
    const channelName = 'application-lifecycle-radio';
    const TestApplication = Application.extend({
      channelName,
      radioRequests: { value: 'getValue' },
      getValue() { return 42; }
    });
    const app = new TestApplication();
    const channel = app.getChannel();
    vi.spyOn(channel, 'stopReplying');

    expect(Radio.request(channelName, 'value')).to.equal(42);

    expect(await app.destroy()).toBe(true);

    expect(channel.stopReplying).toHaveBeenCalledTimes(1);
    expect(channel.stopReplying.mock.calls.map(args => args.slice(0, 3))).toContainEqual([null, null, app]);
    expect(Radio.request(channelName, 'value')).toBeUndefined();
  });

  it('runs every hook exactly once across repeated start-stop cycles', async function() {
    const beforeStart = vi.fn();
    const startEvent = vi.fn();
    const beforeStop = vi.fn();
    const stopEvent = vi.fn();
    const app = new (Application.extend({
      onBeforeStart: beforeStart,
      onStart: startEvent,
      onBeforeStop: beforeStop,
      onStop: stopEvent
    }))();

    for (let index = 0; index < 10; index++) {
      expect(await app.start()).toBe(true);
      expect(await app.stop()).toBe(true);
      expect(app.isRunning()).toBe(false);
    }

    expect(beforeStart).toHaveBeenCalledTimes(10);
    expect(startEvent).toHaveBeenCalledTimes(10);
    expect(beforeStop).toHaveBeenCalledTimes(10);
    expect(stopEvent).toHaveBeenCalledTimes(10);
  });

});
