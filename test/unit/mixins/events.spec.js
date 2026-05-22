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
  });
});
