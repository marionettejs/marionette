'use strict';

import Application from '../../modules/application';
import Radio from '../../modules/radio';

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
  ['running', 'restart', true, 'running', ['before:stop', 'stop', 'before:start', 'start']],
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
    let eventContext;
    let startContext;
    const TestApplication = Application.extend({
      onBeforeStart(app, options, context) {
        expect(app).to.equal(this);
        expect(options).to.deep.equal({ source: 'test' });
        expect(context.signal.aborted).to.be.false;
        startContext = context;
        events.push('before:start');
        return readiness.promise;
      },
      onStart(app, options) {
        expect(app).to.equal(this);
        expect(options).to.deep.equal({ source: 'test' });
        expect(arguments).to.have.length(2);
        events.push('start');
      }
    });
    const app = new TestApplication();
    app.on('before:start', (triggeredApp, options, context) => {
      expect(triggeredApp).to.equal(app);
      expect(options).to.deep.equal({ source: 'test' });
      eventContext = context;
    });

    const start = app.start({ source: 'test' });

    expect(start).to.be.instanceOf(Promise);
    expect(app.isRunning()).to.be.false;
    expect(events).to.deep.equal(['before:start']);

    readiness.resolve();

    expect(await start).to.be.true;
    expect(app.isRunning()).to.be.true;
    expect(eventContext).to.equal(startContext);
    expect(startContext.signal.aborted).to.be.false;
    expect(events).to.deep.equal(['before:start', 'start']);
  });

  it('aborts invalidated readiness before replacement readiness starts', async function() {
    const readiness = defer();
    const events = [];
    let firstContext;
    let startCount = 0;
    const TestApplication = Application.extend({
      onBeforeStart(app, options, context) {
        if (startCount++) {
          events.push(`before:start:${firstContext.signal.aborted}`);
          return;
        }

        firstContext = context;
        events.push('before:start');
        context.signal.addEventListener('abort', () => {
          events.push('abort:start');
          readiness.resolve();
        }, { once: true });
        return readiness.promise;
      },
      onBeforeStop(app, options, context) {
        events.push(`before:stop:${firstContext.signal.aborted}:${context.signal.aborted}`);
      }
    });
    const app = new TestApplication();

    const start = app.start();
    const restart = app.restart();

    expect(await start).to.be.false;
    expect(await restart).to.be.true;
    expect(events).to.deep.equal([
      'before:start',
      'abort:start',
      'before:stop:true:false',
      'before:start:true'
    ]);
  });

  it('transfers stop readiness without aborting its signal', async function() {
    const readiness = defer();
    let stopContext;
    const onBeforeStop = this.sinon.stub().callsFake((app, options, context) => {
      stopContext = context;
      return readiness.promise;
    });
    const app = new (Application.extend({ onBeforeStop }))();
    await app.start();

    const stop = app.stop();
    const restart = app.restart();

    expect(await stop).to.be.false;
    expect(stopContext.signal.aborted).to.be.false;
    readiness.resolve();
    expect(await restart).to.be.true;
    expect(stopContext.signal.aborted).to.be.false;
    expect(onBeforeStop).to.have.been.calledOnce;
  });

  it('shares a compatible in-flight start and no-ops once running', async function() {
    const readiness = defer();
    const beforeStart = this.sinon.stub().returns(readiness.promise);
    const startEvent = this.sinon.spy();
    const app = new (Application.extend({ onBeforeStart: beforeStart, onStart: startEvent }))();

    const first = app.start();
    const repeated = app.start();

    expect(repeated).to.equal(first);
    readiness.resolve();
    expect(await first).to.be.true;
    expect(await app.start()).to.be.true;
    expect(beforeStart).to.have.been.calledOnce;
    expect(startEvent).to.have.been.calledOnce;
  });

  it('lets stop supersede an in-flight start without stale success', async function() {
    const readiness = defer();
    const events = [];
    const TestApplication = Application.extend({
      onBeforeStart() {
        events.push('before:start');
        return readiness.promise;
      },
      onStart() {
        events.push('start');
      },
      onBeforeStop() {
        events.push('before:stop');
      },
      onStop() {
        events.push('stop');
      }
    });
    const app = new TestApplication();

    const start = app.start();
    const stop = app.stop();

    expect(await start).to.be.false;
    expect(await stop).to.be.true;
    expect(app.isRunning()).to.be.false;

    readiness.resolve();
    await readiness.promise;
    await Promise.resolve();

    expect(events).to.deep.equal(['before:start', 'before:stop', 'stop']);
    expect(app.isRunning()).to.be.false;
  });

  it('rejects a current start failure and permits retry', async function() {
    const error = new Error('readiness failed');
    const onBeforeStart = this.sinon.stub();
    onBeforeStart.onFirstCall().rejects(error);
    const app = new (Application.extend({ onBeforeStart }))();

    await expectRejection(app.start(), error);
    expect(app.isRunning()).to.be.false;
    expect(await app.start()).to.be.true;
    expect(app.isRunning()).to.be.true;
  });

  it('keeps running when the start completion hook fails', async function() {
    const error = new Error('start completion failed');
    const app = new (Application.extend({
      onStart() { throw error; }
    }))();

    await expectRejection(app.start(), error);

    expect(app.isRunning()).to.be.true;
  });

  it('stops a running Application once and shares the in-flight result', async function() {
    const stopping = defer();
    const beforeStop = this.sinon.stub().returns(stopping.promise);
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({ onBeforeStop: beforeStop, onStop: stopEvent }))();
    await app.start();

    const first = app.stop();
    const repeated = app.stop();

    expect(repeated).to.equal(first);
    expect(app.isRunning()).to.be.false;
    stopping.resolve();
    expect(await first).to.be.true;
    expect(await app.stop()).to.be.true;
    expect(beforeStop).to.have.been.calledOnce;
    expect(stopEvent).to.have.been.calledOnce;
  });

  it('rejects a synchronous before:stop failure', async function() {
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { throw error; }
    }))();
    await app.start();

    await expectRejection(app.stop(), error);

    expect(app.isRunning()).to.be.true;
  });

  it('rejects the winning stop when superseded restart readiness throws synchronously', async function() {
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { throw error; }
    }))();
    await app.start();

    const restart = app.restart();
    const stop = app.stop();

    expect(await restart).to.be.false;
    await expectRejection(stop, error);
    expect(app.isRunning()).to.be.true;
  });

  it('preserves running state when restart inherits failing stop readiness', async function() {
    const stopping = defer();
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; }
    }))();
    await app.start();

    const stop = app.stop();
    const restart = app.restart();
    const restartResult = expectRejection(restart, error);

    expect(await stop).to.be.false;
    stopping.reject(error);
    await restartResult;
    expect(app.isRunning()).to.be.true;
  });

  it('preserves running state when destroy inherits failing stop readiness', async function() {
    const stopping = defer();
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; }
    }))();
    await app.start();

    const stop = app.stop();
    const destroy = app.destroy();
    const destroyResult = expectRejection(destroy, error);

    expect(await stop).to.be.false;
    stopping.reject(error);
    await destroyResult;
    expect(app.isRunning()).to.be.true;
    expect(app.isDestroyed()).to.be.false;
  });

  it('preserves running state when destroy supersedes failing restart teardown', async function() {
    const stopping = defer();
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; }
    }))();
    await app.start();

    const restart = app.restart();
    const destroy = app.destroy();
    const destroyResult = expectRejection(destroy, error);

    expect(await restart).to.be.false;
    stopping.reject(error);
    await destroyResult;
    expect(app.isRunning()).to.be.true;
    expect(app.isDestroyed()).to.be.false;
  });

  it('restarts through stop and start in lifecycle order', async function() {
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

    expect(await app.restart()).to.be.true;

    expect(events).to.deep.equal(['before:stop', 'stop', 'before:start', 'start']);
    expect(app.isRunning()).to.be.true;
  });

  it('shares a compatible in-flight restart', async function() {
    const stopping = defer();
    const beforeStop = this.sinon.stub().returns(stopping.promise);
    const app = new (Application.extend({ onBeforeStop: beforeStop }))();
    await app.start();

    const first = app.restart();
    const repeated = app.restart();

    expect(repeated).to.equal(first);
    stopping.resolve();
    expect(await first).to.be.true;
    expect(beforeStop).to.have.been.calledOnce;
    expect(app.isRunning()).to.be.true;
  });

  it('remains stopped when restart readiness fails after stop', async function() {
    const error = new Error('restart failed');
    const events = [];
    const onBeforeStart = this.sinon.stub();
    onBeforeStart.onSecondCall().rejects(error);
    const app = new (Application.extend({
      onBeforeStart,
      onStop() { events.push('stop'); }
    }))();
    await app.start();

    await expectRejection(app.restart(), error);

    expect(events).to.deep.equal(['stop']);
    expect(app.isRunning()).to.be.false;
  });

  it('lets start supersede an in-flight stop without a stale stop event', async function() {
    const stopping = defer();
    const beforeStart = this.sinon.spy();
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({
      onBeforeStart: beforeStart,
      onBeforeStop() { return stopping.promise; },
      onStop: stopEvent
    }))();
    await app.start();
    beforeStart.resetHistory();

    const stop = app.stop();
    const start = app.start();

    expect(await stop).to.be.false;
    expect(beforeStart).to.not.have.been.called;

    stopping.resolve();
    expect(await start).to.be.true;

    expect(beforeStart).to.have.been.calledOnce;
    expect(stopEvent).to.not.have.been.called;
    expect(app.isRunning()).to.be.true;
  });

  it('rejects a start that supersedes failing stop readiness', async function() {
    const stopping = defer();
    const error = new Error('stop failed');
    const beforeStart = this.sinon.spy();
    const app = new (Application.extend({
      onBeforeStart: beforeStart,
      onBeforeStop() { return stopping.promise; }
    }))();
    await app.start();
    beforeStart.resetHistory();

    const stop = app.stop();
    const start = app.start();
    const startResult = expectRejection(start, error);

    expect(await stop).to.be.false;
    stopping.reject(error);
    await startResult;

    expect(beforeStart).to.not.have.been.called;
    expect(app.isRunning()).to.be.true;
  });

  it('restarts during startup without exposing the invalidated start', async function() {
    const firstReadiness = defer();
    const events = [];
    let starts = 0;
    const TestApplication = Application.extend({
      onBeforeStart() {
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

    expect(await start).to.be.false;
    expect(await restart).to.be.true;
    expect(events).to.deep.equal([
      'before:start',
      'before:stop',
      'stop',
      'before:start',
      'start'
    ]);

    firstReadiness.resolve();
    await firstReadiness.promise;
    await Promise.resolve();

    expect(events.filter(event => event === 'start')).to.have.length(1);
    expect(app.isRunning()).to.be.true;
  });

  it('stops a restart whose new startup is still pending', async function() {
    const restartReadiness = defer();
    const restartStarted = defer();
    let restartContext;
    const beforeStop = this.sinon.spy();
    const stopEvent = this.sinon.spy();
    const startEvent = this.sinon.spy();
    const onBeforeStart = this.sinon.stub();
    onBeforeStart.onSecondCall().callsFake((app, options, context) => {
      restartContext = context;
      restartStarted.resolve();
      return restartReadiness.promise;
    });
    const app = new (Application.extend({
      onBeforeStart,
      onBeforeStop: beforeStop,
      onStop: stopEvent,
      onStart: startEvent
    }))();
    await app.start();
    startEvent.resetHistory();

    const restart = app.restart();
    await restartStarted.promise;
    const stop = app.stop();

    expect(await restart).to.be.false;
    expect(await stop).to.be.true;
    expect(restartContext.signal.aborted).to.be.true;
    restartReadiness.resolve();
    await restartReadiness.promise;
    await Promise.resolve();

    expect(startEvent).to.not.have.been.called;
    expect(beforeStop).to.have.been.calledOnce;
    expect(stopEvent).to.have.been.calledOnce;
    expect(app.isRunning()).to.be.false;
  });

  it('shares stop readiness when stop supersedes restart teardown', async function() {
    const stopping = defer();
    const beforeStop = this.sinon.stub().returns(stopping.promise);
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({ onBeforeStop: beforeStop, onStop: stopEvent }))();
    await app.start();

    const restart = app.restart();
    const stop = app.stop();

    expect(await restart).to.be.false;
    stopping.resolve();
    expect(await stop).to.be.true;
    expect(beforeStop).to.have.been.calledOnce;
    expect(stopEvent).to.have.been.calledOnce;
    expect(app.isRunning()).to.be.false;
  });

  it('destroys a restart without repeating its completed stop phase', async function() {
    const restartReadiness = defer();
    const restartStarted = defer();
    const beforeStop = this.sinon.spy();
    const stopEvent = this.sinon.spy();
    const onBeforeStart = this.sinon.stub();
    onBeforeStart.onSecondCall().callsFake(() => {
      restartStarted.resolve();
      return restartReadiness.promise;
    });
    const app = new (Application.extend({
      onBeforeStart,
      onBeforeStop: beforeStop,
      onStop: stopEvent
    }))();
    await app.start();

    const restart = app.restart();
    await restartStarted.promise;
    const destroy = app.destroy();

    expect(await restart).to.be.false;
    expect(await destroy).to.be.true;
    expect(beforeStop).to.have.been.calledOnce;
    expect(stopEvent).to.have.been.calledOnce;
    expect(app.isDestroyed()).to.be.true;

    restartReadiness.resolve();
    await restartReadiness.promise;
    await Promise.resolve();

    expect(app.isDestroyed()).to.be.true;
  });

  it('lets destroy supersede startup and prevents stale lifecycle work', async function() {
    const readiness = defer();
    const events = [];
    const TestApplication = Application.extend({
      onBeforeStart() {
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

    expect(await start).to.be.false;
    expect(await destroy).to.be.true;
    expect(app.isDestroyed()).to.be.true;

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
    const startEvent = this.sinon.spy();
    const TestApplication = Application.extend({
      onBeforeStart() {
        stop = this.stop();
      },
      onStart: startEvent
    });
    const app = new TestApplication();

    expect(await app.start()).to.be.false;
    expect(await stop).to.be.true;
    expect(startEvent).to.not.have.been.called;
    expect(app.isRunning()).to.be.false;
  });

  it('shares a reentrant start that is not awaited by its own readiness hook', async function() {
    let repeated;
    const app = new (Application.extend({
      onBeforeStart() {
        repeated = this.start();
      }
    }))();

    const start = app.start();

    expect(repeated).to.equal(start);
    expect(await start).to.be.true;
    expect(app.isRunning()).to.be.true;
  });

  it('absorbs failure from readiness after startup is superseded', async function() {
    const readiness = defer();
    const error = new Error('stale failure');
    const startEvent = this.sinon.spy();
    const app = new (Application.extend({
      onBeforeStart() { return readiness.promise; },
      onStart: startEvent
    }))();

    const start = app.start();
    expect(await app.stop()).to.be.true;
    expect(await start).to.be.false;

    readiness.reject(error);
    await expectRejection(readiness.promise, error);
    await Promise.resolve();

    expect(startEvent).to.not.have.been.called;
    expect(app.isRunning()).to.be.false;
  });

  it('rejects destroy hook failure without marking the Application destroyed', async function() {
    const error = new Error('destroy failed');
    const app = new (Application.extend({
      onBeforeDestroy() {
        throw error;
      }
    }))();

    await expectRejection(app.destroy(), error);

    expect(app.isDestroyed()).to.be.false;
    expect(await app.start()).to.be.true;
  });

  it('shares repeated destroy calls while teardown is in flight', async function() {
    const teardown = defer();
    let destroyContext;
    const beforeDestroy = this.sinon.stub().callsFake((app, options, context) => {
      destroyContext = context;
      return teardown.promise;
    });
    const destroyEvent = this.sinon.spy();
    const app = new (Application.extend({ onBeforeDestroy: beforeDestroy, onDestroy: destroyEvent }))();

    const first = app.destroy();
    const repeated = app.destroy();
    const stop = app.stop();

    expect(repeated).to.equal(first);
    expect(await stop).to.be.true;
    expect(app.isDestroyed()).to.be.false;
    expect(destroyContext.signal.aborted).to.be.false;
    teardown.resolve();
    expect(await first).to.be.true;
    expect(app.isDestroyed()).to.be.true;
    expect(destroyContext.signal.aborted).to.be.false;
    expect(beforeDestroy).to.have.been.calledOnce;
    expect(destroyEvent).to.have.been.calledOnce;
  });

  it('stays stopped when destroy fails after stopping a running Application', async function() {
    const error = new Error('destroy failed');
    const events = [];
    const app = new (Application.extend({
      onStop() { events.push('stop'); },
      onBeforeDestroy() { throw error; }
    }))();
    await app.start();

    await expectRejection(app.destroy(), error);

    expect(events).to.deep.equal(['stop']);
    expect(app.isRunning()).to.be.false;
    expect(app.isDestroyed()).to.be.false;
  });

  it('resolves stop when destroy fails after completing its stop phase', async function() {
    const stopping = defer();
    const error = new Error('destroy failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; },
      onBeforeDestroy() { throw error; }
    }))();
    await app.start();

    const destroy = app.destroy();
    const stop = app.stop();
    const destroyResult = expectRejection(destroy, error);

    stopping.resolve();
    await destroyResult;

    expect(await stop).to.be.true;
    expect(app.isRunning()).to.be.false;
    expect(app.isDestroyed()).to.be.false;
  });

  it('shares stop calls during destroy and settles after the stop phase', async function() {
    const stopping = defer();
    const teardown = defer();
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; },
      onStop: stopEvent,
      onBeforeDestroy() { return teardown.promise; }
    }))();
    await app.start();

    const destroy = app.destroy();
    const firstStop = app.stop();
    const repeatedStop = app.stop();
    const thirdStop = app.stop();

    expect(repeatedStop).to.equal(firstStop);
    expect(thirdStop).to.equal(firstStop);
    stopping.resolve();
    expect(await firstStop).to.be.true;
    expect(stopEvent).to.have.been.calledOnce;
    expect(app.isDestroyed()).to.be.false;

    teardown.resolve();
    expect(await destroy).to.be.true;
    expect(app.isDestroyed()).to.be.true;
  });

  it('shares stop readiness across a start-stop-destroy overlap', async function() {
    const stopping = defer();
    const beforeStop = this.sinon.stub().returns(stopping.promise);
    const startEvent = this.sinon.spy();
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({
      onBeforeStop: beforeStop,
      onStart: startEvent,
      onStop: stopEvent
    }))();
    await app.start();
    startEvent.resetHistory();

    const stop = app.stop();
    const start = app.start();
    const destroy = app.destroy();
    const stopDuringDestroy = app.stop();

    expect(await start).to.be.false;
    expect(await stop).to.be.false;
    expect(beforeStop).to.have.been.calledOnce;

    stopping.resolve();
    expect(await destroy).to.be.true;
    expect(await stopDuringDestroy).to.be.true;

    expect(beforeStop).to.have.been.calledOnce;
    expect(stopEvent).to.have.been.calledOnce;
    expect(startEvent).to.not.have.been.called;
    expect(app.isDestroyed()).to.be.true;
  });

  it('shares repeated stop readiness before destroy supersedes both calls', async function() {
    const stopping = defer();
    const beforeStop = this.sinon.stub().returns(stopping.promise);
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({ onBeforeStop: beforeStop, onStop: stopEvent }))();
    await app.start();

    const firstStop = app.stop();
    const repeatedStop = app.stop();
    const destroy = app.destroy();

    expect(repeatedStop).to.equal(firstStop);
    expect(await firstStop).to.be.false;
    expect(await repeatedStop).to.be.false;

    stopping.resolve();
    expect(await destroy).to.be.true;
    expect(beforeStop).to.have.been.calledOnce;
    expect(stopEvent).to.have.been.calledOnce;
    expect(app.isDestroyed()).to.be.true;
  });

  it('resolves stop when destroy completion fails after marking destroyed', async function() {
    const stopping = defer();
    const error = new Error('destroy completion failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; },
      onDestroy() { throw error; }
    }))();
    await app.start();

    const destroy = app.destroy();
    const stop = app.stop();
    const destroyResult = expectRejection(destroy, error);

    stopping.resolve();
    await destroyResult;

    expect(await stop).to.be.true;
    expect(app.isDestroyed()).to.be.true;
  });

  it('rejects stop during destroy when stopping fails', async function() {
    const stopping = defer();
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; }
    }))();
    await app.start();

    const destroy = app.destroy();
    const stop = app.stop();
    const destroyResult = expectRejection(destroy, error);
    const stopResult = expectRejection(stop, error);

    stopping.reject(error);
    await Promise.all([destroyResult, stopResult]);

    expect(app.isRunning()).to.be.true;
    expect(app.isDestroyed()).to.be.false;
  });

  it('keeps running when destroy stop readiness fails without a stop caller', async function() {
    const error = new Error('stop failed');
    const app = new (Application.extend({
      onBeforeStop() { throw error; }
    }))();
    await app.start();

    await expectRejection(app.destroy(), error);

    expect(app.isRunning()).to.be.true;
    expect(app.isDestroyed()).to.be.false;
  });

  it('rejects a concurrent stop when destroy stop readiness throws synchronously', async function() {
    const error = new Error('stop failed');
    const beforeStop = this.sinon.stub().throws(error);
    const app = new (Application.extend({
      onBeforeStop: beforeStop
    }))();
    await app.start();

    const destroy = app.destroy();
    const stop = app.stop();

    await Promise.all([
      expectRejection(destroy, error),
      expectRejection(stop, error)
    ]);

    expect(app.isRunning()).to.be.true;
    expect(app.isDestroyed()).to.be.false;
    expect(beforeStop).to.have.been.calledOnce;
  });

  it('rejects stop during destroy when the stop event fails', async function() {
    const stopping = defer();
    const error = new Error('stop event failed');
    const app = new (Application.extend({
      onBeforeStop() { return stopping.promise; },
      onStop() { throw error; }
    }))();
    await app.start();

    const destroy = app.destroy();
    const stop = app.stop();
    const destroyResult = expectRejection(destroy, error);
    const stopResult = expectRejection(stop, error);

    stopping.resolve();
    await Promise.all([destroyResult, stopResult]);

    expect(app.isRunning()).to.be.false;
    expect(app.isDestroyed()).to.be.false;
  });

  it('rejects destroy when its stop event fails without a stop caller', async function() {
    const error = new Error('stop event failed');
    const app = new (Application.extend({
      onStop() { throw error; }
    }))();
    await app.start();

    await expectRejection(app.destroy(), error);

    expect(app.isRunning()).to.be.false;
    expect(app.isDestroyed()).to.be.false;
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

    expect(await app.start()).to.be.true;
    expect(await stop).to.be.true;
    expect(await restart).to.be.true;

    expect(events).to.deep.equal(['start', 'stop', 'start']);
    expect(app.isRunning()).to.be.true;
  });

  it('tears down Application-owned Radio replies through async destroy', async function() {
    const channelName = 'application-lifecycle-radio';
    const TestApplication = Application.extend({
      channelName,
      radioRequests: { value: 'getValue' },
      getValue() { return 42; }
    });
    const app = new TestApplication();
    const channel = app.getChannel();
    this.sinon.spy(channel, 'stopReplying');

    expect(Radio.request(channelName, 'value')).to.equal(42);

    expect(await app.destroy()).to.be.true;

    expect(channel.stopReplying).to.have.been.calledOnceWith(null, null, app);
    expect(Radio.request(channelName, 'value')).to.be.undefined;
  });

  it('does not retain operation records across repeated start-stop cycles', async function() {
    const beforeStart = this.sinon.spy();
    const startEvent = this.sinon.spy();
    const beforeStop = this.sinon.spy();
    const stopEvent = this.sinon.spy();
    const app = new (Application.extend({
      onBeforeStart: beforeStart,
      onStart: startEvent,
      onBeforeStop: beforeStop,
      onStop: stopEvent
    }))();

    for (let index = 0; index < 10; index++) {
      expect(await app.start()).to.be.true;
      expect(await app.stop()).to.be.true;
      expect(Object.hasOwn(app, '_lifecycleOperation')).to.be.false;
    }

    expect(beforeStart).to.have.callCount(10);
    expect(startEvent).to.have.callCount(10);
    expect(beforeStop).to.have.callCount(10);
    expect(stopEvent).to.have.callCount(10);
  });

});
