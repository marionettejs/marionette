import { Events, extend } from 'marionette';

function setProperty(target, key, value) {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    target[key] = value;
  }
}
function assignOwn(target, ...sources) {
  for (const source of sources) {
    const type = typeof source;
    if (source == null || type !== 'object' && type !== 'function') {
      continue;
    }
    for (const key of Object.keys(Object(source))) {
      setProperty(target, key, source[key]);
    }
  }
  return target;
}

function disposeAll(disposers, error) {
  let hasError = arguments.length > 1;
  for (let index = disposers.length; index--;) {
    try {
      disposers[index]?.();
    } catch (disposalError) {
      if (!hasError) {
        error = disposalError;
        hasError = true;
      }
    }
  }
  if (hasError) {
    throw error;
  }
}

let modelId = 0;
const modelOwners = new WeakMap();
function addModelOwner(model, owner, release) {
  let owners = modelOwners.get(model);
  if (!owners) {
    owners = new Map();
    modelOwners.set(model, owners);
  }
  owners.set(owner, release);
}
function removeModelOwner(model, owner) {
  const owners = modelOwners.get(model);
  if (!owners) {
    return;
  }
  owners.delete(owner);
  if (!owners.size) {
    modelOwners.delete(model);
  }
}
function getDefaults(model) {
  const defaults = model.defaults;
  return typeof defaults === 'function' ? defaults.call(model) : defaults;
}
function releaseModelOwners(model) {
  const owners = modelOwners.get(model);
  if (!owners) {
    return;
  }
  disposeAll([...owners.values()]);
}
function sameIdentity(left, right) {
  return left == null && right == null || left === right || Number.isNaN(left) && Number.isNaN(right);
}
function noChange(model) {
  if (!model._isDestroyed) {
    model.changed = {};
  }
  return model;
}
function update(model, attributes, options = {}, removed = []) {
  if (model._isDestroyed) {
    return model;
  }
  options = options == null ? {} : options;
  const previous = {};
  const changed = {};
  const changedKeys = [];
  for (const key of removed) {
    if (!Object.hasOwn(model.attributes, key)) {
      continue;
    }
    setProperty(previous, key, model.attributes[key]);
    setProperty(changed, key, undefined);
    changedKeys.push(key);
  }
  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    const hadKey = Object.hasOwn(model.attributes, key);
    if (hadKey && Object.is(model.attributes[key], value)) {
      continue;
    }
    if (hadKey) {
      setProperty(previous, key, model.attributes[key]);
    }
    setProperty(changed, key, value);
    changedKeys.push(key);
  }
  if (!changedKeys.length) {
    model.changed = changed;
    return model;
  }
  if (modelOwners.has(model)) {
    const currentId = model.get(model.idAttribute);
    const nextId = removed.includes(model.idAttribute) ? undefined : Object.hasOwn(attributes, model.idAttribute) ? attributes[model.idAttribute] : currentId;
    if (!sameIdentity(model.id, nextId)) {
      throw new TypeError('@marionette/data cannot change a Model id while it belongs to a Collection.');
    }
  }
  for (const key of removed) {
    delete model.attributes[key];
  }
  assignOwn(model.attributes, attributes);
  model.id = model.get(model.idAttribute);
  model.changed = changed;
  if (!options.silent) {
    const change = assignOwn({}, options, {
      changed,
      previous
    });
    for (const key of changedKeys) {
      model.triggerMethod(`change:${key}`, model, changed[key], change);
    }
    model.triggerMethod('change', model, change);
  }
  return model;
}
const Model = function (attributes = {}, options = {}) {
  this.cid = `mnd${++modelId}`;
  this.attributes = {};
  try {
    const defaults = getDefaults(this);
    update(this, assignOwn({}, defaults, attributes), {
      silent: true
    });
    this.changed = {};
    this.initialize(attributes, options);
  } catch (error) {
    disposeAll([() => this.off(), () => this.stopListening(), () => releaseModelOwners(this)], error);
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
    if (key == null) {
      return noChange(this);
    }
    const attributes = typeof key === 'object' ? key : {
      [key]: value
    };
    return update(this, attributes, typeof key === 'object' ? value : options);
  },
  unset(key, options) {
    return key == null ? noChange(this) : update(this, {}, options, [key]);
  },
  clear(options) {
    return update(this, {}, options, Object.keys(this.attributes));
  },
  reset(attributes = {}, options) {
    if (this._isDestroyed) {
      return this;
    }
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
    if (this._isDestroyed) {
      return this;
    }
    this._isDestroyed = true;
    disposeAll([() => this.off(), () => this.stopListening(), () => this.triggerMethod('destroy', this, options), () => releaseModelOwners(this)]);
    return this;
  }
});

const collectionObservers = new WeakMap();
function observeCollection(collection, callback, context) {
  const type = typeof collection;
  const isObject = collection != null && (type === 'object' || type === 'function');
  if (!isObject || typeof callback !== 'function' || !collectionObservers.has(collection)) {
    throw new TypeError('@marionette/data can observe only its own Collection instances with a callback.');
  }
  const observers = collectionObservers.get(collection);
  const observer = {
    callback,
    context
  };
  let subscribed = true;
  observers.add(observer);
  return function () {
    if (!subscribed) {
      return;
    }
    subscribed = false;
    observers.delete(observer);
  };
}
function initializeObservers(collection) {
  collectionObservers.set(collection, new Set());
}
function notifyCollection(collection, change) {
  for (const {
    callback,
    context
  } of [...collectionObservers.get(collection)]) {
    callback.call(context, change);
  }
}
function releaseObservers(collection) {
  collectionObservers.delete(collection);
}

function asArray(models) {
  if (models == null) {
    return [];
  }
  return Array.isArray(models) ? models : [models];
}
function normalizeOptions(options) {
  return options == null ? {} : options;
}
function sameValueZero(left, right) {
  return left === right || Number.isNaN(left) && Number.isNaN(right);
}
function assertUniqueModels(models) {
  const knownModels = new Set();
  const knownIds = new Set();
  for (const model of models) {
    if (knownModels.has(model) || model.id != null && knownIds.has(model.id)) {
      throw new TypeError('@marionette/data Collection models must have unique instances and ids.');
    }
    knownModels.add(model);
    if (model.id != null) {
      knownIds.add(model.id);
    }
  }
}
function releaseOwnedModel(collection, model) {
  const nextModels = collection.models.filter(current => current !== model);
  const options = {};
  const change = {
    kind: 'update',
    added: [],
    removed: [model],
    updated: []
  };
  disposeAll([() => {
    collection._notify(change);
    collection.triggerMethod('remove', model, collection, options);
    collection.triggerMethod('update', collection, {
      ...options,
      changes: change
    });
  }, () => {
    collection.models = nextModels;
    collection.length = collection.models.length;
  }, () => collection._unbindModel(model)]);
}
const Collection = function (models = [], options = {}) {
  options = normalizeOptions(options);
  this.models = [];
  this.length = 0;
  if (options.model) {
    this.model = options.model;
  }
  initializeObservers(this);
  try {
    this.reset(models, {
      silent: true
    });
    this.initialize(models, options);
  } catch (error) {
    this._isDestroyed = true;
    disposeAll([() => this.off(), () => this.stopListening(), () => releaseObservers(this), ...this.models.map(model => () => this._unbindModel(model))], error);
  }
};
Collection.extend = extend;
assignOwn(Collection.prototype, Events, {
  model: Model,
  _isDestroyed: false,
  initialize() {},
  _prepareModel(model) {
    const ModelClass = this.model;
    return model instanceof ModelClass ? model : new ModelClass(model);
  },
  _bindModel(model) {
    try {
      model.on('all', this._onModelEvent, this);
      addModelOwner(model, this, () => releaseOwnedModel(this, model));
    } catch (error) {
      disposeAll([() => removeModelOwner(model, this), () => Events.off.call(model, 'all', this._onModelEvent, this)], error);
    }
  },
  _unbindModel(model) {
    try {
      model.off('all', this._onModelEvent, this);
    } catch (error) {
      disposeAll([() => removeModelOwner(model, this), () => Events.off.call(model, 'all', this._onModelEvent, this)], error);
    }
    removeModelOwner(model, this);
  },
  _bindModels(models) {
    let boundCount = 0;
    try {
      for (; boundCount < models.length; boundCount++) {
        this._bindModel(models[boundCount]);
      }
    } catch (error) {
      for (let index = boundCount; index--;) {
        try {
          this._unbindModel(models[index]);
        } catch {}
      }
      throw error;
    }
  },
  _restoreModelBinding(model) {
    Events.off.call(model, 'all', this._onModelEvent, this);
    Events.on.call(model, 'all', this._onModelEvent, this);
    addModelOwner(model, this, () => releaseOwnedModel(this, model));
  },
  _replaceBindings(previousModels, currentModels) {
    let added = currentModels;
    let removed = previousModels;
    if (previousModels.length && currentModels.length) {
      const previous = new Set(previousModels);
      const current = new Set(currentModels);
      added = currentModels.filter(model => !previous.has(model));
      removed = previousModels.filter(model => !current.has(model));
    }
    this._bindModels(added);
    let attemptedIndex = 0;
    try {
      for (; attemptedIndex < removed.length; attemptedIndex++) {
        this._unbindModel(removed[attemptedIndex]);
      }
    } catch (error) {
      for (; attemptedIndex >= 0; attemptedIndex--) {
        try {
          this._restoreModelBinding(removed[attemptedIndex]);
        } catch {}
      }
      for (let index = added.length; index--;) {
        try {
          this._unbindModel(added[index]);
        } catch {}
      }
      throw error;
    }
  },
  _onModelEvent(eventName, model, ...args) {
    this.triggerMethod(eventName, model, ...args);
  },
  _notify(change) {
    notifyCollection(this, change);
  },
  at(index) {
    return this.models.at(index);
  },
  get(identity) {
    if (identity == null) {
      return undefined;
    }
    return this.models.find(model => model === identity || model.cid === identity || sameValueZero(model.id, identity));
  },
  indexOf(model) {
    return this.models.indexOf(model);
  },
  forEach(callback, context) {
    this.models.forEach(callback, context);
  },
  map(callback, context) {
    return this.models.map(callback, context);
  },
  add(models, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) {
      return Array.isArray(models) ? [] : undefined;
    }
    const added = [];
    const knownModels = new Set(this.models);
    const knownIds = new Set(this.models.filter(model => model.id != null).map(model => model.id));
    for (const candidate of asArray(models)) {
      if (!(candidate instanceof this.model) && candidate != null && typeof candidate === 'object') {
        const idAttribute = this.model.prototype.idAttribute;
        const rawId = Object.hasOwn(candidate, idAttribute) ? candidate[idAttribute] : undefined;
        if (rawId != null && knownIds.has(rawId)) {
          continue;
        }
      }
      const model = this._prepareModel(candidate);
      if (knownModels.has(model) || model.id != null && knownIds.has(model.id)) {
        continue;
      }
      added.push(model);
      knownModels.add(model);
      if (model.id != null) {
        knownIds.add(model.id);
      }
    }
    if (!added.length) {
      return Array.isArray(models) ? added : undefined;
    }
    this._bindModels(added);
    const at = Number.isInteger(options.at) ? Math.max(0, Math.min(options.at, this.models.length)) : this.models.length;
    this.models.splice(at, 0, ...added);
    this.length = this.models.length;
    if (!options.silent) {
      const change = {
        kind: 'update',
        added,
        removed: [],
        updated: []
      };
      this._notify(change);
      for (const model of added) {
        this.triggerMethod('add', model, this, options);
      }
      this.triggerMethod('update', this, {
        ...options,
        changes: change
      });
    }
    return Array.isArray(models) ? added : added[0];
  },
  remove(models, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) {
      return Array.isArray(models) ? [] : undefined;
    }
    const removed = [];
    for (const candidate of asArray(models)) {
      const model = this.get(candidate);
      if (!model || removed.includes(model)) {
        continue;
      }
      removed.push(model);
    }
    if (!removed.length) {
      return Array.isArray(models) ? removed : undefined;
    }
    const nextModels = this.models.filter(model => !removed.includes(model));
    this._replaceBindings(this.models, nextModels);
    this.models = nextModels;
    this.length = this.models.length;
    if (!options.silent) {
      const change = {
        kind: 'update',
        added: [],
        removed,
        updated: []
      };
      this._notify(change);
      for (const model of removed) {
        this.triggerMethod('remove', model, this, options);
      }
      this.triggerMethod('update', this, {
        ...options,
        changes: change
      });
    }
    return Array.isArray(models) ? removed : removed[0];
  },
  reset(models = [], options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) {
      return this;
    }
    const preparedModels = asArray(models).map(model => this._prepareModel(model));
    assertUniqueModels(preparedModels);
    this._replaceBindings(this.models, preparedModels);
    this.models = preparedModels;
    this.length = this.models.length;
    if (!options.silent) {
      this._notify({
        kind: 'reset'
      });
      this.triggerMethod('reset', this, options);
    }
    return this;
  },
  replace(previous, current, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) {
      return undefined;
    }
    const previousModel = this.get(previous);
    if (!previousModel) {
      return undefined;
    }
    const currentModel = this._prepareModel(current);
    const index = this.models.indexOf(previousModel);
    const nextModels = this.models.slice();
    nextModels[index] = currentModel;
    assertUniqueModels(nextModels);
    const previousKey = previousModel.id == null ? previousModel.cid : previousModel.id;
    const currentKey = currentModel.id == null ? currentModel.cid : currentModel.id;
    this._replaceBindings([previousModel], [currentModel]);
    this.models[index] = currentModel;
    if (!options.silent) {
      const change = sameValueZero(previousKey, currentKey) ? {
        kind: 'update',
        added: [],
        removed: [],
        updated: [{
          previous: previousModel,
          current: currentModel
        }]
      } : {
        kind: 'update',
        added: [currentModel],
        removed: [previousModel],
        updated: []
      };
      this._notify(change);
      this.triggerMethod('update', this, {
        ...options,
        changes: change
      });
    }
    return currentModel;
  },
  touch(model, options = {}) {
    options = normalizeOptions(options);
    const currentModel = this.get(model);
    if (!currentModel || this._isDestroyed) {
      return undefined;
    }
    if (!options.silent) {
      const change = {
        kind: 'update',
        added: [],
        removed: [],
        updated: [{
          previous: currentModel,
          current: currentModel
        }]
      };
      this._notify(change);
      this.triggerMethod('update', this, {
        ...options,
        changes: change
      });
    }
    return currentModel;
  },
  move(model, index, options = {}) {
    options = normalizeOptions(options);
    const currentModel = this.get(model);
    if (!currentModel || this._isDestroyed) {
      return undefined;
    }
    if (!Number.isInteger(index)) {
      throw new TypeError('@marionette/data Collection.move() requires an integer index.');
    }
    const previousIndex = this.models.indexOf(currentModel);
    const nextIndex = Math.max(0, Math.min(index, this.models.length - 1));
    if (previousIndex === nextIndex) {
      return currentModel;
    }
    this.models.splice(previousIndex, 1);
    this.models.splice(nextIndex, 0, currentModel);
    if (!options.silent) {
      this._notify({
        kind: 'reorder'
      });
      this.triggerMethod('reorder', this, options);
    }
    return currentModel;
  },
  swap(first, second, options = {}) {
    options = normalizeOptions(options);
    const firstModel = this.get(first);
    const secondModel = this.get(second);
    if (!firstModel || !secondModel || firstModel === secondModel || this._isDestroyed) {
      return this;
    }
    const firstIndex = this.models.indexOf(firstModel);
    const secondIndex = this.models.indexOf(secondModel);
    this.models[firstIndex] = secondModel;
    this.models[secondIndex] = firstModel;
    if (!options.silent) {
      this._notify({
        kind: 'reorder'
      });
      this.triggerMethod('reorder', this, options);
    }
    return this;
  },
  sort(comparator = this.comparator, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) {
      return this;
    }
    const previousModels = this.models.slice();
    if (typeof comparator === 'string') {
      this.models.sort((left, right) => {
        const leftValue = left.get(comparator);
        const rightValue = right.get(comparator);
        return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      });
    } else if (typeof comparator === 'function') {
      this.models.sort(comparator.bind(this));
    } else {
      return this;
    }
    if (this.models.every((model, index) => model === previousModels[index])) {
      return this;
    }
    if (!options.silent) {
      this._notify({
        kind: 'reorder'
      });
      this.triggerMethod('reorder', this, options);
    }
    return this;
  },
  toJSON() {
    return this.models.map(model => model.toJSON());
  },
  isDestroyed() {
    return this._isDestroyed;
  },
  destroy(options) {
    if (this._isDestroyed) {
      return this;
    }
    this._isDestroyed = true;
    disposeAll([() => this.off(), () => this.stopListening(), () => this.triggerMethod('destroy', this, options), () => releaseObservers(this), ...this.models.map(model => () => this._unbindModel(model))]);
    return this;
  }
});
Collection.prototype[Symbol.iterator] = function () {
  return this.models[Symbol.iterator]();
};

function subscribe(source, eventName, callback, context) {
  if (typeof source?.on !== 'function' || typeof source?.off !== 'function') {
    throw new TypeError('@marionette/data can subscribe only to sources with on() and off().');
  }
  let subscribed = true;
  source.on(eventName, callback, context);
  return function () {
    if (!subscribed) {
      return;
    }
    subscribed = false;
    source.off(eventName, callback, context);
  };
}
const StateApi = {
  subscribe,
  disposeOwned(source) {
    source?.destroy?.();
  }
};
const DataApi = {
  key(model) {
    return model.id == null ? model.cid : model.id;
  },
  get(model, property) {
    return model instanceof Model ? model.get(property) : Object.hasOwn(Object(model), property) ? model[property] : undefined;
  },
  has(model, property) {
    return model instanceof Model ? model.has(property) : Object.hasOwn(Object(model), property);
  },
  serialize(model) {
    return model instanceof Model ? model.toJSON() : model;
  },
  models(collection) {
    if (!(collection instanceof Collection)) {
      throw new TypeError('@marionette/data DataApi.models() requires a Collection.');
    }
    return collection.models.slice();
  },
  subscribe,
  observeCollection
};

const triggerMethod = Events.triggerMethod;

export { Collection, DataApi, Model, StateApi, triggerMethod };
