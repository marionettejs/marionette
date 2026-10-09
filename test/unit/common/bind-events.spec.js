import { vi, describe, it, expect, beforeEach } from 'vitest';
import { bindEvents, unbindEvents } from '@mnjs/utils';

function createProtoBindings(descriptor) {
  const bindings = {};
  Object.defineProperty(bindings, '__proto__', {
    enumerable: true,
    ...descriptor
  });
  return bindings;
}

const acceptedBindingMaps = [
  {},
  [],
  function() {},
  async function() {},
  function*() {},
  class {},
  new Boolean(false),
  new Number(0),
  new String(''),
  new Proxy({}, {})
];

const falsyBindingMaps = [undefined, null, false, 0, 0n, '', NaN];

describe('bind-events', function() {
  let entity;
  let target;

  beforeEach(function() {
    entity = vi.fn();

    target = {
      handleFoo: vi.fn(),
      listenTo: vi.fn(),
      stopListening: vi.fn(),
      bindEvents,
      unbindEvents
    };

    vi.spyOn(target, 'bindEvents');
    vi.spyOn(target, 'unbindEvents');
  });

  describe('bindEvents', function() {
    describe('when entity isnt passed', function() {
      beforeEach(function() {
        target.bindEvents(false, { 'foo': 'handleFoo' });
      });

      it('shouldnt bind any events', function() {
        expect(target.listenTo).not.toHaveBeenCalled();
      });

      it('should return the target', function() {
        expect(target.bindEvents).toHaveReturnedWith(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.bindEvents(entity, null);
      });

      it('shouldnt bind any events', function() {
        expect(target.listenTo).not.toHaveBeenCalled();
      });

      it('should return the target', function() {
        expect(target.bindEvents).toHaveReturnedWith(target);
      });
    });

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.bindEvents(entity, bindings)).to.equal(target);
        expect(target.listenTo).toHaveBeenCalledTimes(1);
        target.listenTo.mockClear();
      }
    });

    it('preserves the falsy binding-map early return', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.bindEvents(entity, bindings)).to.equal(target);
      }

      expect(target.listenTo).not.toHaveBeenCalled();
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.bindEvents(entity, { 'foo': 'handleFoo' });
        expect(target.bindEvents).toHaveReturnedWith(target);
      });

      describe('when handler is a function', function() {
        it('should bind an event to targets handler', function() {
          const handleBar = vi.fn();
          target.bindEvents(entity, { 'bar': handleBar });
          expect(target.listenTo).toHaveBeenCalledTimes(1);
          expect(target.listenTo.mock.calls.map(args => args.slice(0, 2))).toContainEqual([entity, { 'bar': handleBar }]);
        });
      });

      describe('when handler is a string', function() {
        it('should bind an event to targets handler', function() {
          target.bindEvents(entity, { 'foo': 'handleFoo' });
          expect(target.listenTo).toHaveBeenCalledTimes(1);
          expect(target.listenTo.mock.calls.map(args => args.slice(0, 2))).toContainEqual([entity, { 'foo': target.handleFoo }]);
        });
      });

      it('accepts other Object prototype collision names', function() {
        const constructorHandler = vi.fn();
        const toStringHandler = vi.fn();

        target.bindEvents(entity, {
          constructor: constructorHandler,
          toString: toStringHandler
        });

        expect(target.listenTo).toHaveBeenCalledTimes(1);
        expect(target.listenTo.mock.calls.map(args => args.slice(0, 2))).toContainEqual([entity, {
          constructor: constructorHandler,
          toString: toStringHandler
        }]);
      });

      it('rejects an own enumerable __proto__ event before binding', function() {
        const getter = vi.fn().mockImplementation(() => { throw new Error('must not run'); });
        const bindings = createProtoBindings({ get: getter });

        expect(() => target.bindEvents(entity, bindings))
          .to.throw('Entity event maps cannot include an own "__proto__" event name.')
          .with.property('code', 'MN0026');
        expect(getter).not.toHaveBeenCalled();
        expect(target.listenTo).not.toHaveBeenCalled();
      });
    });

  });

  describe('unbindEvents', function() {
    describe('when entity isnt passed', function() {
      beforeEach(function() {
        target.unbindEvents(false, { 'foo': 'handleFoo' });
      });

      it('shouldnt unbind any events', function() {
        expect(target.stopListening).not.toHaveBeenCalled();
      });

      it('should return the target', function() {
        expect(target.unbindEvents).toHaveReturnedWith(target);
      });
    });

    describe('when bindings isnt passed', function() {
      beforeEach(function() {
        target.unbindEvents(entity, null);
      });

      it('should unbind all events', function() {
        expect(target.stopListening).toHaveBeenCalledTimes(1);
        expect(target.stopListening.mock.calls.map(args => args.slice(0, 1))).toContainEqual([entity]);
      });

      it('should return the target', function() {
        expect(target.unbindEvents).toHaveReturnedWith(target);
      });
    });

    it('preserves accepted object and function binding maps', function() {
      for (const bindings of acceptedBindingMaps) {
        expect(target.unbindEvents(entity, bindings)).to.equal(target);
        expect(target.stopListening).toHaveBeenCalledTimes(1);
        target.stopListening.mockClear();
      }
    });

    it('preserves the falsy binding-map unbind-all path', function() {
      for (const bindings of falsyBindingMaps) {
        expect(target.unbindEvents(entity, bindings)).to.equal(target);
        expect(target.stopListening).toHaveBeenCalledTimes(1);
        expect(target.stopListening.mock.calls.map(args => args.slice(0, 1))).toContainEqual([entity]);
        target.stopListening.mockClear();
      }
    });

    describe('when bindings is an object with an event handler hash', function() {
      it('should return the target', function() {
        target.unbindEvents(entity, { 'foo': 'handleFoo' })
        expect(target.unbindEvents).toHaveReturnedWith(target);
      });

      describe('when handler is a function', function() {
        it('should unbind an event', function() {
          const handleBar = vi.fn();
          target.unbindEvents(entity, { 'bar': handleBar });
          expect(target.stopListening).toHaveBeenCalledTimes(1);
          expect(target.stopListening.mock.calls.map(args => args.slice(0, 2))).toContainEqual([entity, { 'bar': handleBar }]);
        });
      });

      describe('when handler is a string', function() {
        describe('when one handler is passed', function() {
          it('should unbind an event', function() {
            target.unbindEvents(entity, { 'foo': 'handleFoo' });
            expect(target.stopListening).toHaveBeenCalledTimes(1);
            expect(target.stopListening.mock.calls.map(args => args.slice(0, 2))).toContainEqual([entity, { 'foo': target.handleFoo }]);
          });
        });
      });

      it('rejects an own enumerable __proto__ event before selective unbinding', function() {
        const bindings = createProtoBindings({ value: vi.fn() });

        expect(() => target.unbindEvents(entity, bindings))
          .to.throw('Entity event maps cannot include an own "__proto__" event name.')
          .with.property('code', 'MN0026');
        expect(target.stopListening).not.toHaveBeenCalled();
      });
    });

  });
});
