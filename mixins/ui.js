import MarionetteError from '../utils/error.js';
import { setProperty } from '../utils/assign-in.js';
import eachOwn from '../utils/each-own.js';
import getValue from '../utils/get-value.js';
import isString from '../utils/is-string.js';
// allows for the use of the @ui. syntax within
// a given key for triggers and events
// swaps the @ui with the associated selector.
// Returns a new, non-mutated, parsed events hash.
const normalizeUIKeys = function(hash, ui) {
  const normalizedHash = {};
  eachOwn(hash, (val, key) => {
    const normalizedKey = normalizeUIString(key, ui);
    setProperty(normalizedHash, normalizedKey, val);
  });
  return normalizedHash;
};

const uiRegEx = /@ui\.[a-zA-Z-_$0-9]*/g;
const hasOwnProperty = Object.prototype.hasOwnProperty;

// utility method for parsing @ui. syntax strings
// into associated selector
const normalizeUIString = function(uiString, ui) {
  return uiString.replace(uiRegEx, (r) => {
    const name = r.slice(4);

    if (!name) {
      throw new MarionetteError({
        code: 'MN0018',
        message: 'The ui reference must include a key name.'
      });
    }

    const hasSelector = ui && hasOwnProperty.call(ui, name);
    const selector = hasSelector ? ui[name] : undefined;

    if (!hasSelector) {
      throw new MarionetteError({
        code: 'MN0018',
        message: `The ui reference "${name}" must be declared as an own ui key.`
      });
    }

    if (!isString(selector)) {
      throw new MarionetteError({
        code: 'MN0018',
        message: `The ui reference "${name}" must be a string selector.`
      });
    }

    return selector;
  });
};

// allows for the use of the @ui. syntax within
// a given value for regions
// swaps the @ui with the associated selector
const normalizeUIValues = function(hash, ui, property) {
  eachOwn(hash, (val, key) => {
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
    const uiBindings = getValue(this, '_uiBindings');
    return uiBindings || getValue(this, 'ui');
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
    const bindings = getValue(this, '_uiBindings');

    // empty the ui so we don't have anything to start with
    this._ui = {};

    // bind each of the selectors
    eachOwn(bindings, (selector, key) => {
      setProperty(this._ui, key, this.$(selector));
    });

    this.ui = this._ui;
  },

  _unbindUIElements() {
    if (!this.ui || !this._uiBindings) { return; }

    // delete all of the existing ui bindings
    eachOwn(this.ui, ($el, name) => {
      delete this.ui[name];
    });

    // reset the ui element to the original bindings configuration
    this.ui = this._uiBindings;
    delete this._uiBindings;
    delete this._ui;
  },

  _getUI(name) {
    if (!this.ui) {
      throw new MarionetteError({
        code: 'MN0023',
        message: 'A ui map must be declared before calling getUI().'
      });
    }

    if (!this._ui) {
      throw new MarionetteError({
        code: 'MN0023',
        message: 'UI elements must be bound before calling getUI().'
      });
    }

    return this._ui[name];
  }
};
