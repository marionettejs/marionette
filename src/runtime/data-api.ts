// Data API
// --------
import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from '../modules/error.ts';
import type { EventCallback, EventSource } from '../mixins/events.ts';

// Configured sources are opaque; registration does not establish a source match.
export interface DataApi {
  key: (model: never) => unknown;
  get: (model: never, attribute: never) => unknown;
  has: (model: never, attribute: string) => boolean;
  serialize: (model: never) => unknown;
  models: (collection: never) => readonly unknown[];
  subscribe: (entity: never, eventName: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
  observeCollection: (collection: never, callback: (change: unknown) => void, context?: unknown) => () => void;
}

interface DataApiClass {
  prototype: { Data: Partial<DataApi> };
}

interface DefaultDataApi {
  key<Source>(model: Source): Source;
  get(model: NonNullable<unknown>, attribute: unknown): unknown;
  has(model: unknown, attribute: unknown): boolean;
  serialize<Source>(model: Source): Source;
  models<Source extends readonly unknown[]>(collection: Source): Source;
  subscribe(entity: EventSource, eventName: string,
    callback: EventCallback, context?: unknown): () => void;
  observeCollection(collection: readonly unknown[], callback?: EventCallback, context?: unknown): () => void;
}

type EntityCallback = Parameters<EventSource['on']>[1];

const noop = function() {};

// Static setter
export function setDataApi<Receiver extends DataApiClass, Mixin extends object>(
  this: Receiver,
  mixin?: Mixin & Partial<DataApi> | null | boolean | number | bigint | string | symbol
): Receiver {
  this.prototype.Data = assignOwn({}, this.prototype.Data, mixin);
  return this;
}

export default {
  key<Source>(model: Source): Source {
    return model;
  },

  get(model: unknown, attribute: unknown): unknown {
    return Object.hasOwn(model as object, attribute as PropertyKey) ?
      (model as Record<PropertyKey, unknown>)[attribute as PropertyKey] : undefined;
  },

  has(model: unknown, attribute: unknown): boolean {
    return Object.hasOwn(Object(model), attribute as PropertyKey);
  },

  serialize<Source>(model: Source): Source {
    return model;
  },

  models<Source>(collection: Source): Source {
    return collection;
  },

  subscribe(entity: EventSource | null | undefined, eventName: string,
    callback: EventCallback, context?: unknown) {
    if (typeof entity?.on !== 'function' || typeof entity?.off !== 'function') {
      throw new MarionetteError({
        code: 'MN0037',
        name: 'DataApiError',
        message: 'The default DataApi cannot observe modelEvents or collectionEvents on a plain value. Configure a DataApi that supports this source or remove the event map.',
        url: 'data.api.html#entity-events'
      });
    }

    let isSubscribed = true;
    entity.on(eventName, callback as EntityCallback, context);

    return function() {
      if (!isSubscribed) { return; }
      isSubscribed = false;
      entity.off(eventName, callback as EntityCallback, context);
    };
  },

  observeCollection(collection: unknown) {
    if (Array.isArray(collection)) { return noop; }

    throw new MarionetteError({
      code: 'MN0037',
      name: 'DataApiError',
      message: 'The default DataApi can observe only static plain arrays. Configure a DataApi that supports this collection source.',
      url: 'data.api.html#collection-observations'
    });
  }
} satisfies DefaultDataApi as DefaultDataApi;
