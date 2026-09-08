import { vi, describe, it, expect } from 'vitest';
import { Application } from 'marionette';
import { MnObject } from 'marionette';

describe('Destroy Mixin public owners', function() {
  it('ignores reentrant and repeated MnObject destruction', function() {
    const instance = new MnObject();
    const options = { reason: 'test' };
    const states = [];
    let beforeDestroyReturn;
    let destroyReturn;
    const beforeDestroy = vi.fn(currentInstance => {
      states.push(currentInstance.isDestroyed());
      beforeDestroyReturn = currentInstance.destroy();
    });
    const destroy = vi.fn(currentInstance => {
      states.push(currentInstance.isDestroyed());
      destroyReturn = currentInstance.destroy();
    });
    vi.spyOn(instance, 'stopListening');
    instance.on('before:destroy', beforeDestroy);
    instance.on('destroy', destroy);

    expect(instance.destroy(options)).to.equal(instance);
    expect(instance.destroy()).to.equal(instance);
    expect(beforeDestroyReturn).to.equal(instance);
    expect(destroyReturn).to.equal(instance);
    expect(states).to.deep.equal([false, true]);
    expect(beforeDestroy).toHaveBeenCalledTimes(1);
    expect(beforeDestroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([instance, options]);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([instance, options]);
    expect(instance.stopListening).toHaveBeenCalledTimes(1);
  });

  it('shares reentrant and repeated Application destruction', async function() {
    const instance = new Application();
    const options = { reason: 'test' };
    const states = [];
    let beforeDestroyReturn;
    let destroyReturn;
    const beforeDestroy = vi.fn(currentInstance => {
      states.push(currentInstance.isDestroyed());
      beforeDestroyReturn = currentInstance.destroy();
    });
    const destroy = vi.fn(currentInstance => {
      states.push(currentInstance.isDestroyed());
      destroyReturn = currentInstance.destroy();
    });
    vi.spyOn(instance, 'stopListening');
    instance.on('before:destroy', beforeDestroy);
    instance.on('destroy', destroy);

    const first = instance.destroy(options);
    const repeated = instance.destroy();

    expect(repeated).to.equal(first);
    expect(beforeDestroyReturn).to.equal(first);
    expect(await first).to.be.true;
    expect(await destroyReturn).to.be.true;
    expect(states).to.deep.equal([false, true]);
    expect(beforeDestroy).toHaveBeenCalledTimes(1);
    expect(beforeDestroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([instance, options]);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([instance, options]);
    expect(instance.stopListening).toHaveBeenCalledTimes(1);
  });
});
