import { each, reduce, isString, result } from 'underscore';
// allows for the use of the @ui. syntax within
// a given key for triggers and events
// swaps the @ui with the associated selector.
// Returns a new, non-mutated, parsed events hash.
const normalizeUIKeys = function(hash, ui) {
  return reduce(hash, (memo, val, key) => {
    const normalizedKey = normalizeUIString(key, ui);
    memo[normalizedKey] = val;
    return memo;
  }, {});
};

const uiRegEx = /@ui\.[a-zA-Z-_$0-9]*/g;

// utility method for parsing @ui. syntax strings
// into associated selector
const normalizeUIString = function(uiString, ui) {
  return uiString.replace(uiRegEx, (r) => {
    return ui[r.slice(4)];
  });
};

// allows for the use of the @ui. syntax within
// a given value for regions
// swaps the @ui with the associated selector
const normalizeUIValues = function(hash, ui, property) {
  each(hash, (val, key) => {
    if (isString(val)) {
      hash[key] = normalizeUIString(val, ui);
    } else if (val) {
      const propertyVal = val[property];
      if (isString(propertyVal)) {
        val[property] = normalizeUIString(propertyVal, ui);
      }
    }
  });
  return hash;
};

export default {

  // normalize the keys of passed hash with the views `ui` selectors.
  // `{"@ui.foo": "bar"}`
  normalizeUIKeys(hash, uiBindings = this._getUIBindings()) {
    return normalizeUIKeys(hash, uiBindings);
  },

  // normalize the passed string with the views `ui` selectors.
  // `"@ui.bar"`
  normalizeUIString(uiString, uiBindings = this._getUIBindings()) {
    return normalizeUIString(uiString, uiBindings);
  },

  // normalize the values of passed hash with the views `ui` selectors.
  // `{foo: "@ui.bar"}`
  normalizeUIValues(hash, property, uiBindings = this._getUIBindings()) {
    return normalizeUIValues(hash, uiBindings, property);
  },

  _getUIBindings() {
    const uiBindings = result(this, '_uiBindings');
    return uiBindings || result(this, 'ui');
  },

  // This method binds the elements specified in the "ui" hash inside the view's code with
  // the associated jQuery selectors.
  _bindUIElements() {
    if (!this.ui) { return; }

    // store the ui hash in _uiBindings so they can be reset later
    // and so re-rendering the view will be able to find the bindings
    if (!this._uiBindings) {
      this._uiBindings = this.ui;
    }

    // get the bindings result, as a function or otherwise
    const bindings = result(this, '_uiBindings');

    // empty the ui so we don't have anything to start with
    this._ui = {};

    // bind each of the selectors
    each(bindings, (selector, key) => {
      this._ui[key] = this.$(selector);
    });

    this.ui = this._ui;
  },

  _unbindUIElements() {
    if (!this.ui || !this._uiBindings) { return; }

    // delete all of the existing ui bindings
    each(this.ui, ($el, name) => {
      delete this.ui[name];
    });

    // reset the ui element to the original bindings configuration
    this.ui = this._uiBindings;
    delete this._uiBindings;
    delete this._ui;
  },

  _getUI(name) {
    return this._ui[name];
  }
};
