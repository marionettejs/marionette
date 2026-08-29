import {
  Application,
  Behavior,
  CollectionView,
  MnObject,
  Region,
  View,
  extend
} from '../../../index';

function defineProto(object, value) {
  Object.defineProperty(object, '__proto__', {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
  return object;
}

describe('extend', function() {
  it('uses an own constructor and otherwise forwards construction to the parent', function() {
    const Parent = function(first, second) {
      this.values = [first, second];
    };
    const constructor = this.sinon.spy(function(value) {
      this.explicitValue = value;
    });
    const ExplicitChild = extend.call(Parent, { constructor });
    const inheritedConstructor = this.sinon.spy();
    const DefaultChild = extend.call(Parent, Object.assign(
      Object.create({ constructor: inheritedConstructor }),
      { ownMethod() {} }
    ));

    const explicit = new ExplicitChild('explicit');
    const fallback = new DefaultChild('first', 'second');
    const returnedObject = {};
    const ReturningParent = function() {
      return returnedObject;
    };
    const ReturningChild = extend.call(ReturningParent);

    expect(ExplicitChild).to.equal(constructor);
    expect(explicit.explicitValue).to.equal('explicit');
    expect(constructor).to.have.been.calledOnce;
    expect(fallback.values).to.deep.equal(['first', 'second']);
    expect(new ReturningChild()).to.equal(returnedObject);
    expect(inheritedConstructor).to.not.have.been.called;
  });

  it('owns prototype inputs while preserving the parent prototype chain', function() {
    const Parent = function() {};
    Parent.prototype.parentMethod = function() {};
    const protoProps = Object.assign(Object.create({ inheritedMethod() {} }), {
      ownMethod() {}
    });
    const Child = extend.call(Parent, protoProps);

    expect(Object.getPrototypeOf(Child.prototype)).to.equal(Parent.prototype);
    expect(Child.prototype).to.have.own.property('ownMethod');
    expect(Child.prototype).to.not.have.property('inheritedMethod');
    expect(Child.prototype.parentMethod).to.equal(Parent.prototype.parentMethod);
    expect(Child.prototype.constructor).to.equal(Child);
    expect(Child.__super__).to.equal(Parent.prototype);
  });

  it('copies inherited parent statics, then own static inputs', function() {
    const Parent = function() {};
    const inheritedParentStatics = Object.assign(Object.create(Function.prototype), {
      inheritedParentStatic: 'parent inherited'
    });
    Object.setPrototypeOf(Parent, inheritedParentStatics);
    Parent.parentStatic = 'parent own';
    Parent.overridden = 'parent';
    const staticProps = Object.assign(Object.create({ inheritedInput: 'ignored' }), {
      ownStatic: 'input own',
      overridden: 'input'
    });
    const Child = extend.call(Parent, {}, staticProps);

    expect(Child).to.include({
      inheritedParentStatic: 'parent inherited',
      ownStatic: 'input own',
      overridden: 'input',
      parentStatic: 'parent own'
    });
    expect(Child).to.not.have.property('inheritedInput');
  });

  it('ignores nullish and primitive extension inputs', function() {
    const Parent = function() {};

    [null, undefined, false, 1, 'text'].forEach(input => {
      const Child = extend.call(Parent, input, input);

      expect(Object.getPrototypeOf(Child.prototype)).to.equal(Parent.prototype);
      expect(Object.keys(Child.prototype)).to.deep.equal(['constructor']);
    });
  });

  it('ignores symbol and non-enumerable extension inputs', function() {
    const symbol = Symbol('ignored');
    const protoProps = { visiblePrototype: true, [symbol]: 'ignored' };
    const staticProps = { visibleStatic: true, [symbol]: 'ignored' };
    Object.defineProperty(protoProps, 'hiddenPrototype', { value: 'ignored' });
    Object.defineProperty(staticProps, 'hiddenStatic', { value: 'ignored' });

    const Child = extend.call(function() {}, protoProps, staticProps);

    expect(Child.prototype.visiblePrototype).to.be.true;
    expect(Child.visibleStatic).to.be.true;
    expect(Child.prototype.hiddenPrototype).to.be.undefined;
    expect(Child.hiddenStatic).to.be.undefined;
    expect(Child.prototype[symbol]).to.be.undefined;
    expect(Child[symbol]).to.be.undefined;
  });

  it('defines extension __proto__ values without changing prototype chains', function() {
    const Parent = function() {};
    const prototypeValue = { prototypeInput: true };
    const staticValue = { staticInput: true };
    const protoProps = defineProto({}, prototypeValue);
    const staticProps = defineProto({}, staticValue);

    const Child = extend.call(Parent, protoProps, staticProps);

    expect(Object.getPrototypeOf(Child.prototype)).to.equal(Parent.prototype);
    expect(Object.hasOwn(Child.prototype, '__proto__')).to.be.true;
    expect(Reflect.get(Child.prototype, '__proto__')).to.equal(prototypeValue);
    expect(Object.getPrototypeOf(Child)).to.equal(Function.prototype);
    expect(Object.hasOwn(Child, '__proto__')).to.be.true;
    expect(Reflect.get(Child, '__proto__')).to.equal(staticValue);
  });

  it('backs every exported Marionette pseudo-class', function() {
    const classes = { Application, Behavior, CollectionView, MnObject, Region, View };

    Object.entries(classes).forEach(([name, Parent]) => {
      const staticProps = Object.assign(Object.create({ inherited: 'ignored' }), {
        className: name
      });
      const Child = Parent.extend({ ownedPrototype: name }, staticProps);
      const Grandchild = Child.extend(
        { secondGenerationPrototype: name },
        Object.assign(Object.create({ secondGenerationInherited: 'ignored' }), {
          secondGenerationStatic: name
        })
      );

      expect(Parent.extend).to.equal(extend);
      expect(Child.extend).to.equal(extend);
      expect(Object.getPrototypeOf(Child.prototype)).to.equal(Parent.prototype);
      expect(Child.prototype.ownedPrototype).to.equal(name);
      expect(Child.className).to.equal(name);
      expect(Child).to.not.have.property('inherited');
      expect(Grandchild.extend).to.equal(extend);
      expect(Object.getPrototypeOf(Grandchild.prototype)).to.equal(Child.prototype);
      expect(Grandchild.prototype.ownedPrototype).to.equal(name);
      expect(Grandchild.prototype.secondGenerationPrototype).to.equal(name);
      expect(Grandchild.className).to.equal(name);
      expect(Grandchild.secondGenerationStatic).to.equal(name);
      expect(Grandchild).to.not.have.property('secondGenerationInherited');
    });
  });
});
