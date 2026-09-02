import EventsMixin from '../../mixins/events';

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

    it('processes sparse handler slots and stops before later handlers', function() {
      const emitter = createEmitter();
      const later = this.sinon.stub();
      const handlers = new Array(2);
      handlers[1] = { callback: later, ctx: emitter };
      emitter._rdEvents = { event: handlers };

      expect(() => emitter.trigger('event')).to.throw(TypeError);
      expect(later).to.not.have.been.called;
    });

    it('captures handler-array length once before lazy proxy index reads', function() {
      const emitter = createEmitter();
      const calls = [];
      const error = new Error('handler failed');
      const target = [
        { callback() { calls.push('first'); }, ctx: emitter },
        { callback() { calls.push('second'); throw error; }, ctx: emitter },
        { callback() { calls.push('third'); }, ctx: emitter }
      ];
      const handlers = new Proxy(target, {
        get(array, key, receiver) {
          if (key === 'length' || /^\d+$/.test(key)) { calls.push(`get:${key}`); }
          return Reflect.get(array, key, receiver);
        }
      });
      emitter._rdEvents = { event: handlers };

      expect(() => emitter.trigger('event')).to.throw(error);
      expect(calls).to.deep.equal([
        'get:length',
        'get:0',
        'first',
        'get:1',
        'second'
      ]);
    });

    it('does not reinterpret a replaced handler collection as an object map', function() {
      const emitter = createEmitter();
      const handler = this.sinon.stub();
      emitter._rdEvents = {
        event: {
          named: { callback: handler, ctx: emitter }
        }
      };

      emitter.trigger('event');

      expect(handler).to.not.have.been.called;
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
      const handler = this.sinon.stub();
      const originalObjectKeys = Object.keys;
      emitter.on('event', handler);
      Object.keys = () => { throw new Error('patched Object.keys called'); };

      try {
        emitter.trigger({ event: 'value' });
      } finally {
        Object.keys = originalObjectKeys;
      }

      expect(handler).to.have.been.calledOnce.and.calledWithExactly('value');
    });
  });

  describe('#off', function() {
    it('snapshots listener keys and lazily observes cleanup mutations', function() {
      const emitter = createEmitter();
      const calls = [];
      const listenerTarget = {};
      let listenerRegistry;
      const added = {
        obj: emitter,
        listeneeId: 'emitter',
        listenerId: 'added',
        listeningTo: {}
      };
      const firstListeningTo = new Proxy({ emitter: true }, {
        deleteProperty(target, key) {
          calls.push(`delete:listeningTo:${key}`);
          delete listenerTarget.second;
          listenerTarget.added = added;
          return Reflect.deleteProperty(target, key);
        }
      });
      listenerTarget.first = {
        obj: emitter,
        listeneeId: 'emitter',
        listenerId: 'first',
        listeningTo: firstListeningTo
      };
      listenerTarget.second = {
        obj: emitter,
        listeneeId: 'emitter',
        listenerId: 'second',
        listeningTo: { emitter: true }
      };
      listenerRegistry = new Proxy(listenerTarget, {
        ownKeys(target) {
          calls.push('ownKeys');
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, key) {
          calls.push(`descriptor:${key}`);
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        get(target, key, receiver) {
          calls.push(`get:${key}`);
          return Reflect.get(target, key, receiver);
        },
        deleteProperty(target, key) {
          calls.push(`delete:listeners:${key}`);
          return Reflect.deleteProperty(target, key);
        }
      });
      emitter._rdEvents = { event: [] };
      emitter._rdListeners = listenerRegistry;

      expect(() => emitter.off()).to.throw(TypeError);
      expect(calls).to.deep.equal([
        'ownKeys',
        'descriptor:first',
        'descriptor:second',
        'get:first',
        'delete:listeningTo:emitter',
        'delete:listeners:first',
        'get:second'
      ]);
      expect(emitter._rdEvents).to.be.undefined;
      expect(Object.keys(listenerTarget)).to.deep.equal(['added']);
    });

    it('processes sparse handler slots instead of skipping them', function() {
      const emitter = createEmitter();
      const laterCallbackRead = this.sinon.stub();
      const later = {};
      Object.defineProperty(later, 'callback', {
        get() {
          laterCallbackRead();
          return function() {};
        }
      });
      const handlers = new Array(2);
      handlers[1] = later;
      emitter._rdEvents = { event: handlers };

      expect(() => emitter.off('event', function() {})).to.throw(TypeError);
      expect(laterCallbackRead).to.not.have.been.called;
      expect(emitter._rdEvents.event).to.equal(handlers);
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
        expect(this).to.not.have.own.property('_rdEvents');
        expect(this).to.not.have.own.property('_rdListeners');
        expect(listener._rdListeningTo).to.have.all.keys(this._rdListenId);
      };
      target.off = function(name, receivedCallback, context) {
        calls.push(['off', this, ...arguments]);
        expect(callbacks[name]).to.eql({
          callback: receivedCallback,
          context,
        });
        delete callbacks[name];
        expect(this).to.not.have.own.property('_rdEvents');
        expect(this).to.not.have.own.property('_rdListeners');
      };

      expect(listener.listenTo(target, 'event', callback)).to.equal(listener);
      expect(listener._rdListeningTo[target._rdListenId]._rdEvents.event[0].callback)
        .to.equal(callback);
      expect(listener.stopListening(target, 'event', callback)).to.equal(listener);

      expect(callbacks).to.eql({});
      expect(listener._rdListeningTo).to.eql({});
      expect(calls).to.deep.equal([
        ['on', target, 'event', callback, listener],
        ['off', target, 'event', callback, listener]
      ]);
    });

    it('retains interop bookkeeping until the last named event is removed', function() {
      const listener = createEmitter();
      const target = createEmitter();
      const callback = function() {};
      target.on = function() {};
      target.off = function() {};

      listener.listenTo(target, 'first second', callback);
      listener.stopListening(target, 'first', callback);

      expect(listener._rdListeningTo).to.have.property(target._rdListenId);

      listener.stopListening(target, 'second', callback);
      expect(listener._rdListeningTo).to.eql({});
    });
  });
});
