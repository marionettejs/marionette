import _ from 'underscore';

import eachOwn from '../../../utils/each-own';

function execute(implementation, createScenario) {
  const { object, trace } = createScenario();

  try {
    const returned = implementation(object, function(value, key, iteratedObject) {
      trace.push({
        key,
        sameObject: iteratedObject === object,
        value
      });
    });
    return { returned: returned === object, trace };
  } catch (error) {
    return {
      error: { message: error.message, name: error.name },
      trace
    };
  }
}

function expectParity(createScenario) {
  expect(execute(eachOwn, createScenario))
    .to.deep.equal(execute(_.each, createScenario));
}

describe('eachOwn', function() {
  it('treats numeric length as an ordinary own map key', function() {
    const object = { 0: 'zero', length: 1, named: 'value' };
    const keys = [];

    expect(eachOwn(object, (value, key) => keys.push(key))).to.equal(object);
    expect(keys).to.deep.equal(['0', 'length', 'named']);
  });

  it('matches own-key order, built-in keys, and inherited-key exclusion', function() {
    const createScenario = () => {
      const object = Object.create({ inherited: 'ignored' });
      const symbol = Symbol('ignored');
      Object.defineProperties(object, {
        ['__proto__']: { enumerable: true, value: 'proto' },
        constructor: { enumerable: true, value: 'constructor' },
        hidden: { value: 'ignored' },
        toString: { enumerable: true, value: 'toString' }
      });
      object[symbol] = 'ignored';
      return { object, trace: [] };
    };

    expectParity(createScenario);

    const { object } = createScenario();
    const keys = [];
    eachOwn(object, (value, key) => keys.push(key));
    expect(keys).to.deep.equal(['__proto__', 'constructor', 'toString']);
  });

  it('matches key snapshots and value-read timing', function() {
    expectParity(() => {
      const trace = [];
      const object = {};
      Object.defineProperties(object, {
        first: {
          enumerable: true,
          get() {
            trace.push('read:first');
            object.third = 'late';
            delete object.second;
            return 'first';
          }
        },
        second: {
          configurable: true,
          enumerable: true,
          get() {
            trace.push('read:second');
            return 'second';
          }
        }
      });
      return { object, trace };
    });
  });

  it('snapshots proxy keys without probing array-like length', function() {
    const trace = [];
    const target = { first: 1, second: 2 };
    const object = new Proxy(target, {
      get(proxyTarget, property, receiver) {
        trace.push(`get:${String(property)}`);
        return Reflect.get(proxyTarget, property, receiver);
      },
      getOwnPropertyDescriptor(proxyTarget, property) {
        trace.push(`descriptor:${String(property)}`);
        return Reflect.getOwnPropertyDescriptor(proxyTarget, property);
      },
      ownKeys(proxyTarget) {
        trace.push('keys');
        return Reflect.ownKeys(proxyTarget);
      }
    });
    eachOwn(object, (value, key, iteratedObject) => {
      trace.push(`callback:${key}:${value}:${iteratedObject === object}`);
    });

    expect(trace).to.deep.equal([
      'keys',
      'descriptor:first',
      'descriptor:second',
      'get:first',
      'callback:first:1:true',
      'get:second',
      'callback:second:2:true'
    ]);
  });

  it('matches nullish no-ops and propagated errors', function() {
    [
      () => ({ object: null, trace: [] }),
      () => ({ object: undefined, trace: [] }),
      () => {
        const trace = [];
        const object = Object.defineProperties({}, {
          first: {
            enumerable: true,
            get() {
              trace.push('first');
              throw new Error('read failed');
            }
          },
          second: {
            enumerable: true,
            get() {
              trace.push('second');
              return 2;
            }
          }
        });
        return { object, trace };
      }
    ].forEach(expectParity);
  });
});
