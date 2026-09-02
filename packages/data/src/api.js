import Model from './model.js';
import Collection from './collection.js';
import { observeCollection } from './observers.js';

function subscribe(source, eventName, callback, context) {
  if (typeof source?.on !== 'function' || typeof source?.off !== 'function') {
    throw new TypeError('@marionette/data can subscribe only to sources with on() and off().');
  }
  let subscribed = true;
  source.on(eventName, callback, context);
  return function() {
    if (!subscribed) { return; }
    subscribed = false;
    source.off(eventName, callback, context);
  };
}

export const StateApi = {
  subscribe,
  disposeOwned(source) {
    source?.destroy?.();
  }
};

export const DataApi = {
  key(model) {
    return model.id == null ? model.cid : model.id;
  },

  get(model, property) {
    return model instanceof Model ? model.get(property) :
      Object.hasOwn(Object(model), property) ? model[property] : undefined;
  },

  has(model, property) {
    return model instanceof Model ? model.has(property) : Object.hasOwn(Object(model), property);
  },

  serialize(model) {
    return model instanceof Model ? model.toJSON() : model;
  },

  items(collection) {
    if (!(collection instanceof Collection)) {
      throw new TypeError('@marionette/data DataApi.items() requires a Collection.');
    }
    return collection.models.slice();
  },

  subscribe,
  observeCollection
};
