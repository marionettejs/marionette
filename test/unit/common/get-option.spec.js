import getOption from '../../../src/common/get-option';

describe('get option', function() {
  describe('when calling without arguments', function() {
    it('should return undefined', function() {
      expect(getOption()).to.be.undefined;
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
