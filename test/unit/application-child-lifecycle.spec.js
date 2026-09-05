'use strict';

import { Application } from '../../src/index';

async function expectRejection(promise, expectedError) {
  try {
    await promise;
  } catch (error) {
    expect(error).to.equal(expectedError);
    return;
  }

  throw new Error('Expected promise to reject.');
}

describe('Application child lifecycle', function() {
  it('starts and stops children in registration order before owner completion', async function() {
    const events = [];
    const options = { source: 'owner' };
    const ChildApplication = Application.extend({
      onBeforeStart(application, receivedOptions) {
        expect(receivedOptions).to.equal(options);
        events.push(`${this.getName()}:before:start`);
      },
      onStart() {
        events.push(`${this.getName()}:start`);
      },
      onBeforeStop(application, receivedOptions) {
        expect(receivedOptions).to.equal(options);
        events.push(`${this.getName()}:before:stop`);
      },
      onStop() {
        events.push(`${this.getName()}:stop`);
      }
    });
    const OwnerApplication = Application.extend({
      onBeforeStart() { events.push('owner:before:start'); },
      onStart() { events.push('owner:start'); },
      onBeforeStop() { events.push('owner:before:stop'); },
      onStop() { events.push('owner:stop'); }
    });
    const owner = new OwnerApplication();
    owner.addChildApp('first', new ChildApplication());
    owner.addChildApp('second', new ChildApplication());

    expect(await owner.start(options)).to.be.true;
    expect(events).to.deep.equal([
      'owner:before:start',
      'first:before:start',
      'first:start',
      'second:before:start',
      'second:start',
      'owner:start'
    ]);

    events.length = 0;
    expect(await owner.stop(options)).to.be.true;
    expect(events).to.deep.equal([
      'owner:before:stop',
      'first:before:stop',
      'first:stop',
      'second:before:stop',
      'second:stop',
      'owner:stop'
    ]);

    await owner.destroy();
  });

  it('does not implicitly start a child added to a running owner', async function() {
    const owner = new Application();
    const child = new Application();
    await owner.start();

    owner.addChildApp('child', child);

    expect(child.isRunning()).to.be.false;
    expect(await owner.restart()).to.be.true;
    expect(child.isRunning()).to.be.true;

    await owner.destroy();
  });

  it('retains a started prefix when a child start fails and retries in order', async function() {
    const error = new Error('second not ready');
    const events = [];
    let attempt = 0;
    const FirstApplication = Application.extend({
      onStart() { events.push('first'); }
    });
    const SecondApplication = Application.extend({
      onBeforeStart() {
        if (!attempt++) { throw error; }
      },
      onStart() { events.push('second'); }
    });
    const ThirdApplication = Application.extend({
      onStart() { events.push('third'); }
    });
    const owner = new Application();
    const first = new FirstApplication();
    const second = new SecondApplication();
    const third = new ThirdApplication();
    owner.addChildApp('first', first);
    owner.addChildApp('second', second);
    owner.addChildApp('third', third);

    await expectRejection(owner.start(), error);

    expect(owner.isRunning()).to.be.false;
    expect(first.isRunning()).to.be.true;
    expect(second.isRunning()).to.be.false;
    expect(third.isRunning()).to.be.false;
    expect(events).to.deep.equal(['first']);

    expect(await owner.start()).to.be.true;
    expect(events).to.deep.equal(['first', 'second', 'third']);

    await owner.destroy();
  });

  it('retains a stopped prefix when a child stop fails and retries in order', async function() {
    const error = new Error('second not ready');
    const events = [];
    let attempt = 0;
    const FirstApplication = Application.extend({
      onStop() { events.push('first'); }
    });
    const SecondApplication = Application.extend({
      onBeforeStop() {
        if (!attempt++) { throw error; }
      },
      onStop() { events.push('second'); }
    });
    const ThirdApplication = Application.extend({
      onStop() { events.push('third'); }
    });
    const owner = new Application();
    const first = new FirstApplication();
    const second = new SecondApplication();
    const third = new ThirdApplication();
    owner.addChildApp('first', first);
    owner.addChildApp('second', second);
    owner.addChildApp('third', third);
    await owner.start();

    await expectRejection(owner.stop(), error);

    expect(owner.isRunning()).to.be.true;
    expect(first.isRunning()).to.be.false;
    expect(second.isRunning()).to.be.true;
    expect(third.isRunning()).to.be.true;
    expect(events).to.deep.equal(['first']);

    expect(await owner.stop()).to.be.true;
    expect(events).to.deep.equal(['first', 'second', 'third']);

    await owner.destroy();
  });

  it('does not start children when before:start supersedes owner startup', async function() {
    let ownerStop;
    const childStart = this.sinon.spy();
    const OwnerApplication = Application.extend({
      onBeforeStart() {
        ownerStop = this.stop();
      }
    });
    const ChildApplication = Application.extend({ onStart: childStart });
    const owner = new OwnerApplication();
    const child = new ChildApplication();
    owner.addChildApp('child', child);

    expect(await owner.start()).to.be.false;
    expect(await ownerStop).to.be.true;
    expect(owner.isRunning()).to.be.false;
    expect(child.isRunning()).to.be.false;
    expect(childStart).to.not.have.been.called;

    await owner.destroy();
  });

  it('does not stop children when before:stop supersedes owner stop', async function() {
    let supersedingStart;
    let shouldSupersede = false;
    const childStop = this.sinon.spy();
    const OwnerApplication = Application.extend({
      onBeforeStop() {
        if (shouldSupersede) {
          supersedingStart = this.start();
        }
      }
    });
    const ChildApplication = Application.extend({ onStop: childStop });
    const owner = new OwnerApplication();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await owner.start();
    shouldSupersede = true;

    expect(await owner.stop()).to.be.false;
    expect(await supersedingStart).to.be.true;
    expect(owner.isRunning()).to.be.true;
    expect(child.isRunning()).to.be.true;
    expect(childStop).to.not.have.been.called;

    shouldSupersede = false;
    await owner.destroy();
  });

  it('does not stop later children after owner stop is superseded', async function() {
    const readiness = Promise.withResolvers();
    const childStopping = Promise.withResolvers();
    const laterChildStop = this.sinon.spy();
    const ChildApplication = Application.extend({
      onBeforeStop() {
        childStopping.resolve();
        return readiness.promise;
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    const laterChild = new (Application.extend({ onStop: laterChildStop }))();
    owner.addChildApp('child', child);
    owner.addChildApp('later', laterChild);
    await owner.start();

    const stop = owner.stop();
    await childStopping.promise;
    const start = owner.start();
    readiness.resolve();

    expect(await stop).to.be.false;
    expect(await start).to.be.true;
    expect(owner.isRunning()).to.be.true;
    expect(child.isRunning()).to.be.true;
    expect(laterChild.isRunning()).to.be.true;
    expect(laterChildStop).to.not.have.been.called;

    await owner.destroy();
  });

  it('cancels owner startup when child onStart directly stops', async function() {
    let childStop;
    const ChildApplication = Application.extend({
      onStart() {
        childStop = this.stop();
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);

    expect(await owner.start()).to.be.false;
    expect(await childStop).to.be.true;
    expect(owner.isRunning()).to.be.false;
    expect(child.isRunning()).to.be.false;

    await owner.destroy();
  });

  ['stop', 'restart', 'destroy'].forEach(method => {
    it(`begins a new stop phase when ${method} replaces a start after child stops were canceled`, async function() {
      const readiness = Promise.withResolvers();
      const childStopping = Promise.withResolvers();
      const events = [];
      const firstOptions = { source: 'first' };
      const latestOptions = { source: 'latest' };
      const ChildApplication = Application.extend({
        onBeforeStop() {
          if (this.getName() === 'first') {
            childStopping.resolve();
            return readiness.promise;
          }
        },
        onStop() { events.push(`${this.getName()}:stop`); }
      });
      const OwnerApplication = Application.extend({
        onBeforeStop(application, options) { events.push(options); },
        onStop() { events.push('owner:stop'); }
      });
      const owner = new OwnerApplication();
      const first = owner.addChildApp('first', new ChildApplication());
      const second = owner.addChildApp('second', new ChildApplication());
      await owner.start();

      const earlierStop = owner.stop(firstOptions);
      await childStopping.promise;
      const start = owner.start();
      const childStop = first.stop();
      readiness.resolve();
      await childStop;
      const latest = owner[method](latestOptions);

      expect(await Promise.all([earlierStop, start, latest])).to.deep.equal([false, false, true]);
      expect(events).to.deep.equal([firstOptions, 'first:stop', latestOptions, 'second:stop', 'owner:stop']);
      expect(owner.isRunning()).to.equal(method === 'restart');
      expect(first.isRunning()).to.equal(method === 'restart');
      expect(second.isRunning()).to.equal(method === 'restart');
      expect(owner.isDestroyed()).to.equal(method === 'destroy');
      expect(first.isDestroyed()).to.equal(method === 'destroy');
      expect(second.isDestroyed()).to.equal(method === 'destroy');

      await owner.destroy();
    });
  });

  ['owner', 'child'].forEach(failAt => {
    it(`retains the prior owner state when ${failAt} startup fails after canceled child stops`, async function() {
      const readiness = Promise.withResolvers();
      const childStopping = Promise.withResolvers();
      const failure = new Error('replacement startup failed');
      const events = [];
      let shouldFail = false;
      const ChildApplication = Application.extend({
        onBeforeStart() {
          if (shouldFail && failAt === 'child' && this.getName() === 'first') { throw failure; }
        },
        onBeforeStop() {
          if (this.getName() === 'first') {
            childStopping.resolve();
            return readiness.promise;
          }
        },
        onStop() { events.push(`${this.getName()}:stop`); }
      });
      const OwnerApplication = Application.extend({
        onBeforeStart() {
          if (shouldFail && failAt === 'owner') { throw failure; }
        },
        onStop() { events.push('owner:stop'); }
      });
      const owner = new OwnerApplication();
      const first = owner.addChildApp('first', new ChildApplication());
      const second = owner.addChildApp('second', new ChildApplication());
      await owner.start();

      const stop = owner.stop();
      await childStopping.promise;
      shouldFail = true;
      const start = expectRejection(owner.start(), failure);
      readiness.resolve();

      expect(await stop).to.be.false;
      await start;
      expect(owner.isRunning()).to.be.true;
      expect(first.isRunning()).to.be.false;
      expect(second.isRunning()).to.be.true;
      expect(events).to.deep.equal(['first:stop']);

      expect(await owner.stop()).to.be.true;
      expect(owner.isRunning()).to.be.false;
      expect(second.isRunning()).to.be.false;
      expect(events).to.deep.equal(['first:stop', 'second:stop', 'owner:stop']);
      await owner.destroy();
    });
  });

  it('retains stopped state when startup fails after inherited stop readiness completes', async function() {
    const readiness = Promise.withResolvers();
    const failure = new Error('replacement startup failed');
    let shouldFail = false;
    const owner = new (Application.extend({
      onBeforeStop() { return readiness.promise; },
      onBeforeStart() {
        if (shouldFail) { throw failure; }
      }
    }))();
    await owner.start();

    const stop = owner.stop();
    shouldFail = true;
    const start = expectRejection(owner.start(), failure);
    readiness.resolve();

    expect(await stop).to.be.false;
    await start;
    expect(owner.isRunning()).to.be.false;
    await owner.destroy();
  });

  it('cancels owner stop when child onStop directly starts', async function() {
    let childStart;
    let shouldRestart = false;
    const ChildApplication = Application.extend({
      onStop() {
        if (shouldRestart) {
          childStart = this.start();
        }
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await owner.start();
    shouldRestart = true;

    expect(await owner.stop()).to.be.false;
    expect(await childStart).to.be.true;
    expect(owner.isRunning()).to.be.true;
    expect(child.isRunning()).to.be.true;

    shouldRestart = false;
    await owner.destroy();
  });

  it('cancels owner startup when a direct child stop supersedes it', async function() {
    const readiness = Promise.withResolvers();
    const childStarting = Promise.withResolvers();
    const ownerStart = this.sinon.spy();
    const ChildApplication = Application.extend({
      onBeforeStart(application, options, context) {
        childStarting.resolve();
        context.signal.addEventListener('abort', readiness.resolve, { once: true });
        return readiness.promise;
      }
    });
    const owner = new (Application.extend({ onStart: ownerStart }))();
    const first = new Application();
    const child = new ChildApplication();
    owner.addChildApp('first', first);
    owner.addChildApp('child', child);

    const start = owner.start();
    await childStarting.promise;

    expect(await child.stop()).to.be.true;
    expect(await start).to.be.false;
    expect(owner.isRunning()).to.be.false;
    expect(first.isRunning()).to.be.true;
    expect(child.isRunning()).to.be.false;
    expect(ownerStart).to.not.have.been.called;

    await owner.destroy();
  });

  it('stops a child whose startup is invalidated with its owner', async function() {
    const readiness = Promise.withResolvers();
    const childStarting = Promise.withResolvers();
    const ChildApplication = Application.extend({
      onBeforeStart(application, options, context) {
        childStarting.resolve();
        context.signal.addEventListener('abort', readiness.resolve, { once: true });
        return readiness.promise;
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);

    const start = owner.start();
    await childStarting.promise;
    const stop = owner.stop();

    expect(await start).to.be.false;
    expect(await stop).to.be.true;
    expect(owner.isRunning()).to.be.false;
    expect(child.isRunning()).to.be.false;

    await owner.destroy();
  });

  it('destroys a child whose startup is invalidated with its owner', async function() {
    const readiness = Promise.withResolvers();
    const childStarting = Promise.withResolvers();
    const ChildApplication = Application.extend({
      onBeforeStart(application, options, context) {
        childStarting.resolve();
        context.signal.addEventListener('abort', readiness.resolve, { once: true });
        return readiness.promise;
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);

    const start = owner.start();
    await childStarting.promise;
    const destroy = owner.destroy();

    expect(await start).to.be.false;
    expect(await destroy).to.be.true;
    expect(owner.isDestroyed()).to.be.true;
    expect(child.isDestroyed()).to.be.true;
  });

  it('cancels owner stop when a direct child start supersedes it', async function() {
    const readiness = Promise.withResolvers();
    const childStopping = Promise.withResolvers();
    const ownerStop = this.sinon.spy();
    const ChildApplication = Application.extend({
      onBeforeStop() {
        childStopping.resolve();
        return readiness.promise;
      }
    });
    const owner = new (Application.extend({ onStop: ownerStop }))();
    const first = new Application();
    const child = new ChildApplication();
    owner.addChildApp('first', first);
    owner.addChildApp('child', child);
    await owner.start();

    const stop = owner.stop();
    await childStopping.promise;
    const start = child.start();

    expect(await stop).to.be.false;
    expect(owner.isRunning()).to.be.true;
    expect(first.isRunning()).to.be.false;
    expect(ownerStop).to.not.have.been.called;

    readiness.resolve();
    expect(await start).to.be.true;
    expect(child.isRunning()).to.be.true;

    await owner.destroy();
  });

  it('stops a directly started child before stopped owner destroy readiness', async function() {
    const events = [];
    const ChildApplication = Application.extend({
      onStop() { events.push('child:stop'); }
    });
    const OwnerApplication = Application.extend({
      onBeforeDestroy() { events.push('owner:before:destroy'); }
    });
    const owner = new OwnerApplication();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await child.start();

    expect(await owner.destroy()).to.be.true;
    expect(events).to.deep.equal(['child:stop', 'owner:before:destroy']);
  });

  it('rejects stopped owner destroy when an active child stop fails', async function() {
    const error = new Error('child not ready');
    let attempt = 0;
    const ChildApplication = Application.extend({
      onBeforeStop() {
        if (!attempt++) { throw error; }
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await child.start();

    await expectRejection(owner.destroy(), error);
    expect(owner.isDestroyed()).to.be.false;
    expect(owner.isRunning()).to.be.false;
    expect(child.isRunning()).to.be.true;
    expect(owner.getChildApp('child')).to.equal(child);

    expect(await owner.destroy()).to.be.true;
    expect(child.isDestroyed()).to.be.true;
  });

  it('blocks descendant startup after owner destruction begins', async function() {
    const readiness = Promise.withResolvers();
    const childStopping = Promise.withResolvers();
    const ChildApplication = Application.extend({
      onBeforeStop() {
        childStopping.resolve();
        return readiness.promise;
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await owner.start();

    const destroy = owner.destroy();
    await childStopping.promise;

    expect(await child.start()).to.be.false;
    readiness.resolve();
    expect(await destroy).to.be.true;
    expect(child.isDestroyed()).to.be.true;
  });

  it('blocks grandchild startup after root destruction begins', async function() {
    const readiness = Promise.withResolvers();
    const rootDestroying = Promise.withResolvers();
    const RootApplication = Application.extend({
      onBeforeDestroy() {
        rootDestroying.resolve();
        return readiness.promise;
      }
    });
    const root = new RootApplication();
    const child = new Application();
    const grandchild = new Application();
    root.addChildApp('child', child);
    child.addChildApp('grandchild', grandchild);

    const destroy = root.destroy();
    await rootDestroying.promise;

    expect(await grandchild.start()).to.be.false;
    expect(await grandchild.restart()).to.be.false;
    readiness.resolve();
    expect(await destroy).to.be.true;
  });

  it('follows a direct child destroy that supersedes owner-driven stop', async function() {
    const readiness = Promise.withResolvers();
    const childStopping = Promise.withResolvers();
    const ChildApplication = Application.extend({
      onBeforeStop() {
        childStopping.resolve();
        return readiness.promise;
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await owner.start();

    const ownerDestroy = owner.destroy();
    await childStopping.promise;
    const childDestroy = child.destroy();

    readiness.resolve();
    expect(await childDestroy).to.be.true;
    expect(await ownerDestroy).to.be.true;
    expect(owner.isDestroyed()).to.be.true;
    expect(child.isDestroyed()).to.be.true;
  });

  it('destroys a child that restarts from onStop during owner destroy', async function() {
    let childStart;
    let shouldRestart = false;
    const ChildApplication = Application.extend({
      onStop() {
        if (shouldRestart) {
          childStart = this.start();
        }
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);
    await owner.start();
    shouldRestart = true;

    expect(await owner.destroy()).to.be.true;
    expect(await childStart).to.be.false;
    expect(owner.isDestroyed()).to.be.true;
    expect(child.isDestroyed()).to.be.true;
  });

  it('stops children before owner destroy readiness', async function() {
    const events = [];
    const ChildApplication = Application.extend({
      onStop() { events.push('child:stop'); },
      onBeforeDestroy() { events.push('child:before:destroy'); },
      onDestroy() { events.push('child:destroy'); }
    });
    const OwnerApplication = Application.extend({
      onBeforeDestroy() { events.push('owner:before:destroy'); },
      onDestroy() { events.push('owner:destroy'); }
    });
    const owner = new OwnerApplication();
    owner.addChildApp('child', new ChildApplication());
    await owner.start();

    expect(await owner.destroy()).to.be.true;
    expect(events).to.deep.equal([
      'child:stop',
      'owner:before:destroy',
      'child:before:destroy',
      'child:destroy',
      'owner:destroy'
    ]);
  });
  for (const pendingAt of ['owner', 'child']) {
    for (const [earlier, later] of [['restart', 'stop'], ['stop', 'restart'], ['stop', 'destroy']]) {
      it(`lets ${ later } adopt ${ earlier } while ${ pendingAt } stop readiness is pending`, async function() {
        const stopping = Promise.withResolvers();
        const entered = Promise.withResolvers();
        const firstOptions = { source: 'first' };
        const laterOptions = { source: 'later' };
        const stopped = [];
        const stopOptions = [];
        let childrenStoppedBeforeDestroy;
        const Owner = Application.extend({
          onBeforeStop() {
            if (pendingAt === 'owner') {
              entered.resolve();
              return stopping.promise;
            }
          },
          onStop(app, options) {
            stopped.push('owner');
            stopOptions.push(options);
          },
          onBeforeDestroy() {
            childrenStoppedBeforeDestroy = Object.values(this.getChildApps())
              .every(child => !child.isRunning() && !child.isDestroyed());
          }
        });
        const Child = Application.extend({
          onBeforeStop() {
            if (pendingAt === 'child' && this.getName() === 'first') {
              entered.resolve();
              return stopping.promise;
            }
          },
          onStop(app, options) {
            stopped.push(this.getName());
            stopOptions.push(options);
          }
        });
        const owner = new Owner();
        const first = owner.addChildApp('first', new Child());
        const second = owner.addChildApp('second', new Child());
        await owner.start();

        const previous = owner[earlier](firstOptions);
        await entered.promise;
        const current = owner[later](laterOptions);
        const operations = [previous, current];
        if (later === 'destroy') {
          operations.push(owner.stop());
        }
        stopping.resolve();
        const [previousResult, currentResult, ...followingStop] = await Promise.all(operations);
        const outcome = {
          results: [previousResult, currentResult],
          running: [owner, first, second].map(app => app.isRunning()),
          destroyed: [owner, first, second].map(app => app.isDestroyed()),
          stopped: [...stopped],
          originalStopOptions: stopOptions.every(options => options === firstOptions),
          followingStop,
          childrenStoppedBeforeDestroy
        };
        await owner.destroy();

        expect(outcome).to.deep.equal({
          results: [false, true],
          running: [later === 'restart', later === 'restart', later === 'restart'],
          destroyed: [later === 'destroy', later === 'destroy', later === 'destroy'],
          stopped: ['first', 'second', 'owner'],
          originalStopOptions: true,
          followingStop: later === 'destroy' ? [true] : [],
          childrenStoppedBeforeDestroy: later === 'destroy' ? true : undefined
        });
      });
    }
  }

  for (const later of ['stop', 'restart', 'destroy']) {
    it(`preserves a stopped child prefix when adopted ${ later } readiness rejects`, async function() {
      const stopping = Promise.withResolvers();
      const entered = Promise.withResolvers();
      const error = new Error('second child could not stop');
      const stopped = [];
      let attempts = 0;
      const Child = Application.extend({
        onBeforeStop() {
          if (this.getName() === 'second' && !attempts++) {
            entered.resolve();
            return stopping.promise;
          }
        },
        onStop() { stopped.push(this.getName()); }
      });
      const owner = new Application();
      const children = ['first', 'second', 'third'].map(name => owner.addChildApp(name, new Child()));
      await owner.start();

      const previous = later === 'stop' ? owner.restart() : owner.stop();
      await entered.promise;
      const current = expectRejection(owner[later](), error);
      const followingStop = later === 'destroy' ? expectRejection(owner.stop(), error) : undefined;
      stopping.reject(error);
      expect(await previous).to.be.false;
      await current;
      await followingStop;

      expect(owner.isRunning()).to.be.true;
      expect(children.map(child => child.isRunning())).to.deep.equal([false, true, true]);
      expect(stopped).to.deep.equal(['first']);
      expect(await owner.stop()).to.be.true;
      expect(stopped).to.deep.equal(['first', 'second', 'third']);
      await owner.destroy();
    });
  }

});
