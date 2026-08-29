import assignIn, { assignOwn, setProperty } from '../../../utils/assign-in';

function defineProto(object, value) {
  Object.defineProperty(object, '__proto__', {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
  return object;
}

describe('assignment helpers', function() {
  it('distinguishes inherited composition from own assignment', function() {
    const source = Object.assign(Object.create({ inherited: 'inherited' }), {
      own: 'own'
    });

    expect(assignIn({}, source)).to.deep.equal({
      inherited: 'inherited',
      own: 'own'
    });
    expect(assignOwn({}, source)).to.deep.equal({ own: 'own' });
  });

  it('applies later sources and returns the target', function() {
    const target = {};

    expect(assignOwn(target, { value: 'first' }, { value: 'last' })).to.equal(target);
    expect(target).to.deep.equal({ value: 'last' });
  });

  it('ignores nullish values, primitives, symbols, and non-enumerable keys', function() {
    const symbol = Symbol('ignored');
    const source = { visible: 'copied', [symbol]: 'ignored' };
    Object.defineProperty(source, 'hidden', { value: 'ignored' });

    const assignedOwn = assignOwn({}, null, undefined, false, 1, 'text', source);
    const assignedIn = assignIn({}, null, undefined, false, 1, 'text', source);

    expect(assignedOwn).to.deep.equal({ visible: 'copied' });
    expect(assignedIn).to.deep.equal({ visible: 'copied' });
    expect(assignedOwn[symbol]).to.be.undefined;
    expect(assignedIn[symbol]).to.be.undefined;
  });

  it('defines __proto__ without changing the target prototype', function() {
    const target = {};
    const value = { polluted: true };

    setProperty(target, '__proto__', value);

    expect(Object.getPrototypeOf(target)).to.equal(Object.prototype);
    expect(Object.hasOwn(target, '__proto__')).to.be.true;
    expect(Reflect.get(target, '__proto__')).to.equal(value);
    expect({}.polluted).to.be.undefined;
  });

  it('safely copies own and inherited __proto__ data properties', function() {
    const inheritedValue = { inherited: true };
    const ownValue = { own: true };
    const inheritedSource = Object.create(defineProto({}, inheritedValue));
    const ownSource = defineProto({}, ownValue);

    const assignedIn = assignIn({}, inheritedSource);
    const assignedOwn = assignOwn({}, ownSource);

    expect(Object.getPrototypeOf(assignedIn)).to.equal(Object.prototype);
    expect(Reflect.get(assignedIn, '__proto__')).to.equal(inheritedValue);
    expect(Object.getPrototypeOf(assignedOwn)).to.equal(Object.prototype);
    expect(Reflect.get(assignedOwn, '__proto__')).to.equal(ownValue);
  });
});
