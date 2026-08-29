import mergeOptions from '../../../modules/common/merge-options';

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

  it('merges only own enumerable string options and safely owns __proto__', function() {
    const symbol = Symbol('ignored');
    const protoValue = { polluted: true };
    const options = Object.assign(Object.create({ color: 'inherited' }), {
      size: 'large',
      [symbol]: 'symbol'
    });
    Object.defineProperty(options, 'country', { value: 'hidden' });
    Object.defineProperty(options, '__proto__', { enumerable: true, value: protoValue });

    target.myOptions = ['color', 'size', 'country', symbol, '__proto__'];
    target.initialize(options);

    expect(target.size).to.equal('large');
    expect(target).to.not.have.property('color');
    expect(target).to.not.have.property('country');
    expect(target).to.not.have.property(symbol);
    expect(Object.getPrototypeOf(target)).to.equal(Object.prototype);
    expect(Object.hasOwn(target, '__proto__')).to.be.true;
    expect(Object.getOwnPropertyDescriptor(target, '__proto__').value).to.equal(protoValue);
  });
});
