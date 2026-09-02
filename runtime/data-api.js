// Data API
// --------
import { assignOwn } from '../utils/assign-in.js';

const noop = function() {};

// Static setter
export function setDataApi(mixin) {
  this.prototype.Data = assignOwn({}, this.prototype.Data, mixin);
  return this;
}

export default {
  key(model) {
    return model;
  },

  get(model, attribute) {
    return Object.hasOwn(model, attribute) ? model[attribute] : undefined;
  },

  has(model, attribute) {
    return Object.hasOwn(Object(model), attribute);
  },

  serialize(model) {
    return model;
  },

  items(collection) {
    return collection;
  },

  subscribe(entity, eventName, callback, context) {
    let isSubscribed = true;
    entity.on(eventName, callback, context);

    return function() {
      if (!isSubscribed) { return; }
      isSubscribed = false;
      entity.off(eventName, callback, context);
    };
  },

  observeCollection() {
    return noop;
  }
};
