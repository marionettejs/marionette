import Radio from '../../modules/radio';
import { debugLog, log, setDebug } from '../../modules/common/radio';
import Events from '../../mixins/events';
import Requests from '../../mixins/requests';

function assignmentDescriptor(value) {
  return {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  };
}

function composedKeys(...sources) {
  const keys = [];
  sources.forEach(source => {
    Object.keys(source).forEach(key => {
      if (!keys.includes(key)) { keys.push(key); }
    });
  });
  return keys;
}

describe('Radio composition', function() {
  describe('fixed API composition', function() {
    it('preserves static and Channel method identities, descriptors, and order', function() {
      const staticMethods = { setDebug, log, debugLog };
      const channelFinal = { reset: Radio.Channel.prototype.reset };
      const expectedChannelKeys = composedKeys(Events, Requests, channelFinal);

      Object.entries(staticMethods).forEach(([key, value]) => {
        expect(Object.getOwnPropertyDescriptor(Radio, key))
          .to.deep.equal(assignmentDescriptor(value));
      });
      expect(Object.keys(Radio.Channel.prototype)).to.deep.equal(expectedChannelKeys);
      [Events, Requests].forEach(source => {
        Object.keys(source).forEach(key => {
          expect(Object.getOwnPropertyDescriptor(Radio.Channel.prototype, key))
            .to.deep.equal(assignmentDescriptor(source[key]));
          expect(Object.getOwnPropertyDescriptor(Radio, key))
            .to.deep.equal(assignmentDescriptor(Radio[key]));
        });
      });
      expect(Object.getOwnPropertyDescriptor(Radio.Channel.prototype, 'constructor')).to.deep.equal({
        configurable: true,
        enumerable: false,
        value: Radio.Channel,
        writable: true
      });
    });

    it('forwards through the calling receiver and lazily reads the channel method', function() {
      const calls = [];
      const channel = new Proxy({}, {
        get(target, key, receiver) {
          calls.push(['get', key, receiver]);
          return function(...args) {
            calls.push(['call', this, args]);
            return 'result';
          };
        }
      });
      const receiver = {
        channel(name) {
          calls.push(['channel', this, name]);
          return channel;
        }
      };

      expect(Radio.on.call(receiver, 'name', 'first', 'second')).to.equal('result');
      expect(calls).to.deep.equal([
        ['channel', receiver, 'name'],
        ['get', 'on', channel],
        ['call', channel, ['first', 'second']]
      ]);
    });

    it('excludes inherited API pollution and safely composes own built-in keys', async function() {
      const eventsPrototype = Object.getPrototypeOf(Events);
      const descriptors = new Map(
        ['constructor', 'toString', '__proto__']
          .map(key => [key, Object.getOwnPropertyDescriptor(Events, key)])
      );
      const methods = {
        constructor() {},
        toString() {},
        __proto__() {}
      };
      const cleanup = [];
      let IsolatedRadio;
      let primaryError;

      try {
        const pollutedPrototype = {};
        Object.defineProperty(pollutedPrototype, 'inheritedApi', {
          enumerable: true,
          get() {
            throw new Error('inherited API was read');
          }
        });
        Object.setPrototypeOf(Events, pollutedPrototype);
        cleanup.push(() => Object.setPrototypeOf(Events, eventsPrototype));
        Object.entries(methods).forEach(([key, value]) => {
          Object.defineProperty(Events, key, assignmentDescriptor(value));
          cleanup.push(() => {
            const descriptor = descriptors.get(key);
            if (descriptor) {
              Object.defineProperty(Events, key, descriptor);
            } else if (!Reflect.deleteProperty(Events, key)) {
              throw new Error(`Unable to restore Events.${key}`);
            }
          });
        });

        ({ default: IsolatedRadio } = await import('../../modules/radio.js?composition-test'));
      } catch (error) {
        primaryError = error;
      }

      let cleanupError;
      for (let index = cleanup.length - 1; index >= 0; index--) {
        try {
          cleanup[index]();
        } catch (error) {
          cleanupError = cleanupError || error;
        }
      }

      if (primaryError) { throw primaryError; }
      if (cleanupError) { throw cleanupError; }

      expect(IsolatedRadio).to.not.equal(Radio);
      expect(IsolatedRadio).to.not.have.own.property('inheritedApi');
      expect(IsolatedRadio.Channel.prototype).to.not.have.own.property('inheritedApi');
      expect(Object.getPrototypeOf(IsolatedRadio)).to.equal(Object.prototype);
      expect(Object.getPrototypeOf(IsolatedRadio.Channel.prototype)).to.equal(Object.prototype);
      Object.entries(methods).forEach(([key, value]) => {
        const channelDescriptor = assignmentDescriptor(value);
        if (key === 'constructor') { channelDescriptor.enumerable = false; }
        expect(Object.getOwnPropertyDescriptor(IsolatedRadio.Channel.prototype, key))
          .to.deep.equal(channelDescriptor);
        expect(Object.getOwnPropertyDescriptor(IsolatedRadio, key))
          .to.deep.equal(assignmentDescriptor(IsolatedRadio[key]));
      });
    });
  });

  describe('#reset', function() {
    it('uses a key snapshot in standard own-key order and skips later additions', function() {
      const calls = [];
      const inherited = { reset() { calls.push('inherited'); } };
      const channels = Object.create({ inherited });
      const add = key => {
        Object.defineProperty(channels, key, {
          configurable: true,
          enumerable: true,
          value: { reset() { calls.push(key); } },
          writable: true
        });
      };
      ['length', 'toString', 'constructor', '__proto__'].forEach(add);
      Object.defineProperty(channels, 'first', {
        configurable: true,
        enumerable: true,
        value: {
          reset() {
            calls.push('first');
            add('added');
          }
        }
      });

      expect(Radio.reset.call({ _channels: channels })).to.be.undefined;
      expect(calls).to.deep.equal(['length', 'toString', 'constructor', '__proto__', 'first']);
      expect(Object.hasOwn(channels, 'added')).to.be.true;
    });

    it('treats a numeric length as an ordinary channel-map entry', function() {
      const indexedReset = this.sinon.stub();
      const namedReset = this.sinon.stub();
      const channels = {
        0: { reset: indexedReset },
        length: 1,
        named: { reset: namedReset }
      };

      expect(() => Radio.reset.call({ _channels: channels })).to.throw(TypeError);
      expect(indexedReset).to.have.been.calledOnce;
      expect(namedReset).to.not.have.been.called;
    });

    it('snapshots proxy keys before lazy value reads and observes deletions', function() {
      const calls = [];
      const target = {};
      Object.defineProperties(target, {
        first: {
          configurable: true,
          enumerable: true,
          get() {
            return {
              reset() {
                calls.push('reset:first');
                delete target.second;
              }
            };
          }
        },
        second: {
          configurable: true,
          enumerable: true,
          get() {
            return { reset() { calls.push('reset:second'); } };
          }
        }
      });
      const channels = new Proxy(target, {
        ownKeys(object) {
          calls.push('ownKeys');
          return Reflect.ownKeys(object);
        },
        getOwnPropertyDescriptor(object, key) {
          calls.push(`descriptor:${key}`);
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
        get(object, key, receiver) {
          calls.push(`get:${key}`);
          return Reflect.get(object, key, receiver);
        }
      });

      expect(() => Radio.reset.call({ _channels: channels })).to.throw(TypeError);
      expect(calls).to.deep.equal([
        'ownKeys',
        'descriptor:first',
        'descriptor:second',
        'get:first',
        'reset:first',
        'get:second'
      ]);
    });

    it('stops reading later channels when a reset throws', function() {
      const calls = [];
      const channels = {};
      Object.defineProperties(channels, {
        first: {
          enumerable: true,
          get() {
            calls.push('get:first');
            return { reset() { calls.push('reset:first'); throw new Error('reset failed'); } };
          }
        },
        second: {
          enumerable: true,
          get() {
            calls.push('get:second');
            return { reset() {} };
          }
        }
      });

      expect(() => Radio.reset.call({ _channels: channels })).to.throw('reset failed');
      expect(calls).to.deep.equal(['get:first', 'reset:first']);
    });

    it('retains the Object.keys intrinsic captured at module load', function() {
      const reset = this.sinon.stub();
      const originalObjectKeys = Object.keys;
      Object.keys = () => { throw new Error('patched Object.keys called'); };

      try {
        expect(Radio.reset.call({ _channels: { channel: { reset } } })).to.be.undefined;
      } finally {
        Object.keys = originalObjectKeys;
      }

      expect(reset).to.have.been.calledOnce;
    });
  });
});
