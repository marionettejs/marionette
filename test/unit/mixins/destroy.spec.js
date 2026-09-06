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
