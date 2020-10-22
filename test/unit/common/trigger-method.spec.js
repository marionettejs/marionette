import triggerMethod from '../../../src/common/trigger-method';

describe('triggerMethod', function() {
  let target;

  beforeEach(function() {
    target = {
      trigger: this.sinon.stub(),
      triggerMethod
    };

    this.sinon.spy(target, 'triggerMethod');
  });

  describe('when no onEventName method matcheds the event', function() {
    beforeEach(function() {
      target.triggerMethod('event:name', 'foo', 'bar');
    });

    it('should trigger all arguments', function() {
      expect(target.trigger)
        .to.have.been.calledOnce
        .and.calledOn(target)
        .and.calledWith('event:name', 'foo', 'bar');
    });

    it('should return undefined', function() {
      expect(target.triggerMethod).to.have.returned(undefined);
    });
  });

  describe('when an onEventName method on the target matches the event', function() {
    beforeEach(function() {
      target.onEventName = this.sinon.stub().returns('baz');
      target.triggerMethod('event:name', 'foo', 'bar');
    });

    it('should trigger all arguments', function() {
      expect(target.trigger)
        .to.have.been.calledOnce
        .and.calledOn(target)
        .and.calledWith('event:name', 'foo', 'bar');
    });

    it('should call onEventName methods on the target', function() {
      expect(target.onEventName)
        .to.have.been.calledOnce
        .and.calledWith('foo', 'bar');
    });

    it('should return baz', function() {
      expect(target.triggerMethod).to.have.returned('baz');
    });
  });

  describe('when an onEventName method on the target options matches the event', function() {
    beforeEach(function() {
      target.options = {
        onEventName: this.sinon.stub().returns('baz')
      };
      target.triggerMethod('event:name', 'foo', 'bar');
    });

    it('should trigger all arguments', function() {
      expect(target.trigger)
        .to.have.been.calledOnce
        .and.calledWith('event:name', 'foo', 'bar');
    });

    it('should call onEventName methods on the target', function() {
      expect(target.options.onEventName)
        .to.have.been.calledOnce
        .and.calledWith('foo', 'bar')
        .and.calledOn(target);
    });

    it('should return baz', function() {
      expect(target.triggerMethod).to.have.returned('baz');
    });
  });
});
