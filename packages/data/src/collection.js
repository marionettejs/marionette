import { Events, extend } from 'marionette';
import assignOwn from './assign-own.js';
import disposeAll from './dispose-all.js';
import Model, { addModelOwner, removeModelOwner } from './model.js';
import {
  initializeObservers,
  notifyCollection,
  releaseObservers
} from './observers.js';

function asArray(models) {
  if (models == null) { return []; }
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
    if (model.id != null) { knownIds.add(model.id); }
  }
}

function releaseOwnedModel(collection, model) {
  const nextModels = collection.models.filter(current => current !== model);
  const options = {};
  const change = { kind: 'update', added: [], removed: [model], updated: [] };
  disposeAll([
    () => {
      collection._notify(change);
      collection.triggerMethod('remove', model, collection, options);
      collection.triggerMethod('update', collection, { ...options, changes: change });
    },
    () => {
      collection.models = nextModels;
      collection.length = collection.models.length;
    },
    () => collection._unbindModel(model)
  ]);
}

const Collection = function(models = [], options = {}) {
  options = normalizeOptions(options);
  this.models = [];
  this.length = 0;
  if (options.model) { this.model = options.model; }
  initializeObservers(this);
  try {
    this.reset(models, { silent: true });
    this.initialize(models, options);
  } catch (error) {
    this._isDestroyed = true;
    disposeAll([
      () => this.off(),
      () => this.stopListening(),
      () => releaseObservers(this),
      ...this.models.map(model => () => this._unbindModel(model))
    ], error);
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
      disposeAll([
        () => removeModelOwner(model, this),
        () => Events.off.call(model, 'all', this._onModelEvent, this)
      ], error);
    }
  },

  _unbindModel(model) {
    let unbindError;
    try {
      model.off('all', this._onModelEvent, this);
    } catch (error) {
      unbindError = error;
    }
    if (!unbindError) {
      removeModelOwner(model, this);
      return;
    }
    disposeAll([
      () => removeModelOwner(model, this),
      () => Events.off.call(model, 'all', this._onModelEvent, this)
    ], unbindError);
  },

  _bindModels(models) {
    const bound = [];
    try {
      for (const model of models) {
        this._bindModel(model);
        bound.push(model);
      }
    } catch (error) {
      disposeAll(bound.map(model => () => this._unbindModel(model)), error);
    }
  },

  _restoreModelBinding(model) {
    Events.off.call(model, 'all', this._onModelEvent, this);
    Events.on.call(model, 'all', this._onModelEvent, this);
    addModelOwner(model, this, () => releaseOwnedModel(this, model));
  },

  _replaceBindings(previousModels, currentModels) {
    if (!currentModels.length) {
      let attemptedIndex = 0;
      try {
        for (; attemptedIndex < previousModels.length; attemptedIndex++) {
          this._unbindModel(previousModels[attemptedIndex]);
        }
      } catch (error) {
        for (; attemptedIndex >= 0; attemptedIndex--) {
          try {
            this._restoreModelBinding(previousModels[attemptedIndex]);
          } catch {
            // Preserve the unbinding error after best-effort rollback.
          }
        }
        throw error;
      }
      return;
    }

    const previous = new Set(previousModels);
    const current = new Set(currentModels);
    const added = currentModels.filter(model => !previous.has(model));
    const removed = previousModels.filter(model => !current.has(model));

    this._bindModels(added);
    const attempted = [];
    try {
      for (const model of removed) {
        attempted.push(model);
        this._unbindModel(model);
      }
    } catch (error) {
      disposeAll([
        ...added.map(model => () => this._unbindModel(model)),
        ...attempted.map(model => () => this._restoreModelBinding(model))
      ], error);
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
    if (identity == null) { return undefined; }
    return this.models.find(model =>
      model === identity || model.cid === identity || sameValueZero(model.id, identity)
    );
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
    if (this._isDestroyed) { return Array.isArray(models) ? [] : undefined; }
    const added = [];
    const knownModels = new Set(this.models);
    const knownIds = new Set(
      this.models.filter(model => model.id != null).map(model => model.id)
    );
    for (const candidate of asArray(models)) {
      if (!(candidate instanceof this.model) && candidate != null && typeof candidate === 'object') {
        const idAttribute = this.model.prototype.idAttribute;
        const rawId = Object.hasOwn(candidate, idAttribute) ? candidate[idAttribute] : undefined;
        if (rawId != null && knownIds.has(rawId)) { continue; }
      }
      const model = this._prepareModel(candidate);
      if (knownModels.has(model) || model.id != null && knownIds.has(model.id)) { continue; }
      added.push(model);
      knownModels.add(model);
      if (model.id != null) { knownIds.add(model.id); }
    }
    if (!added.length) { return Array.isArray(models) ? added : undefined; }
    this._bindModels(added);

    const at = Number.isInteger(options.at) ?
      Math.max(0, Math.min(options.at, this.models.length)) : this.models.length;
    this.models.splice(at, 0, ...added);
    this.length = this.models.length;

    if (!options.silent) {
      const change = { kind: 'update', added, removed: [], updated: [] };
      this._notify(change);
      for (const model of added) { this.triggerMethod('add', model, this, options); }
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return Array.isArray(models) ? added : added[0];
  },

  remove(models, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return Array.isArray(models) ? [] : undefined; }
    const removed = [];
    for (const candidate of asArray(models)) {
      const model = this.get(candidate);
      if (!model || removed.includes(model)) { continue; }
      removed.push(model);
    }
    if (!removed.length) { return Array.isArray(models) ? removed : undefined; }
    const nextModels = this.models.filter(model => !removed.includes(model));
    this._replaceBindings(this.models, nextModels);
    this.models = nextModels;
    this.length = this.models.length;

    if (!options.silent) {
      const change = { kind: 'update', added: [], removed, updated: [] };
      this._notify(change);
      for (const model of removed) { this.triggerMethod('remove', model, this, options); }
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return Array.isArray(models) ? removed : removed[0];
  },

  reset(models = [], options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return this; }
    const preparedModels = asArray(models).map(model => this._prepareModel(model));
    assertUniqueModels(preparedModels);
    this._replaceBindings(this.models, preparedModels);
    this.models = preparedModels;
    this.length = this.models.length;

    if (!options.silent) {
      this._notify({ kind: 'reset' });
      this.triggerMethod('reset', this, options);
    }
    return this;
  },

  replace(previous, current, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return undefined; }
    const previousModel = this.get(previous);
    if (!previousModel) { return undefined; }
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
        updated: [{ previous: previousModel, current: currentModel }]
      } : {
        kind: 'update',
        added: [currentModel],
        removed: [previousModel],
        updated: []
      };
      this._notify(change);
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return currentModel;
  },

  touch(model, options = {}) {
    options = normalizeOptions(options);
    const currentModel = this.get(model);
    if (!currentModel || this._isDestroyed) { return undefined; }
    if (!options.silent) {
      const change = {
        kind: 'update',
        added: [],
        removed: [],
        updated: [{ previous: currentModel, current: currentModel }]
      };
      this._notify(change);
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return currentModel;
  },

  move(model, index, options = {}) {
    options = normalizeOptions(options);
    const currentModel = this.get(model);
    if (!currentModel || this._isDestroyed) { return undefined; }
    if (!Number.isInteger(index)) {
      throw new TypeError('@marionette/data Collection.move() requires an integer index.');
    }
    const previousIndex = this.models.indexOf(currentModel);
    const nextIndex = Math.max(0, Math.min(index, this.models.length - 1));
    if (previousIndex === nextIndex) { return currentModel; }
    this.models.splice(previousIndex, 1);
    this.models.splice(nextIndex, 0, currentModel);
    if (!options.silent) {
      this._notify({ kind: 'reorder' });
      this.triggerMethod('reorder', this, options);
    }
    return currentModel;
  },

  swap(first, second, options = {}) {
    options = normalizeOptions(options);
    const firstModel = this.get(first);
    const secondModel = this.get(second);
    if (!firstModel || !secondModel || firstModel === secondModel || this._isDestroyed) { return this; }
    const firstIndex = this.models.indexOf(firstModel);
    const secondIndex = this.models.indexOf(secondModel);
    this.models[firstIndex] = secondModel;
    this.models[secondIndex] = firstModel;
    if (!options.silent) {
      this._notify({ kind: 'reorder' });
      this.triggerMethod('reorder', this, options);
    }
    return this;
  },

  sort(comparator = this.comparator, options = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return this; }
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
    if (this.models.every((model, index) => model === previousModels[index])) { return this; }
    if (!options.silent) {
      this._notify({ kind: 'reorder' });
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
    if (this._isDestroyed) { return this; }
    this._isDestroyed = true;
    disposeAll([
      () => this.off(),
      () => this.stopListening(),
      () => this.triggerMethod('destroy', this, options),
      () => releaseObservers(this),
      ...this.models.map(model => () => this._unbindModel(model))
    ]);
    return this;
  }
});

Collection.prototype[Symbol.iterator] = function() {
  return this.models[Symbol.iterator]();
};

export default Collection;
