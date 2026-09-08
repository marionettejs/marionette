import { describe, it, expect } from 'vitest';
import { setProperty } from '@mnjs/utils';

describe('setProperty', function() {
  it('defines __proto__ without changing the target prototype', function() {
    const target = {};
    const value = { polluted: true };

    setProperty(target, '__proto__', value);

    expect(Object.getPrototypeOf(target)).to.equal(Object.prototype);
    expect(Object.hasOwn(target, '__proto__')).toBe(true);
    expect(Reflect.get(target, '__proto__')).to.equal(value);
    expect({}.polluted).toBeUndefined();
  });

});
