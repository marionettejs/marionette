import { describe, it, expect } from 'vitest';
import { getOption } from '@mnjs/utils';
import { MnObject } from 'marionette';

describe('get option', function() {
  it.each([0, '0', '', NaN, Symbol('option')])('reads option and fallback values for key %s', function(key) {
    const target = { getOption, [key]: 'fallback', options: { [key]: 'option' } };

    expect(target.getOption(key)).toBe('option');
    target.options[key] = undefined;
    expect(target.getOption(key)).toBe('fallback');
    delete target.options;
    expect(target.getOption(key)).toBe('fallback');
  });

  it.each([false, 0, '', null])('preserves the falsy option value %s for falsy keys', function(value) {
    const target = { getOption, 0: 'fallback', '': 'fallback', options: { 0: value, '': value } };

    expect(target.getOption(0)).toBe(value);
    expect(target.getOption('')).toBe(value);
  });

  it.each([null, undefined])('treats %s as a missing key', function(key) {
    const target = { getOption, options: { null: 'null option', undefined: 'undefined option' } };

    expect(target.getOption(key)).toBeUndefined();
  });

  it('reads numeric and empty keys on a Marionette owner', function() {
    const owner = new MnObject({ 0: 'zero', '': 'empty' });
    try {
      expect(owner.getOption(0)).toBe('zero');
      expect(owner.getOption('0')).toBe('zero');
      expect(owner.getOption('')).toBe('empty');
    } finally {
      owner.destroy();
    }
  });

  describe('when calling without arguments', function() {
    it('should return undefined', function() {
      expect(getOption()).toBeUndefined();
    });
  });

  describe('when an object only has the option set on the definition', function() {
    it('should return that definitions option', function() {
      const target = {
        foo: 'bar',
        getOption
      };

      expect(target.getOption('foo')).to.equal(target.foo);
    });
  });

  describe('when an object only has the option set on the options', function() {
    it('should return value from the options', function() {
      const target = {
        options: {foo: 'bar'},
        getOption
      };

      expect(target.getOption('foo')).to.equal(target.options.foo);
    });
  });

  describe('when an object has the option set on the options, and it is a "falsey" value', function() {
    it('should return value from the options', function() {
      const target = {
        options: {foo: false},
        getOption
      };

      expect(target.getOption('foo')).to.equal(target.options.foo);
    });
  });

  describe('when an object has the option set on the options, and it is a "undefined" value', function() {
    it('should return the objects value', function() {
      const target = {
        foo: 'bar',
        options: {foo: undefined},
        getOption
      };

      expect(target.getOption('foo')).to.equal(target.foo);
    });
  });

  describe('when an object has the option set on both the definition and options', function() {
    it('should return that value from the options', function() {
      const target = {
        foo: 'bar',
        options: {foo: 'baz'},
        getOption
      };

      expect(target.getOption('foo')).to.equal(target.options.foo);
    });
  });
});
