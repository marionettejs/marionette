import { Events, extend } from 'marionette';
import assignOwn, { setProperty } from './assign-own.js';
import disposeAll from './dispose-all.js';

let modelId = 0;
const modelOwners = new WeakMap();

export function addModelOwner(model, owner, release) {
  let owners = modelOwners.get(model);
  if (!owners) {
    owners = new Map();
    modelOwners.set(model, owners);
  }
  owners.set(owner, release);
}

export function removeModelOwner(model, owner) {
  const owners = modelOwners.get(model);
  if (!owners) { return; }
  owners.delete(owner);
  if (!owners.size) { modelOwners.delete(model); }
}

function getDefaults(model) {
  const defaults = model.defaults;
  return typeof defaults === 'function' ? defaults.call(model) : defaults;
}

function releaseModelOwners(model) {
  const owners = modelOwners.get(model);
  if (!owners) { return; }
  disposeAll([...owners].map(([owner, release]) => () => {
    // An earlier release can remove the Model from another owner.
    if (owners.has(owner)) { release(); }
  }));
}

function sameIdentity(left, right) {
  return left == null && right == null || left === right ||
    Number.isNaN(left) && Number.isNaN(right);
}

function noChange(model) {
  if (!model._isDestroyed) { model.changed = {}; }
  return model;
}

function update(model, attributes, options = {}, removed = []) {
  if (model._isDestroyed) { return model; }
  options = options == null ? {} : options;
  const previous = {};
  const changed = {};
  const changedKeys = [];

  for (const key of removed) {
    if (!Object.hasOwn(model.attributes, key)) { continue; }
    setProperty(previous, key, model.attributes[key]);
    setProperty(changed, key, undefined);
    changedKeys.push(key);
  }

  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    const hadKey = Object.hasOwn(model.attributes, key);
    if (hadKey && Object.is(model.attributes[key], value)) { continue; }
    if (hadKey) { setProperty(previous, key, model.attributes[key]); }
    setProperty(changed, key, value);
    changedKeys.push(key);
  }

  if (!changedKeys.length) {
    model.changed = changed;
    return model;
  }
  if (modelOwners.has(model)) {
    const currentId = model.get(model.idAttribute);
    const nextId = removed.includes(model.idAttribute) ? undefined :
      Object.hasOwn(attributes, model.idAttribute) ? attributes[model.idAttribute] : currentId;
    if (!sameIdentity(model.id, nextId)) {
      throw new TypeError('@marionette/data cannot change a Model id while it belongs to a Collection.');
    }
  }
  for (const key of removed) { delete model.attributes[key]; }
  assignOwn(model.attributes, attributes);
  model.id = model.get(model.idAttribute);
  model.changed = changed;

  if (!options.silent) {
    const change = assignOwn({}, options, { changed, previous });
    for (const key of changedKeys) {
      model.triggerMethod(`change:${ key }`, model, changed[key], change);
    }
    model.triggerMethod('change', model, change);
  }

  return model;
}

const Model = function(attributes = {}, options = {}) {
  this.cid = `mnd${ ++modelId }`;
  this.attributes = {};
  try {
    const defaults = getDefaults(this);
    update(this, assignOwn({}, defaults, attributes), { silent: true });
    this.changed = {};
    this.initialize(attributes, options);
  } catch (error) {
    disposeAll([
      () => this.off(),
      () => this.stopListening(),
      () => releaseModelOwners(this)
    ], error);
  }
};

Model.extend = extend;

assignOwn(Model.prototype, Events, {
  idAttribute: 'id',
  _isDestroyed: false,

  initialize() {},

  get(key) {
    return Object.hasOwn(this.attributes, key) ? this.attributes[key] : undefined;
  },

  has(key) {
    return Object.hasOwn(this.attributes, key);
  },

  set(key, value, options) {
    if (key == null) { return noChange(this); }
    const attributes = typeof key === 'object' ? key : { [key]: value };
    return update(this, attributes, typeof key === 'object' ? value : options);
  },

  unset(key, options) {
    return key == null ? noChange(this) : update(this, {}, options, [key]);
  },

  clear(options) {
    return update(this, {}, options, Object.keys(this.attributes));
  },

  reset(attributes = {}, options) {
    if (this._isDestroyed) { return this; }
    const next = assignOwn({}, getDefaults(this), attributes);
    const removed = Object.keys(this.attributes).filter(key => !Object.hasOwn(next, key));
    return update(this, next, options, removed);
  },

  toJSON() {
    return assignOwn({}, this.attributes);
  },

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy(options) {
    if (this._isDestroyed) { return this; }
    this._isDestroyed = true;
    disposeAll([
      () => this.off(),
      () => this.stopListening(),
      () => this.triggerMethod('destroy', this, options),
      () => releaseModelOwners(this)
    ]);
    return this;
  }
});

export default Model;
