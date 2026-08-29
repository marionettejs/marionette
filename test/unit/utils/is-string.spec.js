import vm from 'node:vm';
import _ from 'underscore';

import isString from '../../../utils/is-string';

describe('isString', function() {
  it('matches Underscore string-tag classification', function() {
    const values = [
      'string',
      new String('boxed'),
      vm.runInNewContext('new String("cross realm")'),
      new Proxy(new String('proxied boxed'), {}),
      { [Symbol.toStringTag]: 'String' },
      new Proxy({}, {
        get(target, property, receiver) {
          if (property === Symbol.toStringTag) { return 'String'; }
          return Reflect.get(target, property, receiver);
        }
      }),
      null,
      undefined,
      1,
      {},
      () => {}
    ];

    values.forEach(value => {
      expect(isString(value)).to.equal(_.isString(value));
    });
  });

  it('captures the tag reader when the module loads', function() {
    const originalToString = Object.prototype.toString;

    try {
      // eslint-disable-next-line no-extend-native
      Object.prototype.toString = () => '[object Number]';
      expect(isString('string')).to.be.true;
      expect(isString(1)).to.be.false;
    } finally {
      // eslint-disable-next-line no-extend-native
      Object.prototype.toString = originalToString;
    }
  });

  it('propagates tag lookup errors', function() {
    const value = Object.defineProperty({}, Symbol.toStringTag, {
      get() {
        throw new Error('tag failed');
      }
    });

    expect(() => isString(value)).to.throw('tag failed');
  });

  it('matches Underscore errors for revoked proxies', function() {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() => isString(revocable.proxy)).to.throw(TypeError);
    expect(() => _.isString(revocable.proxy)).to.throw(TypeError);
  });
});
