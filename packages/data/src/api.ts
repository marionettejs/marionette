import Model from './model.ts';
import Collection from './collection.ts';
import { observeCollection } from './observers.ts';

import type { ModelInstance as ModelType } from './model.ts';
import type { CollectionInstance as CollectionType } from './collection.ts';
import type { Source, EventCallback } from './events.ts';

function subscribe(source: Source, eventName: string, callback: EventCallback, context?: unknown) {
  if (typeof source?.on !== 'function' || typeof source?.off !== 'function') {
    throw new TypeError('@marionette/data can subscribe only to sources with on() and off().');
  }
  let subscribed = true;
  source.on(eventName, callback as (...args: unknown[]) => unknown, context);
  return function() {
    if (!subscribed) { return; }
    subscribed = false;
    source.off(eventName, callback as (...args: unknown[]) => unknown, context);
  };
}

export const StateApi = {
  subscribe,
  disposeOwned(source: { destroy?: () => unknown } | null | undefined) {
    source?.destroy?.();
  }
};

export const DataApi = {
  key(model: { id?: unknown; cid?: unknown }) {
    return model.id == null ? model.cid : model.id;
  },

  get(model: ModelType | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey) {
    return model instanceof Model ? model.get(property as string) :
      Object.hasOwn(Object(model), property) ? model![property] : undefined;
  },

  has(model: ModelType | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey) {
    return model instanceof Model ? model.has(property as string) : Object.hasOwn(Object(model), property);
  },

  serialize(model: unknown) {
    return model instanceof Model ? model.toJSON() : model;
  },

  models<M extends ModelType>(collection: CollectionType<M>): M[] {
    if (!(collection instanceof Collection)) {
      throw new TypeError('@marionette/data DataApi.models() requires a Collection.');
    }
    return collection.models.slice();
  },

  subscribe,
  observeCollection
};
