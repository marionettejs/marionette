'use strict';

var Backbone = require('backbone');
var marionette = require('marionette');

function disposeAll(disposers, error) {
  let hasError = arguments.length > 1;
  for (let index = disposers.length - 1; index >= 0; index--) {
    const disposer = disposers[index];
    if (!disposer) {
      continue;
    }
    try {
      disposer();
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

function subscribe(entity, eventName, callback, context) {
  let isSubscribed = true;
  entity.on(eventName, callback, context);
  return function () {
    if (!isSubscribed) {
      return;
    }
    isSubscribed = false;
    entity.off(eventName, callback, context);
  };
}
var BackboneDataApi = {
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
    const onSort = function (currentCollection, options = {}) {
      if (options.add || options.remove || options.merge) {
        return;
      }
      callback.call(context, {
        type: 'reorder'
      });
    };
    const onReset = function () {
      callback.call(context, {
        type: 'reset'
      });
    };
    const onUpdate = function (currentCollection, {
      changes
    }) {
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
    return function () {
      disposeAll(subscriptions);
    };
  }
};

marionette.setDataApi(BackboneDataApi);
const prototypes = [Backbone.Model.prototype, Backbone.Collection.prototype, Backbone.View.prototype, Backbone.Router.prototype];
for (const prototype of prototypes) {
  Object.assign(prototype, marionette.Events);
  delete prototype.bind;
  delete prototype.unbind;
}

module.exports = Backbone;
