// Marionette.getOption
// --------------------

// Retrieve an object, function or other value from the
// object or its `options`, with `options` taking precedence.
const getOption = function(optionName) {
  if (!optionName) { return; }
  if (this.options && (this.options[optionName] !== undefined)) {
    return this.options[optionName];
  } else {
    return this[optionName];
  }
};

export default getOption;
