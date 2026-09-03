function subscribe(entity, eventName, callback, context) {
  let isSubscribed = true;
  entity.on(eventName, callback, context);

  return function() {
    if (!isSubscribed) { return; }
    isSubscribed = false;
    entity.off(eventName, callback, context);
  };
}

export default {
  key(model) {
    return model.cid;
  },

  get(model, attribute) {
    return Object.hasOwn(model.attributes, attribute) ? model.get(attribute) : undefined;
  },

  has(model, attribute) {
    return Object.hasOwn(model.attributes, attribute);
  },

  serialize(model) {
    return model.attributes;
  },

  models(collection) {
    return collection.models;
  },

  subscribe,

  observeCollection(collection, callback, context) {
    let previousModels = collection.models.slice();
    const onSort = function(_, options = {}) {
      const hasUnchangedMembership = collection.length === previousModels.length &&
        previousModels.every(model => collection.get(model) === model);
      previousModels = collection.models.slice();
      if (!hasUnchangedMembership && (options.add || options.remove || options.merge)) { return; }
      callback.call(context, { kind: 'reorder' });
    };
    const onReset = function() {
      previousModels = collection.models.slice();
      callback.call(context, { kind: 'reset' });
    };
    const onUpdate = function(_, { changes }) {
      previousModels = collection.models.slice();
      callback.call(context, {
        kind: 'update',
        added: changes.added,
        removed: changes.removed,
        updated: changes.merged.map(model => ({ previous: model, current: model }))
      });
    };
    const events = {
      sort: onSort,
      reset: onReset,
      update: onUpdate
    };

    try {
      return subscribe(collection, events, context);
    } catch (error) {
      collection.off(events, context);
      throw error;
    }
  }
};
