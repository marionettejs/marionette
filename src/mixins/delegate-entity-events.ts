import type { Bindings } from '@mnjs/utils';
import { getValue } from '@mnjs/utils';
import subscribeBindings from '../utils/subscribe-bindings.ts';

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

    subscriptions.forEach(cleanup => cleanup?.());
  }
};
