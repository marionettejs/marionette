import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Requests from '../../packages/radio/src/requests.ts';
import { setDebug } from '../../packages/radio/src/debug.ts';

function handler(callback, context) {
  return { callback, context };
}

describe('Requests', function() {
  beforeEach(function(testContext) {
    testContext.requests = { ...Requests };
  });

  afterEach(function() {
    setDebug(false);
  });

  describe('#reply', function() {
    it('calls handlers with the request arguments and context', function(testContext) {
      const context = {};
      const callback = vi.fn().mockReturnValue('response');
      const registry = {};
      testContext.requests._rdRequests = registry;

      expect(testContext.requests.reply('foo', callback, context)).to.equal(testContext.requests);

      expect(testContext.requests._rdRequests).to.equal(registry);
      expect(testContext.requests.request('foo', 1, 2)).to.equal('response');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.contexts).toContain(context);
      expect(callback).toHaveBeenCalledWith(1, 2);
    });

    it('replaces duplicate replies in order and logs the overwrite first', function() {
      const calls = [];
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined).mockImplementation(() => calls.push('warn'));
      const requests = { ...Requests };
      Object.defineProperty(requests, 'stopReplying', {
        configurable: true,
        get() {
          calls.push('stopReplying');
          return Requests.stopReplying;
        }
      });

      setDebug();
      requests.reply('foo', 'first');
      requests.replyOnce('foo', 'second');

      expect(requests.request('foo')).to.equal('second');
      expect(calls).to.deep.equal(['warn', 'stopReplying']);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('A request was overwritten: "foo"');
    });

    it('retains earlier public registrations when a later split entry throws', function() {
      const requests = { ...Requests };
      Object.defineProperty(requests, 'channelName', {
        configurable: true,
        get() {
          throw new Error('channel lookup failed');
        }
      });

      expect(() => requests.reply('first first', 'response'))
        .to.throw('channel lookup failed');
      delete requests.channelName;
      expect(requests.request('first')).to.equal('response');
    });

    it('retains earlier in-place mutations when a later reply throws', function() {
      const registry = {};
      const requests = { ...Requests, _rdRequests: registry };
      Object.defineProperty(requests, 'channelName', {
        get() {
          throw new Error('channel lookup failed');
        }
      });

      expect(() => requests.reply('first first', 'response'))
        .to.throw('channel lookup failed');
      expect(requests._rdRequests).to.equal(registry);
      expect(Object.keys(registry)).to.deep.equal(['first']);
      expect(registry.first.callback()).to.equal('response');
    });

    it('uses the supplied truthy context and otherwise falls back to the receiver', function(testContext) {
      const context = {};
      testContext.requests.reply('truthy', 'response', context);
      [undefined, null, false, 0, ''].forEach((falseyContext, index) => {
        testContext.requests.reply(`falsey${index}`, 'response', falseyContext);
      });

      expect(testContext.requests._rdRequests.truthy.context).to.equal(context);
      for (let index = 0; index < 5; index++) {
        expect(testContext.requests._rdRequests[`falsey${index}`].context).to.equal(testContext.requests);
      }
    });

    it('warns only when an own handler is overwritten', function(testContext) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      testContext.requests._rdRequests = Object.create({
        inherited: handler(() => {}, testContext.requests)
      });

      setDebug();
      testContext.requests.reply('inherited', 'first');
      testContext.requests.reply('inherited', 'second');

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('A request was overwritten: "inherited"');
    });
  });

  describe('#replyOnce', function() {
    it('dispatches map and space-separated entries through replyOnce', function(testContext) {
      const calls = [];
      const baseReplyOnce = Requests.replyOnce;
      testContext.requests.replyOnce = function(...args) {
        calls.push(args[0]);
        return baseReplyOnce.apply(this, args);
      };

      testContext.requests.replyOnce({ alpha: 'a', beta: 'b' });
      testContext.requests.replyOnce('gamma delta', 'split');

      expect(calls).to.deep.equal([
        { alpha: 'a', beta: 'b' },
        'alpha',
        'beta',
        'gamma delta',
        'gamma',
        'delta'
      ]);
      expect(testContext.requests.request('alpha')).to.equal('a');
      expect(testContext.requests.request('beta')).to.equal('b');
      expect(testContext.requests.request('gamma')).to.equal('split');
      expect(testContext.requests.request('delta')).to.equal('split');
    });

    it('dispatches wrapper registration through an overridden reply method', function(testContext) {
      const registrations = [];
      const callback = vi.fn().mockReturnValue('response');
      const baseReply = Requests.reply;
      testContext.requests.reply = function(...args) {
        registrations.push(args);
        return baseReply.apply(this, args);
      };

      testContext.requests.replyOnce('foo', callback);

      expect(registrations).to.have.lengthOf(1);
      expect(registrations[0][0]).to.equal('foo');
      expect(registrations[0][1]).to.be.a('function');
      expect(testContext.requests.request('foo')).to.equal('response');
    });

    it('defers stopReplying lookup until the one-shot reply is requested', function() {
      const requests = { ...Requests };
      Object.defineProperty(requests, 'stopReplying', {
        get() {
          throw new Error('stopReplying lookup failed');
        }
      });

      expect(() => requests.replyOnce('foo', 'response')).to.not.throw();
      expect(() => requests.request('foo'))
        .to.throw('stopReplying lookup failed');
    });

    it('removes the reply before invoking it and returns the first result once', function(testContext) {
      const callback = vi.fn().mockImplementation(() => {
        expect(testContext.requests.request('foo')).to.be.undefined;
        return 'once';
      });

      expect(testContext.requests.replyOnce('foo', callback)).to.equal(testContext.requests);

      expect(testContext.requests.request('foo', 1)).to.equal('once');
      expect(testContext.requests.request('foo', 2)).to.be.undefined;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.contexts).toContain(testContext.requests);
      expect(callback).toHaveBeenCalledWith(1);
    });

    it('can be removed by its original callback before invocation', function(testContext) {
      const callback = vi.fn();

      testContext.requests.replyOnce('foo', callback);
      testContext.requests.stopReplying('foo', callback);
      testContext.requests.request('foo');

      expect(callback).not.toHaveBeenCalled();
    });

    it('matches the original callback after reading the wrapper twice', function(testContext) {
      const callback = vi.fn();
      const trace = [];
      testContext.requests.replyOnce('foo', callback);
      testContext.requests._rdRequests.foo = new Proxy(testContext.requests._rdRequests.foo, {
        get(object, key, receiver) {
          trace.push(key);
          return Reflect.get(object, key, receiver);
        }
      });

      testContext.requests.stopReplying('foo', callback);

      expect(trace).to.deep.equal(['callback', 'callback']);
      expect(testContext.requests._rdRequests).to.not.have.own.property('foo');
    });
  });

  describe('#stopReplying', function() {
    it('returns without creating a registry when none exists', function(testContext) {
      expect(testContext.requests.stopReplying('foo')).to.equal(testContext.requests);
      expect(testContext.requests).to.not.have.own.property('_rdRequests');
    });

    it('clears the registry only when every filter is falsey', function(testContext) {
      testContext.requests.reply('foo', 'response');

      expect(testContext.requests.stopReplying()).to.equal(testContext.requests);

      expect(testContext.requests).to.not.have.own.property('_rdRequests');
    });

    it('matches callback and context without removing nonmatching replies', function(testContext) {
      const callback = vi.fn().mockReturnValue('response');
      const context = {};
      testContext.requests.reply('foo', callback, context);

      testContext.requests.stopReplying('foo', callback, {});
      expect(testContext.requests.request('foo')).to.equal('response');

      testContext.requests.stopReplying('foo', callback, context);
      expect(testContext.requests.request('foo')).to.be.undefined;
    });

    it('snapshots own keys before reading values and skips later additions', function(testContext) {
      const callback = vi.fn();
      const trace = [];
      const requestsContext = testContext.requests;
      const target = {
        first: handler(callback, requestsContext),
        second: handler(callback, requestsContext)
      };
      const registry = new Proxy(target, {
        ownKeys(object) {
          trace.push('ownKeys');
          return Reflect.ownKeys(object);
        },
        getOwnPropertyDescriptor(object, key) {
          trace.push(`descriptor:${key}`);
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
        get(object, key, proxyReceiver) {
          trace.push(`get:${key}`);
          if (key === 'first') {
            delete object.second;
            object.added = handler(callback, requestsContext);
          }
          return Reflect.get(object, key, proxyReceiver);
        },
        deleteProperty(object, key) {
          trace.push(`delete:${key}`);
          return Reflect.deleteProperty(object, key);
        }
      });
      testContext.requests._rdRequests = registry;

      testContext.requests.stopReplying(null, callback);

      expect(trace).to.deep.equal([
        'ownKeys',
        'descriptor:first',
        'descriptor:second',
        'descriptor:first',
        'get:first',
        'delete:first',
        'descriptor:second'
      ]);
      expect(Object.keys(target)).to.deep.equal(['added']);
      expect(target.added.context).to.equal(requestsContext);
    });

    it('preserves callback-read short-circuiting and falsey wildcards', function(testContext) {
      const registered = vi.fn();
      const other = vi.fn();
      const trace = [];
      const storedHandler = new Proxy({ callback: registered, context: testContext.requests }, {
        get(object, key, receiver) {
          trace.push(key);
          return Reflect.get(object, key, receiver);
        }
      });
      testContext.requests._rdRequests = { foo: storedHandler };

      testContext.requests.stopReplying('foo', other);
      expect(trace).to.deep.equal(['callback', 'callback']);
      expect(testContext.requests._rdRequests).to.have.own.property('foo');

      trace.length = 0;
      testContext.requests.stopReplying('foo', registered, {});
      expect(trace).to.deep.equal(['callback', 'context']);
      expect(testContext.requests._rdRequests).to.have.own.property('foo');

      trace.length = 0;
      testContext.requests.stopReplying('foo', false, false);
      expect(trace).to.deep.equal([]);
      expect(testContext.requests._rdRequests).to.not.have.own.property('foo');
    });

    it('propagates delete errors without visiting later snapshotted keys', function(testContext) {
      const callback = vi.fn();
      const trace = [];
      const registry = new Proxy({
        first: handler(callback, testContext.requests),
        second: handler(callback, testContext.requests)
      }, {
        get(object, key, receiver) {
          trace.push(`get:${key}`);
          return Reflect.get(object, key, receiver);
        },
        deleteProperty(object, key) {
          trace.push(`delete:${key}`);
          throw new Error('delete failed');
        }
      });
      testContext.requests._rdRequests = registry;

      expect(() => testContext.requests.stopReplying(null, callback)).to.throw('delete failed');
      expect(trace).to.deep.equal(['get:first', 'delete:first']);
    });

    it('treats function registries as objects and primitives as empty', function(testContext) {
      const callback = vi.fn();
      const registry = function() {};
      registry.foo = handler(callback, testContext.requests);
      testContext.requests._rdRequests = registry;

      testContext.requests.stopReplying(null, callback);
      expect(registry).to.not.have.own.property('foo');

      for (const primitive of [true, 1, 'text', Symbol('registry'), 1n]) {
        testContext.requests._rdRequests = primitive;
        expect(testContext.requests.stopReplying(null, callback)).to.equal(testContext.requests);
        expect(testContext.requests._rdRequests).to.equal(primitive);
      }
    });

    it('iterates numeric length and built-in own keys but ignores other properties', function(testContext) {
      const callback = vi.fn();
      const symbol = Symbol('handler');
      const registry = Object.assign(Object.create({ inherited: handler(callback, testContext.requests) }), {
        length: handler(callback, testContext.requests),
        constructor: handler(callback, testContext.requests),
        toString: handler(callback, testContext.requests),
        [symbol]: handler(callback, testContext.requests)
      });
      Object.defineProperty(registry, '__proto__', {
        configurable: true,
        enumerable: true,
        value: handler(callback, testContext.requests),
        writable: true
      });
      Object.defineProperty(registry, 'hidden', {
        configurable: true,
        value: handler(callback, testContext.requests),
        writable: true
      });
      testContext.requests._rdRequests = registry;

      testContext.requests.stopReplying(null, callback);

      expect(Object.keys(registry)).to.deep.equal([]);
      expect(registry).to.have.own.property('hidden');
      expect(registry).to.have.own.property(symbol);
      expect(registry.inherited).to.exist;
    });

    it('uses the Object.keys captured when the module loads', function(testContext) {
      const objectKeys = Object.keys;
      testContext.requests.reply('foo', 'response');

      try {
        Object.keys = () => { throw new Error('patched Object.keys'); };
        expect(testContext.requests.stopReplying(null, testContext.requests._rdRequests.foo.callback))
          .to.equal(testContext.requests);
      } finally {
        Object.keys = objectKeys;
      }

      expect(testContext.requests.request('foo')).to.be.undefined;
    });
  });

  describe('registration overload dispatch', function() {
    it('dispatches reply map and split entries through the public method', function() {
      // Backbone.Radio 2.0 recursively dispatched every overloaded entry.
      const calls = [];
      const requests = { ...Requests };
      requests.reply = function(name, ...args) {
        calls.push(name);
        return Requests.reply.call(this, name, ...args);
      };

      requests.reply({ 'first second': 'response', third: 'response' });

      expect(calls).to.deep.equal([
        { 'first second': 'response', third: 'response' },
        'first second',
        'first',
        'second',
        'third'
      ]);
    });

    it('dispatches stopReplying map and split entries through the public method', function() {
      // Backbone.Radio 2.0 recursively dispatched every overloaded entry.
      const calls = [];
      const requests = { ...Requests };
      requests.reply('first second third', 'response');
      requests.stopReplying = function(name, ...args) {
        calls.push(name);
        return Requests.stopReplying.call(this, name, ...args);
      };

      requests.stopReplying({ 'first second': 'response', third: 'response' });

      expect(calls).to.deep.equal([
        { 'first second': 'response', third: 'response' },
        'first second',
        'first',
        'second',
        'third'
      ]);
    });
  });

  describe('#request', function() {
    it('prioritizes an own named handler and passes only request arguments', function(testContext) {
      const named = vi.fn().mockReturnValue('named');
      const fallback = vi.fn();
      testContext.requests.reply('foo', named);
      testContext.requests.reply('default', fallback);

      expect(testContext.requests.request('foo', 1, 2)).to.equal('named');
      expect(named).toHaveBeenCalledTimes(1);
      expect(named.mock.contexts).toContain(testContext.requests);
      expect(named).toHaveBeenCalledWith(1, 2);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('passes the exact outer arguments to the default handler', function(testContext) {
      const fallback = vi.fn().mockReturnValue('default');
      testContext.requests.reply('default', fallback);

      expect(testContext.requests.request('missing', 1, 2)).to.equal('default');
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(fallback.mock.contexts).toContain(testContext.requests);
      expect(fallback).toHaveBeenCalledWith('missing', 1, 2);
    });

    it('reads the selected callback and context once before forwarding either argument list', function(testContext) {
      const context = {};
      const value = {};
      const result = {};
      const callback = vi.fn().mockReturnValue(result);
      const reads = [];
      const registration = {
        get callback() { reads.push('callback'); return callback; },
        get context() { reads.push('context'); return context; }
      };
      testContext.requests._rdRequests = { named: registration, default: registration };

      expect(testContext.requests.request('named', value, 2, 3, 4)).to.equal(result);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.contexts).toContain(context);
      expect(callback).toHaveBeenCalledWith(value, 2, 3, 4);
      expect(reads).to.deep.equal(['callback', 'context']);

      expect(testContext.requests.request('missing', value, 2, 3, 4)).to.equal(result);
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.contexts[1]).toEqual(context);
      expect(callback.mock.calls.at(1)).toEqual(['missing', value, 2, 3, 4]);
      expect(reads).to.deep.equal(['callback', 'context', 'callback', 'context']);
    });

    it('lets an own falsey named entry suppress the default handler', function(testContext) {
      const fallback = vi.fn();
      testContext.requests._rdRequests = {
        foo: 0,
        default: handler(fallback, testContext.requests)
      };

      expect(testContext.requests.request('foo')).to.be.undefined;
      expect(fallback).not.toHaveBeenCalled();
    });

    it('ignores inherited named and default handlers', function(testContext) {
      const named = vi.fn();
      const fallback = vi.fn();
      testContext.requests._rdRequests = Object.create({
        default: handler(fallback, testContext.requests),
        inherited: handler(named, testContext.requests)
      });

      expect(testContext.requests.request('inherited')).to.be.undefined;
      expect(testContext.requests.request('missing')).to.be.undefined;
      expect(testContext.requests.request('constructor')).to.be.undefined;
      expect(testContext.requests.request('toString')).to.be.undefined;
      expect(named).not.toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it('stores, invokes, and removes an own __proto__ handler safely', function(testContext) {
      const callback = vi.fn().mockReturnValue('response');

      testContext.requests.reply('__proto__', callback);

      expect(Object.getPrototypeOf(testContext.requests._rdRequests)).to.equal(Object.prototype);
      expect(Object.hasOwn(testContext.requests._rdRequests, '__proto__')).to.be.true;
      expect(testContext.requests.request('__proto__')).to.equal('response');

      testContext.requests.stopReplying('__proto__');

      expect(Object.hasOwn(testContext.requests._rdRequests, '__proto__')).to.be.false;
      expect(testContext.requests.request('__proto__')).to.be.undefined;
    });

    it('snapshots request-map keys before one value read and recursive call per key', function() {
      const trace = [];
      const target = { first: 'one', second: 'two' };
      const requestMap = new Proxy(target, {
        ownKeys(object) {
          trace.push('ownKeys');
          return Reflect.ownKeys(object);
        },
        getOwnPropertyDescriptor(object, key) {
          trace.push(`descriptor:${key}`);
          return Reflect.getOwnPropertyDescriptor(object, key);
        },
        get(object, key, receiver) {
          trace.push(`get:${key}`);
          return Reflect.get(object, key, receiver);
        }
      });
      const context = {
        request(name, ...args) {
          if (name && typeof name === 'object') {
            return Requests.request.call(this, name, ...args);
          }
          trace.push(`request:${name}:${args[0]}`);
          return `${name}:${args[0]}`;
        }
      };

      const replies = context.request(requestMap);

      expect(trace).to.deep.equal([
        'ownKeys',
        'descriptor:first',
        'descriptor:second',
        'get:first',
        'request:first:one',
        'get:second',
        'request:second:two'
      ]);
      expect(replies).to.deep.equal({ first: 'first:one', second: 'second:two' });
    });

    it('forwards trailing arguments after each request-map value', function(testContext) {
      const responseHandler = vi.fn().mockReturnValue('response');
      const trailing = {};
      testContext.requests.reply('foo', responseHandler);

      expect(testContext.requests.request({ foo: 'mapped' }, trailing))
        .to.deep.equal({ foo: 'response' });
      expect(responseHandler).toHaveBeenCalledTimes(1);
      expect(responseHandler).toHaveBeenCalledWith('mapped', trailing);
    });

    it('stops reading a request map when a recursive request throws', function() {
      const later = vi.fn();
      const requestMap = { first: 'one' };
      Object.defineProperty(requestMap, 'second', {
        enumerable: true,
        get: later
      });
      const context = {
        request(name, ...args) {
          if (name && typeof name === 'object') {
            return Requests.request.call(this, name, ...args);
          }
          throw new Error('request failed');
        }
      };

      expect(() => context.request(requestMap)).to.throw('request failed');
      expect(later).not.toHaveBeenCalled();
    });

    it('propagates a request-map getter error before recursion or later reads', function() {
      const recursiveRequest = vi.fn();
      const later = vi.fn();
      const requestMap = {};
      Object.defineProperty(requestMap, 'first', {
        enumerable: true,
        get() {
          throw new Error('value lookup failed');
        }
      });
      Object.defineProperty(requestMap, 'second', {
        enumerable: true,
        get: later
      });
      const context = {
        request(name, ...args) {
          if (name && typeof name === 'object') {
            return Requests.request.call(this, name, ...args);
          }
          recursiveRequest(name, ...args);
        }
      };

      expect(() => context.request(requestMap)).to.throw('value lookup failed');
      expect(recursiveRequest).not.toHaveBeenCalled();
      expect(later).not.toHaveBeenCalled();
    });

    it('invokes split names including duplicates in order with the original arguments', function() {
      const calls = [];
      const firstArg = {};
      const secondArg = Symbol('argument');
      const context = {
        request(name, ...args) {
          if (typeof name === 'string' && /\s/.test(name)) {
            return Requests.request.call(this, name, ...args);
          }
          calls.push([name, args]);
          return calls.length;
        }
      };

      const replies = context.request('first first second', firstArg, secondArg);

      expect(calls).to.deep.equal([
        ['first', [firstArg, secondArg]],
        ['first', [firstArg, secondArg]],
        ['second', [firstArg, secondArg]]
      ]);
      expect(Object.keys(replies)).to.deep.equal(['first', 'second']);
      expect(replies).to.deep.equal({ first: 2, second: 3 });
    });

    it('overwrites split and direct collisions without changing first insertion order', function() {
      const context = {
        request(name, ...args) {
          if (name && (typeof name === 'object' || /\s/.test(name))) {
            return Requests.request.call(this, name, ...args);
          }
          return args[0];
        }
      };

      const directThenSplit = context.request({
        first: 'direct',
        'first second': 'split'
      });
      const splitThenDirect = context.request({
        'first second': 'split',
        first: 'direct'
      });

      expect(Object.keys(directThenSplit)).to.deep.equal(['first', 'second']);
      expect(directThenSplit).to.deep.equal({ first: 'split', second: 'split' });
      expect(Object.keys(splitThenDirect)).to.deep.equal(['first', 'second']);
      expect(splitThenDirect).to.deep.equal({ first: 'direct', second: 'split' });
    });

    it('builds request result maps with safe own collision keys', function(testContext) {
      const protoValue = { safe: true };
      const requestMap = { constructor: 'argument', toString: 'argument' };
      Object.defineProperty(requestMap, '__proto__', {
        enumerable: true,
        value: 'argument'
      });
      testContext.requests.reply('__proto__', () => protoValue);
      testContext.requests.reply('constructor', () => 'constructor');
      testContext.requests.reply('toString', () => 'toString');
      testContext.requests.reply('first', () => 1);

      const directReplies = testContext.requests.request(requestMap);
      const nestedReplies = testContext.requests.request({ '__proto__ first': 'argument' });

      expect(Object.keys(directReplies)).to.deep.equal(['constructor', 'toString', '__proto__']);
      expect(Object.getPrototypeOf(directReplies)).to.equal(Object.prototype);
      expect(Object.hasOwn(directReplies, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(directReplies, '__proto__').value)
        .to.equal(protoValue);
      expect(directReplies.constructor).to.equal('constructor');
      expect(directReplies.toString).to.equal('toString');
      expect(Object.getPrototypeOf(nestedReplies)).to.equal(Object.prototype);
      expect(Object.hasOwn(nestedReplies, '__proto__')).to.be.true;
      expect(nestedReplies.first).to.equal(1);
    });

    it('flattens own enumerable properties from nested results', function() {
      const symbol = Symbol('included');
      const protoValue = { safe: true };
      const nestedResult = Object.assign(Object.create({ inherited: 'ignored' }), {
        owned: 'response',
        [symbol]: 'included'
      });
      Object.defineProperty(nestedResult, 'hidden', { value: 'ignored' });
      Object.defineProperty(nestedResult, '__proto__', {
        enumerable: true,
        value: protoValue
      });
      const context = {
        request(name) {
          return typeof name === 'object' ? Requests.request.call(this, name) : nestedResult;
        }
      };

      const replies = context.request({ 'first second': 'argument' });

      expect(replies.owned).to.equal('response');
      expect(replies).to.not.have.property('inherited');
      expect(replies).to.not.have.property('hidden');
      expect(replies[symbol]).to.equal('included');
      expect(Object.getPrototypeOf(replies)).to.equal(Object.prototype);
      expect(Object.hasOwn(replies, '__proto__')).to.be.true;
      expect(Object.getOwnPropertyDescriptor(replies, '__proto__').value)
        .to.equal(protoValue);
    });

    it('supports array, sparse, boxed-string, and numeric-length request maps', function() {
      const calls = [];
      const context = {
        request(name, ...args) {
          if (name && typeof name === 'object') {
            return Requests.request.call(this, name, ...args);
          }
          calls.push([name, args[0]]);
          return args[0];
        }
      };
      const sparse = [];
      sparse[2] = 'third';

      context.request(['first', 'second']);
      context.request(sparse);
      context.request(new String('ab'));
      context.request({ length: 2, named: 'value' });

      expect(calls).to.deep.equal([
        ['0', 'first'],
        ['1', 'second'],
        ['2', 'third'],
        ['0', 'a'],
        ['1', 'b'],
        ['length', 2],
        ['named', 'value']
      ]);
    });

    it('uses the captured Object.keys and propagates proxy key errors', function() {
      const objectKeys = Object.keys;
      const context = {
        request(name, ...args) {
          return name && typeof name === 'object' ?
            Requests.request.call(this, name, ...args) : args[0];
        }
      };

      try {
        Object.keys = () => { throw new Error('patched Object.keys'); };
        expect(context.request({ foo: 'value' })).to.deep.equal({ foo: 'value' });
      } finally {
        Object.keys = objectKeys;
      }

      const proxy = new Proxy({}, {
        ownKeys() {
          throw new Error('ownKeys failed');
        }
      });
      expect(() => context.request(proxy)).to.throw('ownKeys failed');
    });

    it('logs tuned requests before reading the selected handler', function(testContext) {
      const trace = [];
      vi.spyOn(console, 'log').mockImplementation(() => undefined).mockImplementation(() => trace.push('log'));
      const registry = {};
      Object.defineProperty(registry, 'foo', {
        enumerable: true,
        get() {
          trace.push('handler');
          return handler(() => 'response', null);
        }
      });
      testContext.requests.channelName = 'channel';
      testContext.requests._tunedIn = true;
      testContext.requests._rdRequests = registry;

      expect(testContext.requests.request('foo', 1)).to.equal('response');
      expect(trace).to.deep.equal(['log', 'handler']);
    });

    it('preserves callable, primitive, nullish, and Symbol name behavior', function(testContext) {
      const callableName = function() {};
      callableName.toString = () => 'callable';
      testContext.requests.reply(callableName, 'response');

      expect(testContext.requests.request(callableName)).to.equal('response');
      expect(() => testContext.requests.request(function ordinaryName() {})).to.throw(TypeError);
      for (const name of [undefined, null, false, 0, '', 1, 1n]) {
        expect(testContext.requests.request(name)).to.be.undefined;
      }
      expect(() => testContext.requests.request(Symbol('name'))).to.throw(TypeError);
    });
  });
});
