import Application from '../../src/modules/application';
import MnObject from '../../src/modules/object';
import CommonMixin from '../../src/mixins/common';
import DestroyMixin from '../../src/mixins/destroy';
import RadioMixin from '../../src/mixins/radio';
import StateMixin from '../../src/mixins/state';

function composedKeys(mixins, finalKeys) {
  const keys = [];

  mixins.forEach(mixin => {
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
      '_lifecycleState',
      'isRunning',
      'start',
      'stop',
      'restart',
      'addChildApp',
      'removeChildApp',
      'hasChildApp',
      'getChildApp',
      'getChildApps',
      'getName',
      'regionClass',
      '_initRegion',
      'getRegion',
      '_onRootRegionEmpty',
      'showView',
      'getView'
    ];
    const sharedMixins = [CommonMixin, DestroyMixin, RadioMixin];

    expect(Object.keys(MnObject.prototype))
      .to.deep.equal(composedKeys([...sharedMixins, StateMixin], objectFinalKeys));
    expect(Object.keys(Application.prototype))
      .to.deep.equal(composedKeys([...sharedMixins, StateMixin], applicationFinalKeys));
    expect(Application.prototype).to.not.have.property('getParentApp');
    expect(Application.prototype).to.not.have.property('getRootApp');
    ['reply', 'replyOnce', 'stopReplying', 'request'].forEach(methodName => {
      expect(MnObject.prototype).to.not.have.property(methodName);
      expect(Application.prototype).to.not.have.property(methodName);
    });
    expect(MnObject.prototype._setOptions).to.equal(CommonMixin._setOptions);
    expect(MnObject.prototype.destroy).to.equal(DestroyMixin.destroy);
    expect(MnObject.prototype._initRadio).to.equal(RadioMixin._initRadio);
    expect(MnObject.prototype.getState).to.equal(StateMixin.getState);
    expect(Application.prototype._setOptions).to.equal(CommonMixin._setOptions);
    expect(Application.prototype.destroy).to.not.equal(DestroyMixin.destroy);
    expect(Application.prototype._initRadio).to.equal(RadioMixin._initRadio);
    expect(Application.prototype.getState).to.equal(StateMixin.getState);
    [CommonMixin, DestroyMixin, RadioMixin].forEach(mixin => {
      Object.keys(mixin).forEach(key => {
        expectAssignmentDescriptor(MnObject.prototype, key, mixin[key]);
        if (key !== 'destroy') {
          expectAssignmentDescriptor(Application.prototype, key, mixin[key]);
        }
      });
    });
    Object.keys(StateMixin).forEach(key => {
      expectAssignmentDescriptor(MnObject.prototype, key, StateMixin[key]);
      expectAssignmentDescriptor(Application.prototype, key, StateMixin[key]);
    });
    expectAssignmentDescriptor(MnObject.prototype, 'cidPrefix', 'mno');
    expectAssignmentDescriptor(Application.prototype, 'cidPrefix', 'mna');
    expectAssignmentDescriptor(Application.prototype, 'destroy', Application.prototype.destroy);
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
    const commonProtoDescriptor = Object.getOwnPropertyDescriptor(CommonMixin, '__proto__');
    const protoValue = { safe: true };
    const mutatedMixins = [];
    let commonProtoMutated = false;
    let IsolatedObject;
    let IsolatedApplication;
    let primaryFailed = false;
    let primaryError;
    try {
      mixins.forEach(mixin => {
        const pollutedPrototype = {};
        Object.defineProperty(pollutedPrototype, 'inheritedPollution', {
          enumerable: true,
          get() {
            throw new Error('inherited pollution was read');
          }
        });
        Object.setPrototypeOf(mixin, pollutedPrototype);
        mutatedMixins.push(mixin);
      });
      Object.defineProperty(CommonMixin, '__proto__', {
        configurable: true,
        enumerable: true,
        value: protoValue,
        writable: true
      });
      commonProtoMutated = true;

      ({ default: IsolatedObject } = await import('../../src/modules/object.js?composition-test'));
      ({ default: IsolatedApplication } = await import('../../src/modules/application.js?composition-test'));
    } catch (error) {
      primaryFailed = true;
      primaryError = error;
    }

    let cleanupFailed = false;
    let cleanupError;
    const restore = callback => {
      try {
        callback();
      } catch (error) {
        if (!cleanupFailed) {
          cleanupFailed = true;
          cleanupError = error;
        }
      }
    };

    if (commonProtoMutated) {
      restore(() => {
        if (commonProtoDescriptor) {
          Object.defineProperty(CommonMixin, '__proto__', commonProtoDescriptor);
        } else if (!Reflect.deleteProperty(CommonMixin, '__proto__')) {
          throw new Error('Unable to restore CommonMixin.__proto__');
        }
      });
    }
    for (let index = mutatedMixins.length - 1; index >= 0; index--) {
      restore(() => Object.setPrototypeOf(mutatedMixins[index], prototypes[index]));
    }

    if (primaryFailed) { throw primaryError; }
    if (cleanupFailed) { throw cleanupError; }

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
