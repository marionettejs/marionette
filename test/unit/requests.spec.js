import Requests from '../../src/mixins/requests';
import { setDebug } from '../../src/modules/common/radio';

function handler(callback, context) {
  return { callback, context };
}

describe('Requests', function() {
  beforeEach(function() {
    this.requests = { ...Requests };
  });

  afterEach(function() {
    setDebug(false);
  });

  describe('#reply', function() {
    it('calls handlers with the request arguments and context', function() {
      const context = {};
      const callback = this.sinon.stub().returns('response');
      const registry = {};
      this.requests._rdRequests = registry;

      expect(this.requests.reply('foo', callback, context)).to.equal(this.requests);

      expect(this.requests._rdRequests).to.equal(registry);
      expect(this.requests.request('foo', 1, 2)).to.equal('response');
      expect(callback).to.have.been.calledOnce.and.calledOn(context).and.calledWithExactly(1, 2);
    });

    it('replaces duplicate replies in order and logs the overwrite first', function() {
      const calls = [];
      const warn = this.sinon.stub(console, 'warn').callsFake(() => calls.push('warn'));
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
      expect(warn).to.have.been.calledOnce.and.calledWithExactly('A request was overwritten: "foo"');
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

    it('uses the supplied truthy context and otherwise falls back to the receiver', function() {
      const context = {};
      this.requests.reply('truthy', 'response', context);
      [undefined, null, false, 0, ''].forEach((falseyContext, index) => {
        this.requests.reply(`falsey${index}`, 'response', falseyContext);
      });

      expect(this.requests._rdRequests.truthy.context).to.equal(context);
      for (let index = 0; index < 5; index++) {
        expect(this.requests._rdRequests[`falsey${index}`].context).to.equal(this.requests);
      }
    });

    it('warns only when an own handler is overwritten', function() {
      const warn = this.sinon.stub(console, 'warn');
      this.requests._rdRequests = Object.create({
        inherited: handler(() => {}, this.requests)
      });

      setDebug();
      this.requests.reply('inherited', 'first');
      this.requests.reply('inherited', 'second');

      expect(warn).to.have.been.calledOnce
        .and.calledWithExactly('A request was overwritten: "inherited"');
    });
  });

  describe('#replyOnce', function() {
    it('dispatches map and space-separated entries through replyOnce', function() {
      const calls = [];
      const baseReplyOnce = Requests.replyOnce;
      this.requests.replyOnce = function(...args) {
        calls.push(args[0]);
        return baseReplyOnce.apply(this, args);
      };

      this.requests.replyOnce({ alpha: 'a', beta: 'b' });
      this.requests.replyOnce('gamma delta', 'split');

      expect(calls).to.deep.equal([
        { alpha: 'a', beta: 'b' },
        'alpha',
        'beta',
        'gamma delta',
        'gamma',
        'delta'
      ]);
      expect(this.requests.request('alpha')).to.equal('a');
      expect(this.requests.request('beta')).to.equal('b');
      expect(this.requests.request('gamma')).to.equal('split');
      expect(this.requests.request('delta')).to.equal('split');
    });

    it('dispatches wrapper registration through an overridden reply method', function() {
      const registrations = [];
      const callback = this.sinon.stub().returns('response');
      const baseReply = Requests.reply;
      this.requests.reply = function(...args) {
        registrations.push(args);
        return baseReply.apply(this, args);
      };

      this.requests.replyOnce('foo', callback);

      expect(registrations).to.have.lengthOf(1);
      expect(registrations[0][0]).to.equal('foo');
      expect(registrations[0][1]).to.be.a('function');
      expect(this.requests.request('foo')).to.equal('response');
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

    it('removes the reply before invoking it and returns the first result once', function() {
      const callback = this.sinon.stub().callsFake(() => {
        expect(this.requests.request('foo')).to.be.undefined;
        return 'once';
      });

      expect(this.requests.replyOnce('foo', callback)).to.equal(this.requests);

      expect(this.requests.request('foo', 1)).to.equal('once');
      expect(this.requests.request('foo', 2)).to.be.undefined;
      expect(callback).to.have.been.calledOnce
        .and.calledOn(this.requests)
        .and.calledWithExactly(1);
    });

    it('can be removed by its original callback before invocation', function() {
      const callback = this.sinon.stub();

      this.requests.replyOnce('foo', callback);
      this.requests.stopReplying('foo', callback);
      this.requests.request('foo');

      expect(callback).to.not.have.been.called;
    });

    it('matches the original callback after reading the wrapper twice', function() {
      const callback = this.sinon.stub();
      const trace = [];
      this.requests.replyOnce('foo', callback);
      this.requests._rdRequests.foo = new Proxy(this.requests._rdRequests.foo, {
        get(object, key, receiver) {
          trace.push(key);
          return Reflect.get(object, key, receiver);
        }
      });

      this.requests.stopReplying('foo', callback);

      expect(trace).to.deep.equal(['callback', 'callback']);
      expect(this.requests._rdRequests).to.not.have.own.property('foo');
    });
  });

  describe('#stopReplying', function() {
    it('returns without creating a registry when none exists', function() {
      expect(this.requests.stopReplying('foo')).to.equal(this.requests);
      expect(this.requests).to.not.have.own.property('_rdRequests');
    });

    it('clears the registry only when every filter is falsey', function() {
      this.requests.reply('foo', 'response');

      expect(this.requests.stopReplying()).to.equal(this.requests);

      expect(this.requests).to.not.have.own.property('_rdRequests');
    });

    it('matches callback and context without removing nonmatching replies', function() {
      const callback = this.sinon.stub().returns('response');
      const context = {};
      this.requests.reply('foo', callback, context);

      this.requests.stopReplying('foo', callback, {});
      expect(this.requests.request('foo')).to.equal('response');

      this.requests.stopReplying('foo', callback, context);
      expect(this.requests.request('foo')).to.be.undefined;
    });

    it('snapshots own keys before reading values and skips later additions', function() {
      const callback = this.sinon.stub();
      const trace = [];
      const requestsContext = this.requests;
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
      this.requests._rdRequests = registry;

      this.requests.stopReplying(null, callback);

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

    it('preserves callback-read short-circuiting and falsey wildcards', function() {
      const registered = this.sinon.stub();
      const other = this.sinon.stub();
      const trace = [];
      const storedHandler = new Proxy({ callback: registered, context: this.requests }, {
        get(object, key, receiver) {
          trace.push(key);
          return Reflect.get(object, key, receiver);
        }
      });
      this.requests._rdRequests = { foo: storedHandler };

      this.requests.stopReplying('foo', other);
      expect(trace).to.deep.equal(['callback', 'callback']);
      expect(this.requests._rdRequests).to.have.own.property('foo');

      trace.length = 0;
      this.requests.stopReplying('foo', registered, {});
      expect(trace).to.deep.equal(['callback', 'context']);
      expect(this.requests._rdRequests).to.have.own.property('foo');

      trace.length = 0;
      this.requests.stopReplying('foo', false, false);
      expect(trace).to.deep.equal([]);
      expect(this.requests._rdRequests).to.not.have.own.property('foo');
    });

    it('propagates delete errors without visiting later snapshotted keys', function() {
      const callback = this.sinon.stub();
      const trace = [];
      const registry = new Proxy({
        first: handler(callback, this.requests),
        second: handler(callback, this.requests)
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
      this.requests._rdRequests = registry;

      expect(() => this.requests.stopReplying(null, callback)).to.throw('delete failed');
      expect(trace).to.deep.equal(['get:first', 'delete:first']);
    });

    it('treats function registries as objects and primitives as empty', function() {
      const callback = this.sinon.stub();
      const registry = function() {};
      registry.foo = handler(callback, this.requests);
      this.requests._rdRequests = registry;

      this.requests.stopReplying(null, callback);
      expect(registry).to.not.have.own.property('foo');

      for (const primitive of [true, 1, 'text', Symbol('registry'), 1n]) {
        this.requests._rdRequests = primitive;
        expect(this.requests.stopReplying(null, callback)).to.equal(this.requests);
        expect(this.requests._rdRequests).to.equal(primitive);
      }
    });

    it('iterates numeric length and built-in own keys but ignores other properties', function() {
      const callback = this.sinon.stub();
      const symbol = Symbol('handler');
      const registry = Object.assign(Object.create({ inherited: handler(callback, this.requests) }), {
        length: handler(callback, this.requests),
        constructor: handler(callback, this.requests),
        toString: handler(callback, this.requests),
        [symbol]: handler(callback, this.requests)
      });
      Object.defineProperty(registry, '__proto__', {
        configurable: true,
        enumerable: true,
        value: handler(callback, this.requests),
        writable: true
      });
      Object.defineProperty(registry, 'hidden', {
        configurable: true,
        value: handler(callback, this.requests),
        writable: true
      });
      this.requests._rdRequests = registry;

      this.requests.stopReplying(null, callback);

      expect(Object.keys(registry)).to.deep.equal([]);
      expect(registry).to.have.own.property('hidden');
      expect(registry).to.have.own.property(symbol);
      expect(registry.inherited).to.exist;
    });

    it('uses the Object.keys captured when the module loads', function() {
      const objectKeys = Object.keys;
      this.requests.reply('foo', 'response');

      try {
        Object.keys = () => { throw new Error('patched Object.keys'); };
        expect(this.requests.stopReplying(null, this.requests._rdRequests.foo.callback))
          .to.equal(this.requests);
      } finally {
        Object.keys = objectKeys;
      }

      expect(this.requests.request('foo')).to.be.undefined;
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
    it('prioritizes an own named handler and passes only request arguments', function() {
      const named = this.sinon.stub().returns('named');
      const fallback = this.sinon.stub();
      this.requests.reply('foo', named);
      this.requests.reply('default', fallback);

      expect(this.requests.request('foo', 1, 2)).to.equal('named');
      expect(named).to.have.been.calledOnce
        .and.calledOn(this.requests)
        .and.calledWithExactly(1, 2);
      expect(fallback).to.not.have.been.called;
    });

    it('passes the exact outer arguments to the default handler', function() {
      const fallback = this.sinon.stub().returns('default');
      this.requests.reply('default', fallback);

      expect(this.requests.request('missing', 1, 2)).to.equal('default');
      expect(fallback).to.have.been.calledOnce
        .and.calledOn(this.requests)
        .and.calledWithExactly('missing', 1, 2);
    });

    it('reads the selected callback and context once before forwarding either argument list', function() {
      const context = {};
      const value = {};
      const result = {};
      const callback = this.sinon.stub().returns(result);
      const reads = [];
      const registration = {
        get callback() { reads.push('callback'); return callback; },
        get context() { reads.push('context'); return context; }
      };
      this.requests._rdRequests = { named: registration, default: registration };

      expect(this.requests.request('named', value, 2, 3, 4)).to.equal(result);
      expect(callback).to.have.been.calledOnce.and.calledOn(context)
        .and.calledWithExactly(value, 2, 3, 4);
      expect(reads).to.deep.equal(['callback', 'context']);

      expect(this.requests.request('missing', value, 2, 3, 4)).to.equal(result);
      expect(callback).to.have.been.calledTwice;
      expect(callback.secondCall).to.have.been.calledOn(context)
        .and.calledWithExactly('missing', value, 2, 3, 4);
      expect(reads).to.deep.equal(['callback', 'context', 'callback', 'context']);
    });

    it('lets an own falsey named entry suppress the default handler', function() {
      const fallback = this.sinon.stub();
      this.requests._rdRequests = {
        foo: 0,
        default: handler(fallback, this.requests)
      };

      expect(this.requests.request('foo')).to.be.undefined;
      expect(fallback).to.not.have.been.called;
    });

    it('ignores inherited named and default handlers', function() {
      const named = this.sinon.stub();
      const fallback = this.sinon.stub();
      this.requests._rdRequests = Object.create({
        default: handler(fallback, this.requests),
        inherited: handler(named, this.requests)
      });

      expect(this.requests.request('inherited')).to.be.undefined;
      expect(this.requests.request('missing')).to.be.undefined;
      expect(this.requests.request('constructor')).to.be.undefined;
      expect(this.requests.request('toString')).to.be.undefined;
      expect(named).to.not.have.been.called;
      expect(fallback).to.not.have.been.called;
    });

    it('stores, invokes, and removes an own __proto__ handler safely', function() {
      const callback = this.sinon.stub().returns('response');

      this.requests.reply('__proto__', callback);

      expect(Object.getPrototypeOf(this.requests._rdRequests)).to.equal(Object.prototype);
      expect(Object.hasOwn(this.requests._rdRequests, '__proto__')).to.be.true;
      expect(this.requests.request('__proto__')).to.equal('response');

      this.requests.stopReplying('__proto__');

      expect(Object.hasOwn(this.requests._rdRequests, '__proto__')).to.be.false;
      expect(this.requests.request('__proto__')).to.be.undefined;
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

    it('forwards trailing arguments after each request-map value', function() {
      const responseHandler = this.sinon.stub().returns('response');
      const trailing = {};
      this.requests.reply('foo', responseHandler);

      expect(this.requests.request({ foo: 'mapped' }, trailing))
        .to.deep.equal({ foo: 'response' });
      expect(responseHandler).to.have.been.calledOnce
        .and.calledWithExactly('mapped', trailing);
    });

    it('stops reading a request map when a recursive request throws', function() {
      const later = this.sinon.spy();
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
      expect(later).to.not.have.been.called;
    });

    it('propagates a request-map getter error before recursion or later reads', function() {
      const recursiveRequest = this.sinon.spy();
      const later = this.sinon.spy();
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
      expect(recursiveRequest).to.not.have.been.called;
      expect(later).to.not.have.been.called;
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

    it('builds request result maps with safe own collision keys', function() {
      const protoValue = { safe: true };
      const requestMap = { constructor: 'argument', toString: 'argument' };
      Object.defineProperty(requestMap, '__proto__', {
        enumerable: true,
        value: 'argument'
      });
      this.requests.reply('__proto__', () => protoValue);
      this.requests.reply('constructor', () => 'constructor');
      this.requests.reply('toString', () => 'toString');
      this.requests.reply('first', () => 1);

      const directReplies = this.requests.request(requestMap);
      const nestedReplies = this.requests.request({ '__proto__ first': 'argument' });

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

    it('flattens only own enumerable string properties from nested results', function() {
      const symbol = Symbol('ignored');
      const protoValue = { safe: true };
      const nestedResult = Object.assign(Object.create({ inherited: 'ignored' }), {
        owned: 'response',
        [symbol]: 'ignored'
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
      expect(replies).to.not.have.property(symbol);
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

    it('logs tuned requests before reading the selected handler', function() {
      const trace = [];
      this.sinon.stub(console, 'log').callsFake(() => trace.push('log'));
      const registry = {};
      Object.defineProperty(registry, 'foo', {
        enumerable: true,
        get() {
          trace.push('handler');
          return handler(() => 'response', null);
        }
      });
      this.requests.channelName = 'channel';
      this.requests._tunedIn = true;
      this.requests._rdRequests = registry;

      expect(this.requests.request('foo', 1)).to.equal('response');
      expect(trace).to.deep.equal(['log', 'handler']);
    });

    it('preserves callable, primitive, nullish, and Symbol name behavior', function() {
      const callableName = function() {};
      callableName.toString = () => 'callable';
      this.requests.reply(callableName, 'response');

      expect(this.requests.request(callableName)).to.equal('response');
      expect(() => this.requests.request(function ordinaryName() {})).to.throw(TypeError);
      for (const name of [undefined, null, false, 0, '', 1, 1n]) {
        expect(this.requests.request(name)).to.be.undefined;
      }
      expect(() => this.requests.request(Symbol('name'))).to.throw(TypeError);
    });
  });
});
