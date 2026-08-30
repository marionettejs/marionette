import { FEATURES, setEnabled, isEnabled } from '../../../runtime/features';

const invalidFeatureNames = ['', ' '];
const initialFeatures = { ...FEATURES };

describe('features', function() {
  afterEach(function() {
    for (const name of Object.keys(FEATURES)) {
      if (!Object.hasOwn(initialFeatures, name)) {
        delete FEATURES[name];
      }
    }

    for (const name of Object.keys(initialFeatures)) {
      FEATURES[name] = initialFeatures[name];
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
      for (const name of [undefined, null, 0, {}, Object.create(null), Symbol('feature')]) {
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

    it('preserves custom feature flags, including prototype property names', function() {
      for (const name of ['applicationOwned', 'constructor', 'toString', '__proto__', 'hasOwnProperty']) {
        expect(setEnabled(name, true)).to.be.true;
        expect(isEnabled(name)).to.be.true;
        expect(Object.hasOwn(FEATURES, name)).to.be.true;
      }
    });

    it('rejects blank feature names without mutation', function() {
      const featureSnapshot = { ...FEATURES };

      for (const name of invalidFeatureNames) {
        expect(() => setEnabled(name, true))
          .to.throw()
          .with.property('code', 'MN0027');
      }

      expect(FEATURES).to.deep.equal(featureSnapshot);
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
