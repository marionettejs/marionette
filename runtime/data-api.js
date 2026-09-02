// Data API
// --------
import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from '../utils/error.js';

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
    if (typeof entity?.on !== 'function' || typeof entity?.off !== 'function') {
      throw new MarionetteError({
        code: 'MN0037',
        name: 'DataApiError',
        message: 'The default DataApi cannot observe modelEvents or collectionEvents on a plain value. Configure a DataApi that supports this source or remove the event map.',
        url: 'data.api.html#entity-events'
      });
    }

    let isSubscribed = true;
    entity.on(eventName, callback, context);

    return function() {
      if (!isSubscribed) { return; }
      isSubscribed = false;
      entity.off(eventName, callback, context);
    };
  },

  observeCollection(collection) {
    if (Array.isArray(collection)) { return noop; }

    throw new MarionetteError({
      code: 'MN0037',
      name: 'DataApiError',
      message: 'The default DataApi can observe only static plain arrays. Configure a DataApi that supports this collection source.',
      url: 'data.api.html#collection-observations'
    });
  }
};
