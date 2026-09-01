// State
// -----

import { assignOwn, setProperty } from '../utils/assign-in.js';
import { eventSplitter } from '../utils/build-event-args.js';
import MarionetteError from '../utils/error.js';
import extend from '../utils/extend.js';
import getValue from '../utils/get-value.js';
import uniqueId from '../utils/unique-id.js';
import EventsMixin from '../mixins/events.js';

const objectKeys = Object.keys;

function addChange(changedKeys, changed, previous, name, previousValue, value) {
  changedKeys.push(name);
  setProperty(changed, name, value);
  setProperty(previous, name, previousValue);
}

function validateKeys(keys) {
  for (let index = 0, length = keys.length; index < length; index++) {
    const key = keys[index];
    if (typeof key !== 'string' || !eventSplitter.test(key)) { continue; }

    throw new MarionetteError({
      code: 'MN0034',
      message: 'State keys cannot contain whitespace.',
      url: 'marionette.state.html#state-keys'
    });
  }
}

function updateState(state, attributes, options, removedKeys = []) {
  if (state._isDestroyed) { return state; }

  const current = state._attributes;
  const changed = {};
  const previous = {};
  const changedKeys = [];
  const attributeKeys = objectKeys(attributes);

  validateKeys(removedKeys);
  validateKeys(attributeKeys);

  for (let index = 0, length = removedKeys.length; index < length; index++) {
    const name = removedKeys[index];
    if (!Object.hasOwn(current, name)) { continue; }

    addChange(changedKeys, changed, previous, name, current[name], undefined);
  }

  for (let index = 0, length = attributeKeys.length; index < length; index++) {
    const name = attributeKeys[index];
    const value = attributes[name];
    if (Object.hasOwn(current, name) && Object.is(current[name], value)) { continue; }

    addChange(changedKeys, changed, previous, name, current[name], value);
  }

  if (!changedKeys.length) { return state; }

  for (let index = 0, length = removedKeys.length; index < length; index++) {
    delete current[removedKeys[index]];
  }
  assignOwn(current, attributes);

  if (options?.silent) { return state; }

  const change = assignOwn({}, options, { changed, previous });
  for (let index = 0, length = changedKeys.length; index < length; index++) {
    const name = changedKeys[index];
    state.trigger(`change:${ name }`, state, changed[name], change);
  }
  state.trigger('change', state, change);

  return state;
}

const State = function(attributes) {
  this.cid = uniqueId(this.cidPrefix);
  const stateAttributes = assignOwn({}, getValue(this, 'defaults'), attributes);
  validateKeys(objectKeys(stateAttributes));
  this._attributes = stateAttributes;
  this.initialize.apply(this, arguments);
};

State.extend = extend;

assignOwn(State.prototype, EventsMixin, {
  cidPrefix: 'mns',
  _isDestroyed: false,

  initialize() {},

  get(key) {
    return Object.hasOwn(this._attributes, key) ? this._attributes[key] : undefined;
  },

  has(key) {
    return Object.hasOwn(this._attributes, key);
  },

  set(key, value, options) {
    if (key == null) { return this; }

    let attributes;
    if (typeof key === 'object') {
      attributes = key;
      options = value;
    } else {
      attributes = { [key]: value };
    }

    return updateState(this, attributes, options);
  },

  unset(key, options) {
    if (key == null) { return this; }

    return updateState(this, {}, options, [key]);
  },

  reset(attributes = {}, options) {
    if (this._isDestroyed) { return this; }

    const nextAttributes = assignOwn({}, getValue(this, 'defaults'), attributes);
    const removedKeys = objectKeys(this._attributes)
      .filter(key => !Object.hasOwn(nextAttributes, key));

    return updateState(this, nextAttributes, options, removedKeys);
  },

  toJSON() {
    return assignOwn({}, this._attributes);
  },

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy() {
    if (this._isDestroyed) { return this; }

    this._isDestroyed = true;
    this.stopListening();
    this.off();

    return this;
  }
});

export default State;
