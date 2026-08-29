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

  it('supports legacy string and arguments key collections', function() {
    target.myOptions = 'ab';
    target.initialize({ a: 1, b: 2 });

    (function() {
      target.myOptions = arguments;
    })('color', 'size');
    target.initialize({ color: 'blue', size: 'large' });

    expect(target).to.include({ a: 1, b: 2, color: 'blue', size: 'large' });
  });

  it('preserves fractional array-like length traversal', function() {
    target.myOptions = { 0: 'color', 1: 'size', length: 1.5 };
    target.initialize({ color: 'blue', size: 'large' });

    expect(target).to.include({ color: 'blue', size: 'large' });
  });

  it('classifies and captures array-like length with separate reads', function() {
    let lengthReads = 0;
    const keys = {
      0: 'color',
      1: 'size',
      get length() {
        lengthReads += 1;
        return lengthReads === 1 ? 2 : 1;
      }
    };

    target.myOptions = keys;
    target.initialize({ color: 'blue', size: 'large' });

    expect(lengthReads).to.equal(2);
    expect(target.color).to.equal('blue');
    expect(target).to.not.have.property('size');
  });

  it('snapshots ordinary object keys while reading their values live', function() {
    const keys = {
      get first() {
        this.second = 'country';
        this.third = 'ignored';
        return 'color';
      },
      second: 'size'
    };

    target.myOptions = keys;
    target.initialize({ color: 'blue', country: 'USA', size: 'large', ignored: true });

    expect(target).to.include({ color: 'blue', country: 'USA' });
    expect(target).to.not.have.property('size');
    expect(target).to.not.have.property('ignored');
  });

  it('ignores nullish and non-collection key inputs', function() {
    const options = { color: 'blue' };

    for (const keys of [null, undefined, 42, true, Symbol('keys'), new Map(), new Set()]) {
      target.myOptions = keys;
      target.initialize(options);
    }

    expect(target).to.not.have.property('color');
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
