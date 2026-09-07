import type { Bindings } from '@marionette/utils';
import { getValue } from '@marionette/utils';
import subscribeBindings from '../utils/subscribe-bindings.ts';

import type { StateApi } from '../runtime/state-api.ts';

export interface EntityEventHost {
  modelEvents?: Bindings | (() => Bindings);
  collectionEvents?: Bindings | (() => Bindings);
  _modelEvents?: Bindings;
  _collectionEvents?: Bindings;
  _modelEventCleanup?: () => void;
  _collectionEventCleanup?: () => void;
  _deleteEntityEventHandlers(): void;
}

// MixinOptions
// - collectionEvents
// - modelEvents

export default {
  // Handle `modelEvents`, and `collectionEvents` configuration
  _delegateEntityEvents(this: EntityEventHost, model: unknown, collection: unknown, Data: Partial<StateApi<never>>) {
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

  // Remove any previously delegate entity events
  _undelegateEntityEvents(this: EntityEventHost) {
    this._deleteEntityEventHandlers();
  },

  // Remove cached event handlers
  _deleteEntityEventHandlers(this: EntityEventHost) {
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
