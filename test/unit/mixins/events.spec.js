import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import { Events as EventsMixin } from '@mnjs/utils';

describe('Events Mixin', function() {
  describe('#trigger with an object map', function() {
    let object;

    beforeEach(function() {
      object = _.extend({}, EventsMixin);
    });

    it('should invoke each handler with the mapped value as its argument', function() {
      const onA = vi.fn();
      const onB = vi.fn();
      object.on('a', onA);
      object.on('b', onB);

      object.trigger({ a: 1, b: 2 });

      expect(onA).toHaveBeenCalledTimes(1);
      expect(onA.mock.calls.map(args => args.slice(0, 1))).toContainEqual([1]);
      expect(onB).toHaveBeenCalledTimes(1);
      expect(onB.mock.calls.map(args => args.slice(0, 1))).toContainEqual([2]);
    });

    it('should not throw when triggering with an object map', function() {
      object.on('a', _.noop);
      object.on('b', _.noop);

      // Before the fix this fell through into the eventSplitter branch and
      // called `name.split(...)` on the object map, throwing a TypeError.
      expect(function() {
        object.trigger({ a: 1, b: 2 });
      }).to.not.throw();
    });

    it('should not fall through to the eventSplitter branch for object input', function() {
      // If the object-form branch fell through, triggerApi would be called a
      // second time with the object literal as the event name. Spying on
      // `keys(name)` is messy, so we instead assert each per-key handler is
      // invoked exactly once (a fall-through would re-dispatch nothing useful
      // but exercises the broken split path).
      const onA = vi.fn();
      object.on('a', onA);

      object.trigger({ a: 'value' });

      expect(onA).toHaveBeenCalledTimes(1);
    });

    it('should return the receiver so calls can be chained', function() {
      object.on('a', _.noop);

      const result = object.trigger({ a: 1 });

      expect(result).to.equal(object);
    });
  });

  describe('#trigger with a string event name', function() {
    let object;

    beforeEach(function() {
      object = _.extend({}, EventsMixin);
    });

    it('should still dispatch a single-name string event', function() {
      const handler = vi.fn();
      object.on('foo', handler);

      object.trigger('foo', 'arg');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['arg']);
    });

    it('should still split a space-separated string event', function() {
      const handler = vi.fn();
      object.on('foo', handler);
      object.on('bar', handler);

      object.trigger('foo bar', 'arg');

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['arg']);
    });

    ['constructor', 'toString', '__proto__', 'all'].forEach(name => {
      it(`supports ${name} across registration and cleanup APIs`, function() {
        const context = {};
        const directHandler = vi.fn();
        const onceHandler = vi.fn();
        const listeningHandler = vi.fn();
        const listeningOnceHandler = vi.fn();
        const listener = _.extend({}, EventsMixin);
        const onceListener = _.extend({}, EventsMixin);
        const directCallCount = name === 'all' ? 2 : 1;

        object.on(name, directHandler, context);
        object.trigger(name, 'direct');
        object.off(name, directHandler, context);
        object.trigger(name, 'removed');

        expect(directHandler).toHaveBeenCalledTimes(directCallCount);
        expect(directHandler.mock.contexts).toEqual(Array(directHandler.mock.calls.length).fill(context));

        if (name === 'all') {
          expect(directHandler.mock.calls.at(0)).toEqual(['direct']);
          expect(directHandler.mock.calls.at(1)).toEqual(['all', 'direct']);
        } else {
          expect(directHandler).toHaveBeenCalledWith('direct');
        }

        object.once(name, onceHandler, context);
        object.trigger(name, 'once');
        object.trigger(name, 'later');

        expect(onceHandler).toHaveBeenCalledTimes(1);
        expect(onceHandler.mock.contexts).toContain(context);

        listener.listenTo(object, name, listeningHandler);
        object.trigger(name, 'listening');
        listener.stopListening(object, name, listeningHandler);
        object.trigger(name, 'stopped');

        expect(listeningHandler).toHaveBeenCalledTimes(directCallCount);
        expect(listeningHandler.mock.contexts).toEqual(Array(listeningHandler.mock.calls.length).fill(listener));

        onceListener.listenToOnce(object, name, listeningOnceHandler);
        object.trigger(name, 'listening-once');
        object.trigger(name, 'later');

        expect(listeningOnceHandler).toHaveBeenCalledTimes(1);
        expect(listeningOnceHandler.mock.contexts).toContain(onceListener);

      });
    });

    it('snapshots all-event handlers before named-event dispatch', function() {
      const firstAllHandler = vi.fn().mockImplementation(() => {
        object.off('all', secondAllHandler);
      });
      const secondAllHandler = vi.fn();
      object.on('event', () => object.off('all', secondAllHandler));
      object.on('all', firstAllHandler);
      object.on('all', secondAllHandler);

      object.trigger('event', 'arg');

      expect(firstAllHandler).toHaveBeenCalledTimes(1);
      expect(firstAllHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['event', 'arg']);
      expect(secondAllHandler).toHaveBeenCalledTimes(1);
      expect(secondAllHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['event', 'arg']);
    });
  });

  describe('once and listener cleanup', function() {
    let listener;
    let object;

    beforeEach(function() {
      listener = _.extend({}, EventsMixin);
      object = _.extend({}, EventsMixin);
    });

    it('fires once handlers once per event name', function() {
      const handler = vi.fn();

      object.once('foo bar', handler);
      object.trigger('foo');
      object.trigger('foo');
      object.trigger('bar');
      object.trigger('bar');

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('collapses repeated once event names to one registration', function() {
      const handler = vi.fn();

      object.once('foo foo', handler);
      object.trigger('foo');
      object.trigger('foo');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('collapses repeated listenToOnce event names to one registration', function() {
      const handler = vi.fn();

      listener.listenToOnce(object, 'foo foo', handler);
      object.trigger('foo');
      object.trigger('foo');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('preserves falsy once contexts without using the handler as context', function() {
      [false, 0, ''].forEach(context => {
        const emitter = _.extend({}, EventsMixin);
        const registrations = [];
        const handler = vi.fn();
        const baseOn = EventsMixin.on;
        emitter.on = function(...args) {
          registrations.push(args);
          return baseOn.apply(this, args);
        };

        emitter.once('foo', handler, context);
        emitter.trigger('foo');
        emitter.trigger('foo');

        expect(registrations[0][2]).to.equal(context);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.contexts).toContain(emitter);
      });
    });

    it('dispatches once registration through an overridden on method', function() {
      const registrations = [];
      const handler = vi.fn();
      const baseOn = EventsMixin.on;
      object.on = function(...args) {
        registrations.push(args);
        return baseOn.apply(this, args);
      };

      object.once('foo', handler);

      expect(registrations).to.have.lengthOf(1);
      expect(registrations[0][0]).to.have.own.property('foo')
        .that.is.a('function');
      object.trigger('foo');
      object.trigger('foo');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('preserves object-form once context through the on override', function() {
      const context = {};
      const handler = vi.fn();
      const baseOn = EventsMixin.on;
      object.on = function(...args) {
        expect(args[1]).to.equal(context);
        return baseOn.apply(this, args);
      };

      object.once({ foo: handler }, context);
      object.trigger('foo');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.contexts).toContain(context);
    });

    it('supports Toolkit-shaped cleanup of running once registrations', function() {
      const runningEvents = [];
      const handler = vi.fn();
      const baseOn = EventsMixin.on;
      object.on = function(...args) {
        runningEvents.push(args);
        return baseOn.apply(this, args);
      };

      object.once('foo', handler);
      runningEvents.forEach(args => object.off(...args));
      object.trigger('foo');

      expect(handler).not.toHaveBeenCalled();
    });

    it('dispatches listenToOnce registration through overridden listenTo', function() {
      const registrations = [];
      const handler = vi.fn();
      const baseListenTo = EventsMixin.listenTo;
      listener.listenTo = function(...args) {
        registrations.push(args);
        return baseListenTo.apply(this, args);
      };

      listener.listenToOnce(object, 'foo', handler);

      expect(registrations).to.have.lengthOf(1);
      expect(registrations[0][0]).to.equal(object);
      expect(registrations[0][1]).to.have.own.property('foo')
        .that.is.a('function');
      object.trigger('foo');
      object.trigger('foo');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('registers a listenTo handler through a three-argument delegating on override', function() {
      const handler = vi.fn();
      const baseOn = EventsMixin.on;
      object.on = function(name, callback, context) {
        return baseOn.call(this, name, callback, context);
      };

      listener.listenTo(object, 'foo', handler);
      object.trigger('foo');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('respects a non-delegating on override on a Marionette emitter', function() {
      const handler = vi.fn();
      object.on = function() {
        return this;
      };

      listener.listenTo(object, 'foo', handler);
      object.trigger('foo');

      expect(handler).not.toHaveBeenCalled();
    });

    it('supports listenToOnce cleanup', function() {
      const handler = vi.fn();

      listener.listenToOnce(object, 'foo', handler);
      object.trigger('foo', 'bar');
      object.trigger('foo', 'baz');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['bar']);

    });

    it('removes all callbacks and listener references', function() {
      const handler = vi.fn();

      listener.listenTo(object, 'foo', handler);
      object.off();
      object.trigger('foo');

      expect(handler).not.toHaveBeenCalled();

    });

    it('returns the receiver when listenTo gets no object', function() {
      expect(listener.listenTo(null, 'foo', _.noop)).to.equal(listener);
      expect(listener.listenToOnce(null, 'foo', _.noop)).to.equal(listener);
    });

    it('ignores missing callbacks in registration helpers', function() {
      object.on('foo');
      object.once('foo');
      listener.listenTo(object, 'foo');
      listener.listenToOnce(object, 'foo');

      const handler = vi.fn();
      object.on('foo', handler);
      object.trigger('foo');
      expect(handler).toHaveBeenCalledExactlyOnceWith();
    });

    it('ignores off calls for missing event names', function() {
      const handler = vi.fn();

      object.on('foo', handler);
      object.off('bar');
      object.trigger('foo');

      expect(handler).toHaveBeenCalledTimes(1);
    });

  });

  describe('legacy Backbone.Events aliases', function() {
    it('does not expose bind or unbind', function() {
      expect(EventsMixin.bind).toBeUndefined();
      expect(EventsMixin.unbind).toBeUndefined();
    });
  });
});
