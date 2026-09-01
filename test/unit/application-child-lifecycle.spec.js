'use strict';

import { Application } from '../../index';

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
});
