import Application from '../../modules/application';
import MnObject from '../../modules/object';
import CommonMixin from '../../mixins/common';
import DestroyMixin from '../../mixins/destroy';
import RadioMixin from '../../mixins/radio';

function composedKeys(finalKeys) {
  const keys = [];

  [CommonMixin, DestroyMixin, RadioMixin].forEach(mixin => {
    Object.keys(mixin).forEach(key => {
      if (!keys.includes(key)) { keys.push(key); }
    });
  });

  finalKeys.forEach(key => {
    if (!keys.includes(key)) { keys.push(key); }
  });

  return keys;
}

function expectAssignmentDescriptor(target, key, value) {
  expect(Object.getOwnPropertyDescriptor(target, key)).to.deep.equal({
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
}

describe('Object and Application prototype composition', function() {
  it('preserves own method order, identities, descriptors, and constructors', function() {
    const objectFinalKeys = ['cidPrefix'];
    const applicationFinalKeys = [
      'cidPrefix',
      'start',
      'regionClass',
      '_initRegion',
      'getRegion',
      'showView',
      'getView'
    ];

    expect(Object.keys(MnObject.prototype)).to.deep.equal(composedKeys(objectFinalKeys));
    expect(Object.keys(Application.prototype)).to.deep.equal(composedKeys(applicationFinalKeys));
    expect(MnObject.prototype._setOptions).to.equal(CommonMixin._setOptions);
    expect(MnObject.prototype.destroy).to.equal(DestroyMixin.destroy);
    expect(MnObject.prototype._initRadio).to.equal(RadioMixin._initRadio);
    expect(Application.prototype._setOptions).to.equal(CommonMixin._setOptions);
    expect(Application.prototype.destroy).to.equal(DestroyMixin.destroy);
    expect(Application.prototype._initRadio).to.equal(RadioMixin._initRadio);
    [CommonMixin, DestroyMixin, RadioMixin].forEach(mixin => {
      Object.keys(mixin).forEach(key => {
        expectAssignmentDescriptor(MnObject.prototype, key, mixin[key]);
        expectAssignmentDescriptor(Application.prototype, key, mixin[key]);
      });
    });
    expectAssignmentDescriptor(MnObject.prototype, 'cidPrefix', 'mno');
    expectAssignmentDescriptor(Application.prototype, 'cidPrefix', 'mna');
    expect(Object.getOwnPropertyDescriptor(MnObject.prototype, 'constructor')).to.deep.equal({
      configurable: true,
      enumerable: false,
      value: MnObject,
      writable: true
    });
    expect(Object.getOwnPropertyDescriptor(Application.prototype, 'constructor')).to.deep.equal({
      configurable: true,
      enumerable: false,
      value: Application,
      writable: true
    });
  });

  it('does not compose inherited enumerable source pollution', async function() {
    const mixins = [CommonMixin, DestroyMixin, RadioMixin];
    const prototypes = mixins.map(Object.getPrototypeOf);
    const protoValue = { safe: true };
    mixins.forEach(mixin => {
      const pollutedPrototype = {};
      Object.defineProperty(pollutedPrototype, 'inheritedPollution', {
        enumerable: true,
        get() {
          throw new Error('inherited pollution was read');
        }
      });
      Object.setPrototypeOf(mixin, pollutedPrototype);
    });
    Object.defineProperty(CommonMixin, '__proto__', {
      configurable: true,
      enumerable: true,
      value: protoValue,
      writable: true
    });

    let IsolatedObject;
    let IsolatedApplication;
    try {
      ({ default: IsolatedObject } = await import('../../modules/object.js?composition-test'));
      ({ default: IsolatedApplication } = await import('../../modules/application.js?composition-test'));
    } finally {
      Reflect.deleteProperty(CommonMixin, '__proto__');
      mixins.forEach((mixin, index) => Object.setPrototypeOf(mixin, prototypes[index]));
    }

    expect(IsolatedObject).to.not.equal(MnObject);
    expect(IsolatedApplication).to.not.equal(Application);
    expect(IsolatedObject.prototype).to.not.have.own.property('inheritedPollution');
    expect(IsolatedApplication.prototype).to.not.have.own.property('inheritedPollution');
    [IsolatedObject.prototype, IsolatedApplication.prototype].forEach(prototype => {
      expect(Object.getPrototypeOf(prototype)).to.equal(Object.prototype);
      expect(Object.getOwnPropertyDescriptor(prototype, '__proto__')).to.deep.equal({
        configurable: true,
        enumerable: true,
        value: protoValue,
        writable: true
      });
    });
  });
});
