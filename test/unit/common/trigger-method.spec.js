import { vi, describe, it, expect, beforeEach } from 'vitest';
import { triggerMethod } from '@mnjs/utils';

describe('triggerMethod', function() {
  let target;

  beforeEach(function() {
    target = {
      trigger: vi.fn(),
      triggerMethod
    };

    vi.spyOn(target, 'triggerMethod');
  });

  describe('when no onEventName method matcheds the event', function() {
    beforeEach(function() {
      target.triggerMethod('event:name', 'foo', 'bar');
    });

    it('should trigger all arguments', function() {
      expect(target.trigger).toHaveBeenCalledTimes(1);
      expect(target.trigger.mock.contexts).toContain(target);
      expect(target.trigger.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['event:name', 'foo', 'bar']);
    });

    it('should return undefined', function() {
      expect(target.triggerMethod).toHaveReturnedWith(undefined);
    });
  });

  describe('when an onEventName method on the target matches the event', function() {
    beforeEach(function() {
      target.onEventName = vi.fn().mockReturnValue('baz');
      target.triggerMethod('event:name', 'foo', 'bar');
    });

    it('should trigger all arguments', function() {
      expect(target.trigger).toHaveBeenCalledTimes(1);
      expect(target.trigger.mock.contexts).toContain(target);
      expect(target.trigger.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['event:name', 'foo', 'bar']);
    });

    it('should call onEventName methods on the target', function() {
      expect(target.onEventName).toHaveBeenCalledTimes(1);
      expect(target.onEventName.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
    });

    it('should return baz', function() {
      expect(target.triggerMethod).toHaveReturnedWith('baz');
    });
  });

  describe('when an onEventName method on the target options matches the event', function() {
    beforeEach(function() {
      target.options = {
        onEventName: vi.fn().mockReturnValue('baz')
      };
      target.triggerMethod('event:name', 'foo', 'bar');
    });

    it('should trigger all arguments', function() {
      expect(target.trigger).toHaveBeenCalledTimes(1);
      expect(target.trigger.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['event:name', 'foo', 'bar']);
    });

    it('should call onEventName methods on the target', function() {
      expect(target.options.onEventName).toHaveBeenCalledTimes(1);
      expect(target.options.onEventName.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
      expect(target.options.onEventName.mock.contexts).toContain(target);
    });

    it('should return baz', function() {
      expect(target.triggerMethod).toHaveReturnedWith('baz');
    });
  });

  it('ignores truthy non-function handlers while still triggering the event', function() {
    target.onEventName = vi.fn();
    target.options = { onEventName: {} };

    const result = target.triggerMethod('event:name', 'foo', 'bar');

    expect(target.onEventName).not.toHaveBeenCalled();
    expect(target.trigger).toHaveBeenCalledTimes(1);
    expect(target.trigger.mock.contexts).toContain(target);
    expect(target.trigger.mock.calls.map(args => args.slice(0, 3))).toContainEqual(['event:name', 'foo', 'bar']);
    expect(result).to.equal(undefined);
  });

  it('calls the matching method before triggering the event', function() {
    target.onEventName = vi.fn();

    target.triggerMethod('event:name');

    expect(target.onEventName).toHaveBeenCalledBefore(target.trigger);
  });

  it('does not trigger the event when the matching method throws', function() {
    const error = new Error('event handler failed');
    target.onEventName = vi.fn().mockImplementation(() => { throw error; });

    expect(() => target.triggerMethod('event:name')).to.throw(error);
    expect(target.trigger).not.toHaveBeenCalled();
  });

  it('propagates trigger errors after calling the matching method', function() {
    const error = new Error('event listener failed');
    target.onEventName = vi.fn();
    target.trigger.mockImplementation(() => { throw error; });

    expect(() => target.triggerMethod('event:name')).to.throw(error);
    expect(target.onEventName).toHaveBeenCalledBefore(target.trigger);
  });

  [
    ['constructor', 'onConstructor'],
    ['toString', 'onToString'],
    ['__proto__', 'on__proto__']
  ].forEach(([eventName, methodName]) => {
    it(`supports the ${eventName} event name across targets and repeated calls`, function() {
      const firstHandler = vi.fn().mockReturnValue('first result');
      const secondHandler = vi.fn().mockReturnValue('second result');
      const firstTarget = {
        trigger: vi.fn(),
        triggerMethod,
        [methodName]: firstHandler
      };
      const secondTarget = {
        trigger: vi.fn(),
        triggerMethod,
        [methodName]: secondHandler
      };

      expect(firstTarget.triggerMethod(eventName, 'first argument'))
        .to.equal('first result');
      expect(firstTarget.triggerMethod(eventName, 'second argument'))
        .to.equal('first result');
      expect(secondTarget.triggerMethod(eventName, 'third argument'))
        .to.equal('second result');

      expect(firstHandler).toHaveBeenCalledTimes(2);
      expect(firstHandler.mock.contexts).toContain(firstTarget);
      expect([firstHandler.mock.calls[0].slice(0, 1)]).toContainEqual(['first argument']);
      expect([firstHandler.mock.calls[1].slice(0, 1)]).toContainEqual(['second argument']);
      expect(secondHandler).toHaveBeenCalledTimes(1);
      expect(secondHandler.mock.contexts).toContain(secondTarget);
      expect(secondHandler.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['third argument']);
      expect(firstTarget.trigger).toHaveBeenCalledTimes(2);
      expect(firstTarget.trigger.mock.contexts).toContain(firstTarget);
      expect([firstTarget.trigger.mock.calls[0].slice(0, 2)]).toContainEqual([eventName, 'first argument']);
      expect([firstTarget.trigger.mock.calls[1].slice(0, 2)]).toContainEqual([eventName, 'second argument']);
      expect(secondTarget.trigger).toHaveBeenCalledTimes(1);
      expect(secondTarget.trigger.mock.contexts).toContain(secondTarget);
      expect(secondTarget.trigger.mock.calls.map(args => args.slice(0, 2))).toContainEqual([eventName, 'third argument']);
    });
  });
});
