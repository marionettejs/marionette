import { MarionetteError, setProperty, getValue, isString } from '@marionette/utils';

export type UISelectors = Record<string, string>;
export type UIBindings = UISelectors | (() => UISelectors);
export interface UIHost<Query extends ArrayLike<Element> = ArrayLike<Element>> {
  ui?: UIBindings | Record<string, Query>;
  _uiBindings?: UIBindings;
  _ui?: Record<string, Query>;
  $(selector: string): Query;
  _getUIBindings(): UISelectors | undefined;
}

// allows for the use of the @ui. syntax within
// a given key for triggers and events
// swaps the @ui with the associated selector.
// Returns a new, non-mutated, parsed events hash.
const normalizeUIKeys = function<Value>(hash: Record<string, Value> | null | undefined, ui?: UISelectors) {
  const normalizedHash: Record<string, Value> = {};
  if (!hash) { return normalizedHash; }

  for (const key of Object.keys(hash)) {
    const normalizedKey = normalizeUIString(key, ui);
    setProperty(normalizedHash, normalizedKey, hash[key]);
  }
  return normalizedHash;
};

const uiRegEx = /@ui\.[a-zA-Z-_$0-9]*/g;
const hasOwnProperty = Object.prototype.hasOwnProperty;

// utility method for parsing @ui. syntax strings
// into associated selector
const normalizeUIString = function(uiString: string, ui?: UISelectors) {
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

    return selector as string;
  });
};

// allows for the use of the @ui. syntax within
// a given value for regions
// swaps the @ui with the associated selector
const normalizeUIValues = function<Hash extends object>(hash: Hash, ui: UISelectors | undefined, property?: string) {
  for (const key of Object.keys(hash)) {
    const val = (hash as Record<string, unknown>)[key];
    if (isString(val)) {
      (hash as Record<string, unknown>)[key] = normalizeUIString(val as string, ui);
    } else if (val) {
      const propertyVal = (val as Record<string, unknown>)[property as string];
      if (isString(propertyVal)) {
        (val as Record<string, unknown>)[property as string] = normalizeUIString(propertyVal as string, ui);
      }
    }
  }
  return hash;
};

export default {

  // normalize the keys of passed hash with the views `ui` selectors.
  // `{"@ui.foo": "bar"}`
  normalizeUIKeys<Value>(this: UIHost, hash: Record<string, Value> | null | undefined, uiBindings = this._getUIBindings()) {
    return normalizeUIKeys(hash, uiBindings);
  },

  // normalize the passed string with the views `ui` selectors.
  // `"@ui.bar"`
  normalizeUIString(this: UIHost, uiString: string, uiBindings = this._getUIBindings()) {
    return normalizeUIString(uiString, uiBindings);
  },

  // normalize the values of passed hash with the views `ui` selectors.
  // `{foo: "@ui.bar"}`
  normalizeUIValues<Hash extends object>(this: UIHost, hash: Hash, property?: string, uiBindings = this._getUIBindings()) {
    return normalizeUIValues(hash, uiBindings, property);
  },

  _getUIBindings(this: UIHost): UISelectors | undefined {
    const uiBindings = getValue(this, '_uiBindings');
    return (uiBindings || getValue(this, 'ui')) as UISelectors | undefined;
  },

  // Bind each element specified in the "ui" hash to the configured DOM query result.
  _bindUIElements<Query extends ArrayLike<Element>>(this: UIHost<Query>) {
    if (!this.ui) { return; }

    // store the ui hash in _uiBindings so they can be reset later
    // and so re-rendering the view will be able to find the bindings
    if (!this._uiBindings) {
      this._uiBindings = this.ui as UIBindings;
    }

    // get the bindings result, as a function or otherwise
    const bindings = (getValue(this, '_uiBindings') ?? {}) as UISelectors;

    // empty the ui so we don't have anything to start with
    this._ui = {};

    // bind each of the selectors
    for (const key of Object.keys(bindings)) {
      setProperty(this._ui, key, this.$(bindings[key]));
    }

    this.ui = this._ui;
  },

  _unbindUIElements(this: UIHost) {
    if (!this.ui || !this._uiBindings) { return; }

    // delete all of the existing ui bindings
    for (const name of Object.keys(this.ui)) {
      delete (this.ui as Record<string, unknown>)[name];
    }

    // reset the ui element to the original bindings configuration
    this.ui = this._uiBindings;
    delete this._uiBindings;
    delete this._ui;
  },

  _getUI<Query extends ArrayLike<Element>>(this: UIHost<Query>, name: string): Query | undefined {
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
