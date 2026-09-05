'use strict';

import { Application, MarionetteError } from '../../src/index';

async function expectRejection(promise, expectedError) {
  try {
    await promise;
  } catch (error) {
    expect(error).to.equal(expectedError);
    return;
  }

  throw new Error('Expected promise to reject.');
}

describe('Application ownership', function() {
  it('keeps separate root Applications free of child storage', async function() {
    const first = new Application();
    const second = new Application();

    expect(first.getName()).to.be.undefined;
    expect(first.getChildApps()).to.deep.equal({});
    expect(first).to.not.have.own.property('_parentApp');
    expect(first).to.not.have.own.property('_childApps');

    expect(second.getChildApps()).to.deep.equal({});
    expect(second).to.not.have.own.property('_parentApp');

    await first.destroy();
    await second.destroy();
  });

  it('registers nested Applications for owner-side lookup', async function() {
    const root = new Application();
    const child = new Application();
    const grandchild = new Application();

    expect(root.addChildApp('child', child)).to.equal(child);
    expect(child.addChildApp('grandchild', grandchild)).to.equal(grandchild);

    expect(root.hasChildApp('child')).to.be.true;
    expect(root.getChildApp('child')).to.equal(child);
    expect(root.getChildApps()).to.deep.equal({ child });
    expect(child).to.have.own.property('_parentApp', root);
    expect(child.getName()).to.equal('child');
    expect(child.getChildApp('grandchild')).to.equal(grandchild);
    expect(grandchild).to.have.own.property('_parentApp', child);
    expect(grandchild.getName()).to.equal('grandchild');
    expect(() => grandchild.addChildApp('root', root))
      .to.throw(MarionetteError).and.include({ code: 'MN0031' });

    await root.destroy();
  });

  it('supports own Application names without prototype collisions', async function() {
    const owner = new Application();
    const constructorChild = new Application();
    const protoChild = new Application();

    owner.addChildApp('constructor', constructorChild);
    owner.addChildApp('__proto__', protoChild);

    const children = owner.getChildApps();
    expect(Object.getPrototypeOf(children)).to.equal(Object.prototype);
    expect(Object.keys(children)).to.deep.equal(['constructor', '__proto__']);
    expect(children).to.have.own.property('constructor', constructorChild);
    expect(children).to.have.own.property('__proto__', protoChild);
    expect(owner.getChildApp('__proto__')).to.equal(protoChild);

    await owner.destroy();
  });

  it('returns a fresh child snapshot', async function() {
    const owner = new Application();
    const child = new Application();
    owner.addChildApp('child', child);

    const children = owner.getChildApps();
    delete children.child;
    children.other = new Application();

    expect(owner.getChildApps()).to.deep.equal({ child });

    await children.other.destroy();
    await owner.destroy();
  });

  it('treats the completed identity as an idempotent registration', async function() {
    const owner = new Application();
    const child = new Application();

    expect(owner.addChildApp('child', child)).to.equal(child);
    expect(owner.addChildApp('child', child)).to.equal(child);
    expect(owner.getChildApps()).to.deep.equal({ child });

    await owner.destroy();
  });

  it('rejects invalid ownership without changing the hierarchy', async function() {
    const owner = new Application();
    const otherOwner = new Application();
    const child = new Application();
    owner.addChildApp('child', child);

    const conflicts = [
      () => owner.addChildApp('', new Application()),
      () => owner.addChildApp('plain', {}),
      () => owner.addChildApp('child', new Application()),
      () => owner.addChildApp('other', child),
      () => otherOwner.addChildApp('child', child),
      () => owner.addChildApp('self', owner),
      () => child.addChildApp('root', owner)
    ];

    for (const conflict of conflicts) {
      expect(conflict).to.throw(MarionetteError).and.include({
        code: 'MN0031',
        name: 'ApplicationError'
      });
    }

    expect(owner.getChildApps()).to.deep.equal({ child });
    expect(otherOwner.getChildApps()).to.deep.equal({});
    expect(child).to.have.own.property('_parentApp', owner);
    expect(child.getName()).to.equal('child');

    await owner.destroy();
    await otherOwner.destroy();
  });

  it('lets hasChildApp avoid allocation before a duplicate name', async function() {
    const owner = new Application();
    const child = new Application();
    owner.addChildApp('child', child);

    let constructed = false;
    if (!owner.hasChildApp('child')) {
      constructed = true;
      owner.addChildApp('child', new Application());
    }

    expect(constructed).to.be.false;
    await owner.destroy();
  });

  it('no-ops registration when either lifecycle is terminal', async function() {
    const ownerReadiness = Promise.withResolvers();
    const DestroyingOwner = Application.extend({
      onBeforeDestroy() {
        return ownerReadiness.promise;
      }
    });
    const destroyedOwner = new DestroyingOwner();
    const liveChild = new Application();
    const ownerDestroy = destroyedOwner.destroy();

    expect(destroyedOwner.addChildApp('', liveChild)).to.equal(liveChild);
    expect(destroyedOwner.hasChildApp('child')).to.be.false;
    expect(liveChild).to.not.have.own.property('_parentApp');
    ownerReadiness.resolve();
    await ownerDestroy;

    const liveOwner = new Application();
    const childReadiness = Promise.withResolvers();
    const DestroyingChild = Application.extend({
      onBeforeDestroy() {
        return childReadiness.promise;
      }
    });
    const destroyedChild = new DestroyingChild();
    const childDestroy = destroyedChild.destroy();

    expect(liveOwner.addChildApp('', destroyedChild)).to.equal(destroyedChild);
    expect(liveOwner.hasChildApp('child')).to.be.false;
    expect(destroyedChild).to.not.have.own.property('_parentApp');
    childReadiness.resolve();
    await childDestroy;

    await liveChild.destroy();
    await liveOwner.destroy();
  });

  it('removes and destroys an owned child', async function() {
    const owner = new Application();
    const child = new Application();
    owner.addChildApp('child', child);

    expect(await owner.removeChildApp('missing')).to.be.undefined;
    expect(await owner.removeChildApp('child', { source: 'owner' })).to.equal(child);
    expect(child.isDestroyed()).to.be.true;
    expect(child).to.not.have.own.property('_parentApp');
    expect(child.getName()).to.be.undefined;
    expect(owner.hasChildApp('child')).to.be.false;
    expect(owner).to.not.have.own.property('_childApps');

    await owner.destroy();
  });

  it('retains a child when removal destroy readiness fails', async function() {
    const readinessError = new Error('not ready');
    let attempt = 0;
    const ChildApplication = Application.extend({
      onBeforeDestroy() {
        if (!attempt++) { throw readinessError; }
      }
    });
    const owner = new Application();
    const child = new ChildApplication();
    owner.addChildApp('child', child);

    await expectRejection(owner.removeChildApp('child'), readinessError);

    expect(child.isDestroyed()).to.be.false;
    expect(owner.getChildApp('child')).to.equal(child);
    expect(child).to.have.own.property('_parentApp', owner);

    expect(await owner.removeChildApp('child')).to.equal(child);
    expect(child.isDestroyed()).to.be.true;
    await owner.destroy();
  });

  it('clears child ownership before a destroy completion hook', async function() {
    const owner = new Application();
    const completionError = new Error('completion failed');
    let child;
    const ChildApplication = Application.extend({
      onDestroy() {
        expect(this).to.not.have.own.property('_parentApp');
        expect(this.getName()).to.be.undefined;
        expect(owner.hasChildApp('child')).to.be.false;
        throw completionError;
      }
    });
    child = new ChildApplication();
    owner.addChildApp('child', child);

    await expectRejection(child.destroy(), completionError);

    expect(child.isDestroyed()).to.be.true;
    expect(owner.hasChildApp('child')).to.be.false;
    expect(owner).to.not.have.own.property('_childApps');
    expect(await child.start()).to.be.false;
    expect(await child.stop()).to.be.true;
    expect(await child.restart()).to.be.false;

    await owner.destroy();
  });

  it('preserves remaining ownership when one child destroys directly', async function() {
    const owner = new Application();
    const first = new Application();
    const second = new Application();
    owner.addChildApp('first', first);
    owner.addChildApp('second', second);

    await first.destroy();

    expect(owner.getChildApps()).to.deep.equal({ second });
    expect(first).to.not.have.own.property('_parentApp');
    expect(second).to.have.own.property('_parentApp', owner);
    expect(second.getName()).to.equal('second');
    expect(owner).to.have.own.property('_childApps');

    await second.destroy();
    expect(owner.getChildApps()).to.deep.equal({});
    expect(owner).to.not.have.own.property('_childApps');

    await owner.destroy();
  });

  it('destroys integer-named children in registration order after parent readiness', async function() {
    const events = [];
    const parentReadiness = Promise.withResolvers();
    const firstReadiness = Promise.withResolvers();
    const firstStarted = Promise.withResolvers();
    const FirstChild = Application.extend({
      onBeforeDestroy() {
        events.push('first:before');
        firstStarted.resolve();
        return firstReadiness.promise;
      },
      onDestroy() {
        events.push('first:destroy');
      }
    });
    const SecondChild = Application.extend({
      onBeforeDestroy() {
        events.push('second:before');
      },
      onDestroy() {
        events.push('second:destroy');
      }
    });
    const ParentApplication = Application.extend({
      onBeforeDestroy() {
        events.push('parent:before');
        return parentReadiness.promise;
      },
      onDestroy() {
        events.push('parent:destroy');
      }
    });
    const parent = new ParentApplication();
    // Integer-like names must not reorder child teardown.
    parent.addChildApp('10', new FirstChild());
    parent.addChildApp('2', new SecondChild());

    const destroy = parent.destroy();
    expect(events).to.deep.equal(['parent:before']);
    expect(parent.getChildApps()).to.have.keys(['10', '2']);

    parentReadiness.resolve();
    await firstStarted.promise;
    expect(events).to.deep.equal(['parent:before', 'first:before']);

    firstReadiness.resolve();
    expect(await destroy).to.be.true;
    expect(events).to.deep.equal([
      'parent:before',
      'first:before',
      'first:destroy',
      'second:before',
      'second:destroy',
      'parent:destroy'
    ]);
    expect(parent.getChildApps()).to.deep.equal({});
  });

  it('retains a child whose destroy readiness fails and supports retry', async function() {
    const readinessError = new Error('not ready');
    let attempt = 0;
    const ChildApplication = Application.extend({
      onBeforeDestroy() {
        if (!attempt++) { throw readinessError; }
      }
    });
    const parent = new Application();
    const child = new ChildApplication();
    parent.addChildApp('child', child);

    await expectRejection(parent.destroy(), readinessError);

    expect(parent.isDestroyed()).to.be.false;
    expect(parent.isRunning()).to.be.false;
    expect(child.isDestroyed()).to.be.false;
    expect(parent.getChildApp('child')).to.equal(child);
    expect(child).to.have.own.property('_parentApp', parent);

    expect(await parent.destroy()).to.be.true;
    expect(parent.isDestroyed()).to.be.true;
    expect(child.isDestroyed()).to.be.true;
  });

  it('leaves children untouched when parent destroy readiness fails', async function() {
    const readinessError = new Error('parent not ready');
    const childBeforeDestroy = this.sinon.spy();
    let attempt = 0;
    const ParentApplication = Application.extend({
      onBeforeDestroy() {
        if (!attempt++) { throw readinessError; }
      }
    });
    const ChildApplication = Application.extend({
      onBeforeDestroy: childBeforeDestroy
    });
    const parent = new ParentApplication();
    const child = new ChildApplication();
    parent.addChildApp('child', child);

    await expectRejection(parent.destroy(), readinessError);

    expect(parent.isDestroyed()).to.be.false;
    expect(child.isDestroyed()).to.be.false;
    expect(parent.getChildApp('child')).to.equal(child);
    expect(child).to.have.own.property('_parentApp', parent);
    expect(childBeforeDestroy).to.not.have.been.called;

    expect(await parent.destroy()).to.be.true;
    expect(childBeforeDestroy).to.have.been.calledOnce;
  });

  it('retains the unfinished suffix after a partial child destroy failure', async function() {
    const readinessError = new Error('second not ready');
    const events = [];
    let secondAttempt = 0;
    const FirstApplication = Application.extend({
      onDestroy() { events.push('first'); }
    });
    const SecondApplication = Application.extend({
      onBeforeDestroy() {
        if (!secondAttempt++) { throw readinessError; }
      },
      onDestroy() { events.push('second'); }
    });
    const ThirdApplication = Application.extend({
      onDestroy() { events.push('third'); }
    });
    const parent = new Application();
    const first = new FirstApplication();
    const second = new SecondApplication();
    const third = new ThirdApplication();
    parent.addChildApp('first', first);
    parent.addChildApp('second', second);
    parent.addChildApp('third', third);

    await expectRejection(parent.destroy(), readinessError);

    expect(first.isDestroyed()).to.be.true;
    expect(second.isDestroyed()).to.be.false;
    expect(third.isDestroyed()).to.be.false;
    expect(parent.getChildApps()).to.deep.equal({ second, third });
    expect(events).to.deep.equal(['first']);

    expect(await parent.destroy()).to.be.true;
    expect(second.isDestroyed()).to.be.true;
    expect(third.isDestroyed()).to.be.true;
    expect(events).to.deep.equal(['first', 'second', 'third']);
  });
  it('returns registered child instances to the caller when construction fails', async function() {
    const failure = new Error('owner initialization failed');
    const first = new Application();
    const second = new Application();
    await first.start();
    const firstDestroy = this.sinon.spy(first, 'destroy');
    const secondDestroy = this.sinon.spy(second, 'destroy');
    let failedOwner;
    const Owner = Application.extend({
      initialize() {
        failedOwner = this;
        this.addChildApp('first', first);
        this.addChildApp('second', second);
        throw failure;
      }
    });
    const nextOwner = new Application();

    try {
      expect(() => new Owner()).to.throw(failure);
      expect(failedOwner.getChildApps()).to.deep.equal({});
      expect(first.getName()).to.be.undefined;
      expect(second.getName()).to.be.undefined;
      expect(first.isRunning()).to.be.true;
      expect(second.isRunning()).to.be.false;
      expect(firstDestroy).not.to.have.been.called;
      expect(secondDestroy).not.to.have.been.called;
      expect(nextOwner.addChildApp('first', first)).to.equal(first);
      expect(nextOwner.addChildApp('second', second)).to.equal(second);
    } finally {
      await failedOwner.destroy();
      await nextOwner.destroy();
    }
  });

});
