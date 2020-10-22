import mergeOptions from '../../../src/common/merge-options';

describe('mergeOptions', function() {
  let target;

  beforeEach(function() {
    target = {
      myOptions: ['color', 'size'],
      mergeOptions,
      initialize(options) {
        this.mergeOptions(options, this.myOptions);
      }
    };
  });

  describe('when calling with undefined options', function() {
    it('should return instantly without merging anything', function() {
      expect(mergeOptions()).to.be.undefined;
    });
  });

  describe('when no matching the keys', function() {
    it('should not merge any of those options', function() {
      target.initialize({
        hungry: true,
        country: 'USA'
      });

      expect(target).to.not.contain.keys('hungry', 'country');
    });
  });

  describe('when some matching the keys', function() {
    beforeEach(function() {
      target.initialize({
        hungry: true,
        country: 'USA',
        color: 'blue'
      });
    });

    it('should not merge the ones that do not match', function() {
      expect(target).to.not.contain.keys('hungry', 'country');
    });

    it('should merge the ones that match', function() {
      expect(target).to.contain.keys('color');
    });
  });

  describe('when all matching the keys', function() {
    it('should merge all of the options', function() {
      target.initialize({
        size: 'large',
        color: 'blue'
      });

      expect(target).to.contain.keys('color', 'size');
    });
  });
});
