import _ from 'underscore';
import Application from '../../../src/modules/application';
import DestroyMixin from '../../../src/mixins/destroy';
import MnObject from '../../../src/modules/object';

describe('Destroy Mixin', function() {
  let obj;

  beforeEach(function() {
    obj = _.extend({
      triggerMethod: this.sinon.stub(),
      stopListening: this.sinon.stub()
    }, DestroyMixin);

    this.sinon.spy(obj, 'destroy');
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
      expect(obj.triggerMethod)
        .to.have.been.calledTwice
        .and.calledWith('before:destroy', obj, { foo: 'bar' })
        .and.calledWith('destroy', obj, { foo: 'bar' });
    });

    it('should stopListening', function() {
      expect(obj.stopListening)
        .to.have.been.calledOnce
        .and.not.calledBefore(obj.triggerMethod);
    });

    it('should return the instance', function() {
      expect(obj.destroy).to.have.returned(obj);
    });
  });

  describe('when destroying a destroyed object', function() {
    beforeEach(function() {
      obj.destroy();
      obj.triggerMethod.reset();
      obj.destroy();
    });

    it('should not trigger any events', function() {
      expect(obj.triggerMethod).to.not.have.been.called;
    });

    it('should return the instance', function() {
      expect(obj.destroy).to.have.returned(obj);
    });
  });

  it('retries destruction after before:destroy throws', function() {
    const error = new Error('before:destroy failed');
    const firstOptions = { attempt: 1 };
    const retryOptions = { attempt: 2 };
    const lifecycle = [];
    let beforeDestroySideEffects = 0;
    obj.triggerMethod.callsFake((eventName, currentObject, options) => {
      lifecycle.push([eventName, options]);
      if (eventName === 'before:destroy' && ++beforeDestroySideEffects === 1) {
        throw error;
      }
    });

    expect(() => obj.destroy(firstOptions)).to.throw(error);
    expect(obj.isDestroyed()).to.be.false;
    expect(obj.stopListening).to.not.have.been.called;

    expect(obj.destroy(retryOptions)).to.equal(obj);
    expect(obj.destroy()).to.equal(obj);
    expect(obj.isDestroyed()).to.be.true;
    expect(beforeDestroySideEffects).to.equal(2);
    expect(lifecycle).to.deep.equal([
      ['before:destroy', firstOptions],
      ['before:destroy', retryOptions],
      ['destroy', retryOptions],
    ]);
    expect(obj.stopListening).to.have.been.calledOnce;
  });
});

describe('Destroy Mixin public owners', function() {
  it('ignores reentrant and repeated MnObject destruction', function() {
    const instance = new MnObject();
    const options = { reason: 'test' };
    const states = [];
    let beforeDestroyReturn;
    let destroyReturn;
    const beforeDestroy = this.sinon.spy(currentInstance => {
      states.push(currentInstance.isDestroyed());
      beforeDestroyReturn = currentInstance.destroy();
    });
    const destroy = this.sinon.spy(currentInstance => {
      states.push(currentInstance.isDestroyed());
      destroyReturn = currentInstance.destroy();
    });
    this.sinon.spy(instance, 'stopListening');
    instance.on('before:destroy', beforeDestroy);
    instance.on('destroy', destroy);

    expect(instance.destroy(options)).to.equal(instance);
    expect(instance.destroy()).to.equal(instance);
    expect(beforeDestroyReturn).to.equal(instance);
    expect(destroyReturn).to.equal(instance);
    expect(states).to.deep.equal([false, true]);
    expect(beforeDestroy).to.have.been.calledOnceWith(instance, options);
    expect(destroy).to.have.been.calledOnceWith(instance, options);
    expect(instance.stopListening).to.have.been.calledOnce;
  });

  it('shares reentrant and repeated Application destruction', async function() {
    const instance = new Application();
    const options = { reason: 'test' };
    const states = [];
    let beforeDestroyReturn;
    let destroyReturn;
    const beforeDestroy = this.sinon.spy(currentInstance => {
      states.push(currentInstance.isDestroyed());
      beforeDestroyReturn = currentInstance.destroy();
    });
    const destroy = this.sinon.spy(currentInstance => {
      states.push(currentInstance.isDestroyed());
      destroyReturn = currentInstance.destroy();
    });
    this.sinon.spy(instance, 'stopListening');
    instance.on('before:destroy', beforeDestroy);
    instance.on('destroy', destroy);

    const first = instance.destroy(options);
    const repeated = instance.destroy();

    expect(repeated).to.equal(first);
    expect(beforeDestroyReturn).to.equal(first);
    expect(await first).to.be.true;
    expect(await destroyReturn).to.be.true;
    expect(states).to.deep.equal([false, true]);
    expect(beforeDestroy).to.have.been.calledOnceWith(instance, options);
    expect(destroy).to.have.been.calledOnceWith(instance, options);
    expect(instance.stopListening).to.have.been.calledOnce;
  });
});
