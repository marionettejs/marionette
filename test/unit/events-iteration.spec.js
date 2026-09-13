import { vi, describe, it, expect } from 'vitest';
import { Events as EventsMixin } from '@mnjs/utils';

function createEmitter() {
  return Object.assign({}, EventsMixin);
}

describe('Events owned iteration', function() {
  describe('#trigger', function() {
    it('snapshots handler-array length and lazily reads each index', function() {
      const emitter = createEmitter();
      const calls = [];
      const late = () => calls.push('late');

      emitter.on('event', () => {
        calls.push('first');
        emitter.on('event', late);
      });
      emitter.on('event', () => calls.push('second'));

      emitter.trigger('event');
      expect(calls).to.deep.equal(['first', 'second']);

      calls.length = 0;
      emitter.trigger('event');
      expect(calls).to.deep.equal(['first', 'second', 'late']);
    });

  });

  describe('interop ordering', function() {
    it('calls external on and off with documented arguments', function() {
      const calls = [];
      const callbacks = {};
      const listener = createEmitter();
      const target = createEmitter();
      const callback = function() {};
      target.on = function(name, receivedCallback, context) {
        calls.push(['on', this, ...arguments]);
        callbacks[name] = { callback: receivedCallback, context };

      };
      target.off = function(name, receivedCallback, context) {
        calls.push(['off', this, ...arguments]);
        expect(callbacks[name]).to.eql({
          callback: receivedCallback,
          context,
        });
        delete callbacks[name];

      };

      expect(listener.listenTo(target, 'event', callback)).to.equal(listener);

      expect(listener.stopListening(target, 'event', callback)).to.equal(listener);

      expect(callbacks).to.eql({});

      expect(calls).to.deep.equal([
        ['on', target, 'event', callback, listener],
        ['off', target, 'event', callback, listener]
      ]);
    });

    it('removes only the selected external event before final cleanup', function() {
      const listener = createEmitter();
      const target = { on: vi.fn(), off: vi.fn() };
      const callback = vi.fn();
      listener.listenTo(target, 'first second', callback);
      listener.stopListening(target, 'first', callback);
      expect(target.off).toHaveBeenCalledExactlyOnceWith('first', callback, listener);
      listener.stopListening(target, 'second', callback);
      expect(target.off).toHaveBeenCalledTimes(2);
      expect(target.off.mock.calls[1]).toEqual(['second', callback, listener]);
      listener.stopListening(target);
      expect(target.off).toHaveBeenCalledTimes(2);
    });
  });
});
