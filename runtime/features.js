import MarionetteError from '../utils/error.js';

// Add Feature flags here
// e.g. 'class' => false
const FEATURES = {
  __proto__: null,
  childViewEventPrefix: false,
  triggersStopPropagation: true,
  triggersPreventDefault: true
};

function isEnabled(name) {
  return typeof name === 'string' && !!FEATURES[name];
}

function setEnabled(name, state) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new MarionetteError({
      code: 'MN0027',
      message: 'The feature name must be a non-empty string.'
    });
  }

  return FEATURES[name] = state;
}

export {
  FEATURES,
  setEnabled,
  isEnabled
};
