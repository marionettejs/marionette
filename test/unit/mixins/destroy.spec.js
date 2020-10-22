import _ from 'underscore';
import DestroyMixin from '../../../src/mixins/destroy';

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
