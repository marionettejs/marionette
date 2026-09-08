// Data API
// --------
import { MarionetteError } from '@mnjs/utils';
import type { EventCallback, EventSource } from '@mnjs/utils';

// Registration leaves source types opaque. Internal callers specify the
// inputs their operation requires without widening the public adapter slot.
export interface DataApi<Model = never, Collection = never, Attribute = never> {
  key: (model: Model) => unknown;
  get: (model: Model, attribute: Attribute) => unknown;
  has: (model: Model, attribute: string) => boolean;
  serialize: (model: Model) => unknown;
  models: (collection: Collection) => readonly unknown[];
  subscribe: (entity: Model | Collection, eventName: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
  observeCollection: (collection: Collection, callback: (change: unknown) => void, context?: unknown) => () => void;
}

interface DataApiClass {
  prototype: { Data: Partial<DataApi> };
}

export interface DefaultDataApi {
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
  this.prototype.Data = { ...this.prototype.Data, ...mixin as object };
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
