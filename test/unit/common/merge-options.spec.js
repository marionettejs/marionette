import mergeOptions from '../../../modules/common/merge-options';
import MarionetteError from '../../../utils/error';

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

  describe('when calling with nullish options', function() {
    it('should return instantly without validating keys', function() {
      expect(mergeOptions()).to.be.undefined;
      expect(mergeOptions(null)).to.be.undefined;
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

  it('traverses array-like key collections with a captured length and live values', function() {
    const reads = [];
    const keyValues = ['color'];
    keyValues.length = 3;
    keyValues[2] = 'size';
    const keys = new Proxy(keyValues, {
      get(collection, key, receiver) {
        reads.push(key);

        if (key === '0') {
          collection[1] = 'country';
          collection[2] = 'hungry';
          collection.push('ignored');
        }

        return Reflect.get(collection, key, receiver);
      }
    });

    target.myOptions = keys;
    target.initialize({
      color: 'blue',
      country: 'USA',
      hungry: true,
      ignored: true
    });

    expect(target).to.include({ color: 'blue', country: 'USA', hungry: true });
    expect(target).to.not.have.property('ignored');
    expect(reads.filter(key => /^\d+$/.test(key))).to.deep.equal(['0', '1', '2']);
  });

  it('reads deleted array-like entries densely', function() {
    const reads = [];
    const keys = new Proxy(['color', 'size'], {
      get(collection, key, receiver) {
        reads.push(key);

        if (key === '0') {
          delete collection[1];
        }

        return Reflect.get(collection, key, receiver);
      }
    });

    target.myOptions = keys;
    target.initialize({ color: 'blue', size: 'large' });

    expect(target.color).to.equal('blue');
    expect(target).to.not.have.property('size');
    expect(reads.filter(key => /^\d+$/.test(key))).to.deep.equal(['0', '1']);
  });

  it('rejects keys that are not an array', function() {
    const options = { color: 'blue' };
    const getArguments = function() { return arguments; };

    for (const keys of [
      null,
      undefined,
      false,
      0,
      '',
      NaN,
      'color',
      getArguments('color'),
      { 0: 'color', length: 1 },
      { first: 'color' },
      42,
      true,
      Symbol('keys'),
      new Map(),
      new Set()
    ]) {
      target.myOptions = keys;
      expect(target.initialize.bind(target, options))
        .to.throw(MarionetteError)
        .and.include({ code: 'MN0033' });
    }

    expect(target).to.not.have.property('color');
  });

  it('rejects an omitted keys argument when options are present', function() {
    expect(() => mergeOptions.call(target, { color: 'blue' }))
      .to.throw(MarionetteError)
      .and.include({ code: 'MN0033' });
  });

  it('skips requested options with undefined values', function() {
    target.myOptions = ['color'];
    target.color = 'blue';

    target.initialize({ color: undefined });

    expect(target.color).to.equal('blue');
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
