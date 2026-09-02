import getValue from '../utils/get-value.js';
import disposeAll from '../utils/dispose-all.js';
import subscribeBindings from '../utils/subscribe-bindings.js';

// MixinOptions
// - collectionEvents
// - modelEvents

export default {
  // Handle `modelEvents`, and `collectionEvents` configuration
  _delegateEntityEvents(model, collection, Data) {
    try {
      if (model) {
        this._modelEvents = getValue(this, 'modelEvents');
        if (this._modelEvents) {
          this._modelEventUnsubscribe = subscribeBindings(
            this,
            Data,
            model,
            this._modelEvents,
            'DataApi'
          );
        }
      }

      if (collection) {
        this._collectionEvents = getValue(this, 'collectionEvents');
        if (this._collectionEvents) {
          this._collectionEventUnsubscribe = subscribeBindings(
            this,
            Data,
            collection,
            this._collectionEvents,
            'DataApi'
          );
        }
      }
    } catch (error) {
      this._deleteEntityEventHandlers(error);
    }
  },

  // Remove any previously delegate entity events
  _undelegateEntityEvents() {
    this._deleteEntityEventHandlers();
  },

  // Remove cached event handlers
  _deleteEntityEventHandlers(error) {
    const subscriptions = [
      this._modelEventUnsubscribe,
      this._collectionEventUnsubscribe
    ];

    delete this._modelEventUnsubscribe;
    delete this._collectionEventUnsubscribe;
    delete this._modelEvents;
    delete this._collectionEvents;

    if (arguments.length) {
      disposeAll(subscriptions, error);
    } else {
      disposeAll(subscriptions);
    }
  }
};
