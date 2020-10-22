import { result } from 'underscore';

// MixinOptions
// - collectionEvents
// - modelEvents

export default {
  // Handle `modelEvents`, and `collectionEvents` configuration
  _delegateEntityEvents(model, collection) {
    if (model) {
      this._modelEvents = result(this, 'modelEvents');
      this.bindEvents(model, this._modelEvents);
    }

    if (collection) {
      this._collectionEvents = result(this, 'collectionEvents');
      this.bindEvents(collection, this._collectionEvents);
    }
  },

  // Remove any previously delegate entity events
  _undelegateEntityEvents(model, collection) {
    if (this._modelEvents) {
      this.unbindEvents(model, this._modelEvents);
      delete this._modelEvents;
    }

    if (this._collectionEvents) {
      this.unbindEvents(collection, this._collectionEvents);
      delete this._collectionEvents;
    }
  },

  // Remove cached event handlers
  _deleteEntityEventHandlers() {
    delete this._modelEvents;
    delete this._collectionEvents;
  }
};
