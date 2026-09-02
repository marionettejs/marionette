import disposeAll from '../utils/dispose-all.js';

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
    return model.get(attribute);
  },

  has(model, attribute) {
    return attribute in Object(model.attributes);
  },

  serialize(model) {
    return model.attributes;
  },

  items(collection) {
    return collection.models;
  },

  subscribe,

  observeCollection(collection, callback, context) {
    const onSort = function(currentCollection, options = {}) {
      if (options.add || options.remove || options.merge) { return; }
      callback.call(context, { type: 'reorder' });
    };
    const onReset = function() {
      callback.call(context, { type: 'reset' });
    };
    const onUpdate = function(currentCollection, { changes }) {
      callback.call(context, {
        type: 'update',
        added: changes.added,
        removed: changes.removed,
        updated: changes.merged
      });
    };

    const subscriptions = [];

    try {
      subscriptions.push(subscribe(collection, 'sort', onSort, context));
      subscriptions.push(subscribe(collection, 'reset', onReset, context));
      subscriptions.push(subscribe(collection, 'update', onUpdate, context));
    } catch (error) {
      disposeAll(subscriptions, error);
    }

    return function() {
      disposeAll(subscriptions);
    };
  }
};
