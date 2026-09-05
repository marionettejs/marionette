import _ from 'underscore';

import getValue from '../../../src/utils/get-value';

function execute(implementation, createScenario) {
  const { object, property, fallback, trace = [] } = createScenario();

  try {
    return {
      trace,
      value: implementation(object, property, fallback)
    };
  } catch (error) {
    return {
      error: {
        message: error.message,
        name: error.name
      },
      trace
    };
  }
}

function expectParity(createScenario) {
  expect(execute(getValue, createScenario))
    .to.deep.equal(execute(_.result, createScenario));
}

describe('getValue', function() {
  it('reads once and invokes a callable with the object receiver and no arguments', function() {
    let callArguments;
    let callReceiver;
    let reads = 0;
    const object = Object.defineProperty({}, 'handler', {
      get() {
        reads += 1;
        return function(...args) {
          callArguments = args;
          callReceiver = this;
          return 'handled';
        };
      }
    });

    expect(getValue(object, 'handler')).to.equal('handled');
    expect(reads).to.equal(1);
    expect(callReceiver).to.equal(object);
    expect(callArguments).to.deep.equal([]);
  });

  it('uses the fallback only when the property value is undefined', function() {
    expect(getValue({ value: null }, 'value', 'fallback')).to.be.null;
    expect(getValue({ value: false }, 'value', 'fallback')).to.equal(false);
    expect(getValue({ value: 0 }, 'value', 'fallback')).to.equal(0);
    expect(getValue({ value: '' }, 'value', 'fallback')).to.equal('');
    expect(getValue({ value: undefined }, 'value', 'fallback')).to.equal('fallback');
    expect(getValue({}, 'value', 'fallback')).to.equal('fallback');
  });

  it('matches inherited, nullish, missing, and fallback values', function() {
    [
      () => ({ object: Object.create({ setting: 'inherited' }), property: 'setting' }),
      () => ({ object: { setting: null }, property: 'setting', fallback: 'fallback' }),
      () => ({ object: {}, property: 'setting', fallback: 'fallback' }),
      () => ({ object: null, property: 'setting', fallback: 'fallback' }),
      () => ({ object: undefined, property: 'setting' }),
      () => {
        const property = Symbol('setting');
        return { object: { [property]: 'symbol' }, property };
      }
    ].forEach(expectParity);
  });

  it('matches callable receivers and zero-argument invocation', function() {
    [
      () => {
        const trace = [];
        const object = Object.create({
          handler(...args) {
            trace.push({ args: args.length, receiver: this === object });
            return 'inherited callable';
          }
        });
        return { object, property: 'handler', trace };
      },
      () => {
        const trace = [];
        const object = {};
        const fallback = function(...args) {
          trace.push({ args: args.length, receiver: this === object });
          return 'fallback callable';
        };
        return { fallback, object, property: 'missing', trace };
      },
      () => {
        const trace = [];
        const fallback = function(...args) {
          trace.push({ args: args.length, receiver: this === null });
          return 'null fallback callable';
        };
        return { fallback, object: null, property: 'missing', trace };
      },
      () => {
        const trace = [];
        const object = {};
        object.handler = new Proxy(function() {}, {
          apply(target, receiver, args) {
            trace.push({ args: args.length, receiver: receiver === object });
            return 'proxied callable';
          }
        });
        return { object, property: 'handler', trace };
      }
    ].forEach(expectParity);
  });

  it('matches getter and property-proxy observation order', function() {
    expectParity(() => {
      const trace = [];
      const target = Object.create({
        get handler() {
          trace.push(`getter:${this === object}`);
          return 'value';
        }
      });
      const object = new Proxy(target, {
        get(proxyTarget, property, receiver) {
          trace.push(`get:${String(property)}:${receiver === object}`);
          return Reflect.get(proxyTarget, property, receiver);
        }
      });

      return { object, property: 'handler', trace };
    });
  });

  it('matches getter, proxy, and callable exceptions', function() {
    [
      () => ({
        object: Object.defineProperty({}, 'handler', {
          get() {
            throw new Error('getter failed');
          }
        }),
        property: 'handler'
      }),
      () => ({
        object: new Proxy({}, {
          get() {
            throw new Error('proxy get failed');
          }
        }),
        property: 'handler'
      }),
      () => ({
        object: {
          handler() {
            throw new Error('handler failed');
          }
        },
        property: 'handler'
      }),
      () => {
        const callable = Proxy.revocable(function() {}, {});
        callable.revoke();
        return { object: { handler: callable.proxy }, property: 'handler' };
      },
      () => ({ object: { handler: class Handler {} }, property: 'handler' })
    ].forEach(expectParity);
  });
});
