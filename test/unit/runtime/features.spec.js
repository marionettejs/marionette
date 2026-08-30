import { FEATURES, setEnabled, isEnabled } from '../../../runtime/features';
import MarionetteError from '../../../utils/error';

const invalidFeatureNames = ['', ' ', 'applicationOwned', 'constructor', 'toString', '__proto__', 'hasOwnProperty'];
const initialFeatures = { ...FEATURES };

describe('features', function() {
  afterEach(function() {
    for (const name of Object.keys(FEATURES)) {
      if (!Object.hasOwn(initialFeatures, name)) {
        delete FEATURES[name];
        continue;
      }

      setEnabled(name, initialFeatures[name]);
    }
  });

  describe('#isEnabled', function() {
    it('returns the configured state of each Marionette feature', function() {
      for (const name of Object.keys(FEATURES)) {
        const initialState = FEATURES[name];

        setEnabled(name, !initialState);
        expect(isEnabled(name)).to.equal(!initialState);
      }
    });

    it('remains disabled for unknown names', function() {
      for (const name of invalidFeatureNames) {
        expect(isEnabled(name)).to.be.false;
      }
    });

    it('remains disabled for non-string names', function() {
      for (const name of [undefined, null, 0, {}, Symbol('feature')]) {
        expect(isEnabled(name)).to.be.false;
      }
    });
  });

  describe('#setEnabled', function() {
    it('sets and returns the exact state for a known feature', function() {
      const state = {};

      expect(setEnabled('childViewEventPrefix', state)).to.equal(state);
      expect(FEATURES.childViewEventPrefix).to.equal(state);
    });

    it('rejects unknown feature names without mutation', function() {
      const featureSnapshot = { ...FEATURES };
      const prototype = Object.getPrototypeOf(FEATURES);

      for (const name of invalidFeatureNames) {
        expect(() => setEnabled(name, true))
          .to.throw()
          .with.property('code', 'MN0027');
        expect(Object.hasOwn(FEATURES, name)).to.be.false;
      }

      expect(FEATURES).to.deep.equal(featureSnapshot);
      expect(Object.getPrototypeOf(FEATURES)).to.equal(prototype);
    });

    it('provides the rejected feature name on MarionetteError', function() {
      let error;

      try {
        setEnabled('applicationOwned', true);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(MarionetteError);
      expect(error).to.have.property('code', 'MN0027');
      expect(error.message).to.contain('applicationOwned');
    });

    it('rejects non-string feature names with a stable code', function() {
      const featureSnapshot = { ...FEATURES };

      for (const name of [undefined, null, 0, {}, Symbol('feature')]) {
        expect(() => setEnabled(name, true))
          .to.throw()
          .with.property('code', 'MN0027');
      }

      expect(FEATURES).to.deep.equal(featureSnapshot);
    });
  });
});
