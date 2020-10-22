// Add Feature flags here
// e.g. 'class' => false
const FEATURES = {
  childViewEventPrefix: false,
  triggersStopPropagation: true,
  triggersPreventDefault: true,
  DEV_MODE: false
};

function isEnabled(name) {
  return !!FEATURES[name];
}

function setEnabled(name, state) {
  return FEATURES[name] = state;
}

export {
  FEATURES,
  setEnabled,
  isEnabled
};
