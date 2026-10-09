import { describe, it, expect } from 'vitest';
'use strict';

import { Application, MarionetteError } from 'marionette';

describe('Application ownership', function() {
  it('keeps separate root Applications free of child storage', async function() {
    const first = new Application();
    const second = new Application();

    expect(first.getName()).toBeUndefined();
    expect(first.getChildApps()).to.deep.equal({});
    expect(first.getName()).toBeUndefined();
    expect(first.getChildApps()).to.deep.equal({});

    expect(second.getChildApps()).to.deep.equal({});
    expect(second.getName()).toBeUndefined();

    await first.destroy();
    await second.destroy();
  });

  it('registers nested Applications for owner-side lookup', async function() {
    const root = new Application();
    const child = new Application();
    const grandchild = new Application();

    expect(root.addChildApp('child', child)).to.equal(child);
    expect(child.addChildApp('grandchild', grandchild)).to.equal(grandchild);

    expect(root.hasChildApp('child')).toBe(true);
    expect(root.getChildApp('child')).to.equal(child);
    expect(root.getChildApps()).to.deep.equal({ child });
    expect(root.getChildApp(child.getName())).to.equal(child);
    expect(child.getName()).to.equal('child');
    expect(child.getChildApp('grandchild')).to.equal(grandchild);
    expect(child.getChildApp(grandchild.getName())).to.equal(grandchild);
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
    expect(owner.getChildApp(child.getName())).to.equal(child);
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

    expect(constructed).toBe(false);
    await owner.destroy();
  });

  it('removes and destroys an owned child', async function() {
    const owner = new Application();
    const child = new Application();
    owner.addChildApp('child', child);

    expect(await owner.removeChildApp('missing')).toBeUndefined();
    expect(await owner.removeChildApp('child', { source: 'owner' })).to.equal(child);
    expect(child.isDestroyed()).toBe(true);
    expect(child.getName()).toBeUndefined();
    expect(child.getName()).toBeUndefined();
    expect(owner.hasChildApp('child')).toBe(false);
    expect(owner.getChildApps()).to.deep.equal({});

    await owner.destroy();
  });

  it('clears child ownership before a destroy completion hook', async function() {
    const owner = new Application();
    const completionError = new Error('completion failed');
    let child;
    const ChildApplication = Application.extend({
      onDestroy() {
        expect(this.getName()).toBeUndefined();
        expect(this.getName()).toBeUndefined();
        expect(owner.hasChildApp('child')).toBe(false);
        throw completionError;
      }
    });
    child = new ChildApplication();
    owner.addChildApp('child', child);

    expect(() => child.destroy()).toThrow(completionError);

    expect(child.isDestroyed()).toBe(true);
    expect(owner.hasChildApp('child')).toBe(false);
    expect(owner.getChildApps()).to.deep.equal({});
    expect(await child.start()).toBe(false);
    expect(await child.stop()).toBe(true);
    expect(await child.restart()).toBe(false);

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
    expect(first.getName()).toBeUndefined();
    expect(owner.getChildApp(second.getName())).to.equal(second);
    expect(second.getName()).to.equal('second');
    expect(Object.keys(owner.getChildApps()).length).to.be.greaterThan(0);

    await second.destroy();
    expect(owner.getChildApps()).to.deep.equal({});
    expect(owner.getChildApps()).to.deep.equal({});

    await owner.destroy();
  });

});
