import Model from './model.ts';
import Collection from './collection.ts';

import type { ModelInstance as ModelType } from './model.ts';
import type { CollectionInstance as CollectionType, CollectionChange } from './collection.ts';
import type { EventSource as Source, EventCallback } from '@marionette/utils';

function subscribe(source: Source, events: Record<string, EventCallback>, context?: unknown): () => void;
function subscribe(source: Source, eventName: string, callback: EventCallback, context?: unknown): () => void;
function subscribe(source: Source, eventName: string | Record<string, EventCallback>, callback?: unknown, context?: unknown): () => void {
  if (typeof source?.on !== 'function' || typeof source?.off !== 'function') {
    throw new TypeError('@marionette/data can subscribe only to sources with on() and off().');
  }
  let subscribed = true;
  source.on(eventName as string, callback as (...args: unknown[]) => unknown, context);
  return function() {
    if (!subscribed) { return; }
    subscribed = false;
    source.off(eventName as string, callback as (...args: unknown[]) => unknown, context);
  };
}

export const StateApi = {
  subscribe,
  disposeOwned(source: { destroy?: () => unknown } | null | undefined) {
    source?.destroy?.();
  }
};

export const DataApi = {
  key(model: ModelType) {
    return model.cid;
  },

  get(model: ModelType | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey) {
    return model instanceof Model ? model.get(property as string) :
      Object.hasOwn(Object(model), property) ? model![property] : undefined;
  },

  has(model: ModelType | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey) {
    return model instanceof Model ? model.has(property as string) : Object.hasOwn(Object(model), property);
  },

  serialize(model: unknown) {
    return model instanceof Model ? model.attributes : model;
  },

  models<M extends ModelType>(collection: CollectionType<M>): M[] {
    if (!(collection instanceof Collection)) {
      throw new TypeError('@marionette/data DataApi.models() requires a Collection.');
    }
    return collection.models.slice();
  },

  subscribe,
  observeCollection<M extends ModelType>(collection: CollectionType<M>, callback: (change: CollectionChange<M>) => void, context?: unknown) {
    const onUpdate = function(_: CollectionType<M>, { changes }: { changes: CollectionChange<M> }) {
      callback.call(context, changes);
    };
    const onReset = function() { callback.call(context, { kind: 'reset' }); };
    const onSort = function() { callback.call(context, { kind: 'reorder' }); };
    return subscribe(collection, { update: onUpdate, reset: onReset, sort: onSort }, context);
  }
};
