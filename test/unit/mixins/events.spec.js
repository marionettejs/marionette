import _ from 'underscore';
import EventsMixin from '../../../mixins/events';

describe('Events Mixin', function() {
  describe('#trigger with an object map', function() {
    let object;

    beforeEach(function() {
      object = _.extend({}, EventsMixin);
    });

    it('should invoke each handler with the mapped value as its argument', function() {
      const onA = this.sinon.stub();
      const onB = this.sinon.stub();
      object.on('a', onA);
      object.on('b', onB);

      object.trigger({ a: 1, b: 2 });

      expect(onA).to.have.been.calledOnce.and.calledWith(1);
      expect(onB).to.have.been.calledOnce.and.calledWith(2);
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
      const onA = this.sinon.stub();
      object.on('a', onA);

      object.trigger({ a: 'value' });

      expect(onA).to.have.been.calledOnce;
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
      const handler = this.sinon.stub();
      object.on('foo', handler);

      object.trigger('foo', 'arg');

      expect(handler).to.have.been.calledOnce.and.calledWith('arg');
    });

    it('should still split a space-separated string event', function() {
      const handler = this.sinon.stub();
      object.on('foo', handler);
      object.on('bar', handler);

      object.trigger('foo bar', 'arg');

      expect(handler).to.have.been.calledTwice;
      expect(handler).to.have.been.calledWith('arg');
    });

    it('dispatches only event names registered on the event store', function() {
      const inheritedHandler = this.sinon.stub();
      const inheritedAllHandler = this.sinon.stub();
      const ownHandler = this.sinon.stub();
      const inheritedEvents = {
        inherited: [{ callback: inheritedHandler, ctx: object }],
        all: [{ callback: inheritedAllHandler, ctx: object }],
      };
      object._rdEvents = Object.create(inheritedEvents);

      object.trigger('inherited');
      object.on('inherited', ownHandler);
      object.trigger('inherited', 'arg');

      expect(inheritedHandler).to.not.have.been.called;
      expect(inheritedAllHandler).to.not.have.been.called;
      expect(ownHandler).to.have.been.calledOnce.and.calledWith('arg');
      expect(Object.hasOwn(object._rdEvents, 'inherited')).to.equal(true);
    });

    ['constructor', 'toString', '__proto__', 'all'].forEach(name => {
      it(`supports ${name} across registration and cleanup APIs`, function() {
        const context = {};
        const directHandler = this.sinon.stub();
        const onceHandler = this.sinon.stub();
        const listeningHandler = this.sinon.stub();
        const listeningOnceHandler = this.sinon.stub();
        const listener = _.extend({}, EventsMixin);
        const onceListener = _.extend({}, EventsMixin);
        const directCallCount = name === 'all' ? 2 : 1;

        object.on(name, directHandler, context);
        object.trigger(name, 'direct');
        object.off(name, directHandler, context);
        object.trigger(name, 'removed');

        expect(directHandler).to.have.callCount(directCallCount);
        expect(directHandler).to.always.have.been.calledOn(context);

        if (name === 'all') {
          expect(directHandler.firstCall).to.have.been.calledWithExactly('direct');
          expect(directHandler.secondCall).to.have.been.calledWithExactly('all', 'direct');
        } else {
          expect(directHandler).to.have.been.calledWithExactly('direct');
        }

        object.once(name, onceHandler, context);
        object.trigger(name, 'once');
        object.trigger(name, 'later');

        expect(onceHandler).to.have.been.calledOnce.and.calledOn(context);

        listener.listenTo(object, name, listeningHandler);
        object.trigger(name, 'listening');
        listener.stopListening(object, name, listeningHandler);
        object.trigger(name, 'stopped');

        expect(listeningHandler).to.have.callCount(directCallCount);
        expect(listeningHandler).to.always.have.been.calledOn(listener);
        expect(listener._rdListeningTo).to.eql({});

        onceListener.listenToOnce(object, name, listeningOnceHandler);
        object.trigger(name, 'listening-once');
        object.trigger(name, 'later');

        expect(listeningOnceHandler).to.have.been.calledOnce.and.calledOn(onceListener);
        expect(onceListener._rdListeningTo).to.eql({});
        expect(object._rdListeners).to.eql({});
        expect(Object.getPrototypeOf(object._rdEvents)).to.equal(Object.prototype);
      });
    });

    it('snapshots all-event handlers before named-event dispatch', function() {
      const firstAllHandler = this.sinon.stub().callsFake(() => {
        object.off('all', secondAllHandler);
      });
      const secondAllHandler = this.sinon.stub();
      object.on('event', () => object.off('all', secondAllHandler));
      object.on('all', firstAllHandler);
      object.on('all', secondAllHandler);

      object.trigger('event', 'arg');

      expect(firstAllHandler).to.have.been.calledOnce.and.calledWith('event', 'arg');
      expect(secondAllHandler).to.have.been.calledOnce.and.calledWith('event', 'arg');
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
      const handler = this.sinon.stub();

      object.once('foo bar', handler);
      object.trigger('foo');
      object.trigger('foo');
      object.trigger('bar');
      object.trigger('bar');

      expect(handler).to.have.been.calledTwice;
    });

    it('supports listenToOnce cleanup', function() {
      const handler = this.sinon.stub();

      listener.listenToOnce(object, 'foo', handler);
      object.trigger('foo', 'bar');
      object.trigger('foo', 'baz');

      expect(handler).to.have.been.calledOnce.and.calledWith('bar');
      expect(listener._rdListeningTo).to.eql({});
    });

    it('removes all callbacks and listener references', function() {
      const handler = this.sinon.stub();

      listener.listenTo(object, 'foo', handler);
      object.off();
      object.trigger('foo');

      expect(handler).to.not.have.been.called;
      expect(listener._rdListeningTo).to.eql({});
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

      object.trigger('foo');

      expect(object._rdEvents).to.eql({});
    });

    it('ignores off calls for missing event names', function() {
      const handler = this.sinon.stub();

      object.on('foo', handler);
      object.off('bar');
      object.trigger('foo');

      expect(handler).to.have.been.calledOnce;
    });

    it('does not remove inherited event-store entries', function() {
      const consulted = this.sinon.stub();
      const inheritedHandler = {};
      Object.defineProperty(inheritedHandler, 'callback', {
        enumerable: true,
        get() {
          consulted();
          return _.noop;
        },
      });
      const inheritedEvents = { inherited: [inheritedHandler] };
      object._rdEvents = Object.create(inheritedEvents);

      object.off('inherited');

      expect(consulted).to.not.have.been.called;
      expect(Object.hasOwn(object._rdEvents, 'inherited')).to.equal(false);
      expect(object._rdEvents.inherited).to.equal(inheritedEvents.inherited);
    });

    it('stops listening safely when the listener entry or event store is gone', function() {
      const handler = this.sinon.stub();
      const other = _.extend({}, EventsMixin);

      listener.listenTo(object, 'foo', handler);
      listener.stopListening(other, 'foo', handler);
      delete object._rdEvents;
      listener.stopListening(object, 'foo', handler);

      expect(function() {
        object.trigger('foo');
      }).to.not.throw();
    });
  });
});
