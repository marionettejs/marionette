import View from '../../../modules/view';

describe('normalizeMethods', function() {
  'use strict';

  let view;

  beforeEach(function() {
    const MyView = View.extend({
      foo: this.sinon.stub()
    });
    view = new MyView();
  });

  describe('when called with no value', function() {
    it('should return nothing', function() {
      expect(view.normalizeMethods()).to.be.undefined;
    });
  });

  describe('when called with a hash of functions and strings', function() {
    let normalizedHash;
    let hash;

    beforeEach(function() {
      hash = {
        'foo': 'foo'
      };
      normalizedHash = view.normalizeMethods(hash);
    });

    it('should convert the strings that exist as functions to functions', function() {
      expect(normalizedHash).to.have.property('foo');
    });

    it('returns a fresh plain hash without changing the source', function() {
      const handler = this.sinon.stub();
      const source = { event: handler };

      const result = view.normalizeMethods(source);

      expect(result).to.not.equal(source);
      expect(Object.getPrototypeOf(result)).to.equal(Object.prototype);
      expect(result).to.deep.equal(source);
      expect(source).to.deep.equal({ event: handler });
    });

    it('preserves own enumerable string-key order', function() {
      const accessOrder = [];
      const source = {};
      Object.defineProperties(source, {
        first: {
          enumerable: true,
          get() {
            accessOrder.push('first');
            return view.foo;
          }
        },
        second: {
          enumerable: true,
          get() {
            accessOrder.push('second');
            return view.foo;
          }
        }
      });

      expect(Object.keys(view.normalizeMethods(source))).to.deep.equal(['first', 'second']);
      expect(accessOrder).to.deep.equal(['first', 'second']);
    });

    it('passes function handlers through unchanged', function() {
      const handler = this.sinon.stub();

      expect(view.normalizeMethods({ event: handler }).event).to.equal(handler);
    });

    it('resolves primitive and boxed string handler names', function() {
      expect(view.normalizeMethods({ primitive: 'foo', boxed: new String('foo') }))
        .to.deep.equal({ primitive: view.foo, boxed: view.foo });
    });

    it('resolves own and inherited context methods', function() {
      const context = Object.create({ inheritedHandler: view.foo });
      const ownHandler = this.sinon.stub();
      context.ownHandler = ownHandler;

      expect(view.normalizeMethods.call(context, {
        inherited: 'inheritedHandler',
        own: 'ownHandler'
      })).to.deep.equal({ inherited: view.foo, own: ownHandler });
    });

    it('ignores inherited, symbol, and non-enumerable input keys', function() {
      const inheritedGetter = this.sinon.stub().throws(new Error('must not run'));
      const source = Object.create(Object.defineProperty({}, 'inherited', {
        enumerable: true,
        get: inheritedGetter
      }));
      const symbol = Symbol('handler');
      source.own = view.foo;
      source[symbol] = view.foo;
      Object.defineProperty(source, 'hidden', {
        enumerable: false,
        value: view.foo
      });

      expect(view.normalizeMethods(source)).to.deep.equal({ own: view.foo });
      expect(inheritedGetter).to.not.have.been.called;
    });

    it('retains a literal own __proto__ key without changing the result prototype', function() {
      const source = {};
      Object.defineProperty(source, '__proto__', {
        enumerable: true,
        value: view.foo
      });

      const result = view.normalizeMethods(source);

      expect(Object.getPrototypeOf(result)).to.equal(Object.prototype);
      expect(Object.hasOwn(result, '__proto__')).to.equal(true);
      expect(Object.getOwnPropertyDescriptor(result, '__proto__').value).to.equal(view.foo);
    });

    it('throws a stable diagnostic when a named handler does not exist', function() {
      expect(() => view.normalizeMethods({bar: 'bar'}))
        .to.throw('The handler "bar" for "bar" must resolve to a function.')
        .with.property('code', 'MN0019');
    });

    it('throws the same diagnostic when a named handler is not callable', function() {
      view.bar = true;

      expect(() => view.normalizeMethods({bar: 'bar'}))
        .to.throw('The handler "bar" for "bar" must resolve to a function.')
        .with.property('code', 'MN0019');
    });

    it('rejects non-string handler references', function() {
      view[1] = view.foo;

      expect(() => view.normalizeMethods({found: 1}))
        .to.throw('The handler "1" for "found" must resolve to a function.')
        .with.property('code', 'MN0019');
    });

    it('formats Symbol handler references in the stable diagnostic', function() {
      expect(() => view.normalizeMethods({event: Symbol('handler')}))
        .to.throw('The handler "Symbol(handler)" for "event" must resolve to a function.')
        .with.property('code', 'MN0019');
    });

    it('formats unprintable handler references in the stable diagnostic', function() {
      expect(() => view.normalizeMethods({event: Object.create(null)}))
        .to.throw('The handler "<unprintable>" for "event" must resolve to a function.')
        .with.property('code', 'MN0019');
    });
  });
});
