import type { Bindings } from '@marionette/utils';
import { getValue } from '@marionette/utils';
import subscribeBindings from '../utils/subscribe-bindings.ts';
import cleanupSubscriptions from '../utils/cleanup-subscriptions.ts';

import type { SubscriptionApi } from '../utils/subscribe-bindings.ts';

export interface EntityEventHost {
  modelEvents?: Bindings | (() => Bindings);
  collectionEvents?: Bindings | (() => Bindings);
  _modelEvents?: Bindings;
  _collectionEvents?: Bindings;
  _modelEventCleanup?: () => void;
  _collectionEventCleanup?: () => void;
  _undelegateEntityEvents(): void;
}

// MixinOptions
// - collectionEvents
// - modelEvents

export default {
  // Handle `modelEvents`, and `collectionEvents` configuration
  _delegateEntityEvents(this: EntityEventHost, model: unknown, collection: unknown, Data: SubscriptionApi) {
    try {
      if (model != null) {
        this._modelEvents = getValue(this, 'modelEvents') as Bindings | undefined;
        if (this._modelEvents) {
          this._modelEventCleanup = subscribeBindings(
            this,
            Data,
            model,
            this._modelEvents
          );
        }
      }

      if (collection != null) {
        this._collectionEvents = getValue(this, 'collectionEvents') as Bindings | undefined;
        if (this._collectionEvents) {
          this._collectionEventCleanup = subscribeBindings(
            this,
            Data,
            collection,
            this._collectionEvents
          );
        }
      }
    } catch (error) {
      try { this._undelegateEntityEvents(); } catch { /* Preserve the subscription setup error. */ }
      throw error;
    }
  },

  // Unsubscribe entity events and remove cached handlers.
  _undelegateEntityEvents(this: EntityEventHost) {
    const subscriptions = [
      this._modelEventCleanup,
      this._collectionEventCleanup
    ];

    delete this._modelEventCleanup;
    delete this._collectionEventCleanup;
    delete this._modelEvents;
    delete this._collectionEvents;

    cleanupSubscriptions(subscriptions);
  }
};
