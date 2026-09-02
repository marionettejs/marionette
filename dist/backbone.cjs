'use strict';

var Backbone = require('backbone');
var marionette = require('marionette');

function hasSameModels(collection, models) {
  return collection.length === models.length && models.every(model => collection.get(model) === model);
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
    return Object.hasOwn(model.attributes, attribute) ? model.get(attribute) : undefined;
  },
  has(model, attribute) {
    return Object.hasOwn(model.attributes, attribute);
  },
  serialize(model) {
    return model.attributes;
  },
  items(collection) {
    return collection.models;
  },
  subscribe,
  observeCollection(collection, callback, context) {
    let previousModels = collection.models.slice();
    const onSort = function (currentCollection, options = {}) {
      const hasUnchangedMembership = hasSameModels(currentCollection, previousModels);
      previousModels = currentCollection.models.slice();
      if (!hasUnchangedMembership && (options.add || options.remove || options.merge)) {
        return;
      }
      callback.call(context, {
        type: 'reorder'
      });
    };
    const onReset = function (currentCollection) {
      previousModels = currentCollection.models.slice();
      callback.call(context, {
        type: 'reset'
      });
    };
    const onUpdate = function (currentCollection, {
      changes
    }) {
      previousModels = currentCollection.models.slice();
      callback.call(context, {
        type: 'update',
        added: changes.added,
        removed: changes.removed,
        updated: changes.merged
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

marionette.setDataApi(BackboneDataApi);
const prototypes = [Backbone.Model.prototype, Backbone.Collection.prototype, Backbone.View.prototype, Backbone.Router.prototype];
for (const prototype of prototypes) {
  Object.assign(prototype, marionette.Events);
  delete prototype.bind;
  delete prototype.unbind;
}

module.exports = Backbone;
