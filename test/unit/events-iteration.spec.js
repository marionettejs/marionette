import { vi, describe, it, expect } from 'vitest';
import { Events as EventsMixin } from '@marionette/utils';

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

    it('snapshots own object-map keys before lazy values and ignores additions', function() {
      const emitter = createEmitter();
      const calls = [];
      const symbol = Symbol('ignored');
      const target = Object.assign(Object.create({ inherited: 'ignored' }), {
        first: 1,
        second: 2,
        [symbol]: 'ignored'
      });
      const map = new Proxy(target, {
        ownKeys(object) {
          calls.push('ownKeys');
          return Reflect.ownKeys(object);
        },
        getOwnPropertyDescriptor(object, key) {
          calls.push(`descriptor:${String(key)}`);
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
        get(object, key, receiver) {
          calls.push(`get:${String(key)}`);
          if (key === 'first') {
            delete object.second;
            object.added = 3;
          }
          return Reflect.get(object, key, receiver);
        }
      });
      emitter.on('first', value => calls.push(`first:${value}`));
      emitter.on('second', value => calls.push(`second:${value}`));
      emitter.on('added', value => calls.push(`added:${value}`));
      emitter.on('inherited', value => calls.push(`inherited:${value}`));

      emitter.trigger(map);

      expect(calls).to.deep.equal([
        'ownKeys',
        'descriptor:first',
        'descriptor:second',
        'get:first',
        'first:1',
        'get:second',
        'second:undefined'
      ]);
    });

    it('retains the Object.keys intrinsic captured at module load', function() {
      const emitter = createEmitter();
      const handler = vi.fn();
      const originalObjectKeys = Object.keys;
      emitter.on('event', handler);
      Object.keys = () => { throw new Error('patched Object.keys called'); };

      try {
        emitter.trigger({ event: 'value' });
      } finally {
        Object.keys = originalObjectKeys;
      }

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('value');
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
