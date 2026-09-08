import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import Application from '../../../src/modules/application';
import DestroyMixin from '../../../src/mixins/destroy';
import MnObject from '../../../src/modules/object';

describe('Destroy Mixin', function() {
  let obj;

  beforeEach(function() {
    obj = _.extend({
      triggerMethod: vi.fn(),
      stopListening: vi.fn()
    }, DestroyMixin);

    vi.spyOn(obj, 'destroy');
  });

  it('should not be destroyed by default', function() {
    expect(obj.isDestroyed()).to.be.false;
  });

  describe('when destroying', function() {
    beforeEach(function() {
      obj.destroy({ foo: 'bar' });
    });

    it('should be destroyed', function() {
      expect(obj.isDestroyed()).to.be.true;
    });

    it('should trigger destroy events', function() {
      expect(obj.triggerMethod).toHaveBeenCalledTimes(2);
      expect(obj.triggerMethod.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['before:destroy', obj, { foo: 'bar' }]);
      expect(obj.triggerMethod.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['destroy', obj, { foo: 'bar' }]);
    });

    it('should stopListening', function() {
      expect(obj.stopListening).toHaveBeenCalledTimes(1);
      expect(obj.stopListening).not.toHaveBeenCalledBefore(obj.triggerMethod);
    });

    it('should return the instance', function() {
      expect(obj.destroy).toHaveReturnedWith(obj);
    });
  });

  describe('when destroying a destroyed object', function() {
    beforeEach(function() {
      obj.destroy();
      obj.triggerMethod.mockClear();
      obj.destroy();
    });

    it('should not trigger any events', function() {
      expect(obj.triggerMethod).not.toHaveBeenCalled();
    });

    it('should return the instance', function() {
      expect(obj.destroy).toHaveReturnedWith(obj);
    });
  });

});

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
