import triggerMethod from '../../../modules/common/trigger-method';

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

  it('ignores truthy non-function handlers while still triggering the event', function() {
    target.onEventName = this.sinon.stub();
    target.options = { onEventName: {} };

    const result = target.triggerMethod('event:name', 'foo', 'bar');

    expect(target.onEventName).to.not.have.been.called;
    expect(target.trigger)
      .to.have.been.calledOnce
      .and.calledOn(target)
      .and.calledWith('event:name', 'foo', 'bar');
    expect(result).to.equal(undefined);
  });

  it('calls the matching method before triggering the event', function() {
    target.onEventName = this.sinon.stub();

    target.triggerMethod('event:name');

    expect(target.onEventName).to.have.been.calledBefore(target.trigger);
  });

  it('does not trigger the event when the matching method throws', function() {
    const error = new Error('event handler failed');
    target.onEventName = this.sinon.stub().throws(error);

    expect(() => target.triggerMethod('event:name')).to.throw(error);
    expect(target.trigger).to.not.have.been.called;
  });

  it('propagates trigger errors after calling the matching method', function() {
    const error = new Error('event listener failed');
    target.onEventName = this.sinon.stub();
    target.trigger.throws(error);

    expect(() => target.triggerMethod('event:name')).to.throw(error);
    expect(target.onEventName).to.have.been.calledBefore(target.trigger);
  });

  [
    ['constructor', 'onConstructor'],
    ['toString', 'onToString'],
    ['__proto__', 'on__proto__']
  ].forEach(([eventName, methodName]) => {
    it(`supports the ${eventName} event name across targets and repeated calls`, function() {
      const firstHandler = this.sinon.stub().returns('first result');
      const secondHandler = this.sinon.stub().returns('second result');
      const firstTarget = {
        trigger: this.sinon.stub(),
        triggerMethod,
        [methodName]: firstHandler
      };
      const secondTarget = {
        trigger: this.sinon.stub(),
        triggerMethod,
        [methodName]: secondHandler
      };

      expect(firstTarget.triggerMethod(eventName, 'first argument'))
        .to.equal('first result');
      expect(firstTarget.triggerMethod(eventName, 'second argument'))
        .to.equal('first result');
      expect(secondTarget.triggerMethod(eventName, 'third argument'))
        .to.equal('second result');

      expect(firstHandler)
        .to.have.been.calledTwice
        .and.calledOn(firstTarget);
      expect(firstHandler.firstCall).to.have.been.calledWith('first argument');
      expect(firstHandler.secondCall).to.have.been.calledWith('second argument');
      expect(secondHandler)
        .to.have.been.calledOnce
        .and.calledOn(secondTarget)
        .and.calledWith('third argument');
      expect(firstTarget.trigger)
        .to.have.been.calledTwice
        .and.calledOn(firstTarget);
      expect(firstTarget.trigger.firstCall)
        .to.have.been.calledWith(eventName, 'first argument');
      expect(firstTarget.trigger.secondCall)
        .to.have.been.calledWith(eventName, 'second argument');
      expect(secondTarget.trigger)
        .to.have.been.calledOnce
        .and.calledOn(secondTarget)
        .and.calledWith(eventName, 'third argument');
    });
  });
});
