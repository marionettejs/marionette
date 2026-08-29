import _ from 'underscore';
import Application from '../../../modules/application';
import DestroyMixin from '../../../mixins/destroy';
import MnObject from '../../../modules/object';

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

  it('does not restart destruction after before:destroy throws', function() {
    const error = new Error('before:destroy failed');
    obj.triggerMethod.callsFake(eventName => {
      if (eventName === 'before:destroy') { throw error; }
    });

    expect(() => obj.destroy()).to.throw(error);
    expect(obj.isDestroyed()).to.be.false;
    expect(obj.destroy()).to.equal(obj);
    expect(obj.triggerMethod).to.have.been.calledOnceWith('before:destroy', obj, undefined);
    expect(obj.stopListening).to.not.have.been.called;
  });
});

describe('Destroy Mixin public owners', function() {
  for (const [name, Type] of [['MnObject', MnObject], ['Application', Application]]) {
    it(`ignores reentrant and repeated ${name} destruction`, function() {
      const instance = new Type();
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
  }
});
