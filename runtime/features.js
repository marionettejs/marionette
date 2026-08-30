import MarionetteError from '../utils/error.js';

// Add Feature flags here
// e.g. 'class' => false
const FEATURES = {
  childViewEventPrefix: false,
  triggersStopPropagation: true,
  triggersPreventDefault: true
};

function isEnabled(name) {
  return !!FEATURES[name];
}

function setEnabled(name, state) {
  if (typeof name !== 'string') {
    throw new MarionetteError({
      code: 'MN0027',
      message: 'The feature name must be a documented Marionette feature name.'
    });
  }

  if (!Object.hasOwn(FEATURES, name)) {
    throw new MarionetteError({
      code: 'MN0027',
      message: `The feature "${name}" is not a documented Marionette feature.`
    });
  }

  return FEATURES[name] = state;
}

export {
  FEATURES,
  setEnabled,
  isEnabled
};
