import type * as Backbone from 'backbone';

function subscribe(entity: Backbone.Events, events: Backbone.EventMap,
  context?: unknown, explicitContext?: unknown): () => void;
function subscribe(entity: Backbone.Events, eventName: string | Backbone.EventMap,
  callback?: Backbone.EventHandler, context?: unknown): () => void;
function subscribe(entity: Backbone.Events, eventName: string | Backbone.EventMap,
  callback?: unknown, context?: unknown): () => void {
  // Backbone accepts event maps at runtime; its Events declarations only expose strings.
  let isSubscribed = true;
  try {
    entity.on(eventName as string, callback as Backbone.EventHandler, context);
  } catch (error) {
    entity.off(eventName as string, callback as Backbone.EventHandler, context);
    throw error;
  }

  return function() {
    if (!isSubscribed) { return; }
    isSubscribed = false;
    entity.off(eventName as string, callback as Backbone.EventHandler, context);
  };
}

const BackboneApi = {
  key(model: Backbone.Model): string {
    return model.cid;
  },

  get(model: Backbone.Model, attribute: string): unknown {
    return Object.hasOwn(model.attributes, attribute) ? model.get(attribute) : undefined;
  },

  has(model: Backbone.Model, attribute: string): boolean {
    return Object.hasOwn(model.attributes, attribute);
  },

  serialize(model: Backbone.Model): Backbone.ObjectHash {
    return model.attributes;
  },

  models<TModel extends Backbone.Model>(collection: Backbone.Collection<TModel>): TModel[] {
    return collection.models.slice();
  },

  subscribe,

  // Backbone has no source-wide disposal that preserves caller-owned listeners,
  // and Model#destroy may perform persistence.
  disposeOwned(source: Backbone.Events): void {
    void source;
  },

  observeCollection(collection: Backbone.Collection,
    callback: (change: unknown) => void, context?: unknown): () => void {
    const onSort = function(_: Backbone.Collection,
      options: { add?: boolean; remove?: boolean; merge?: boolean } = {}) {
      // As in v4, handle sorts from add/set through the following update event.
      if (options.add || options.remove || options.merge) { return; }
      callback.call(context, { kind: 'reorder' });
    };
    const onReset = function() {
      callback.call(context, { kind: 'reset' });
    };
    const onUpdate = function(_: Backbone.Collection, { changes }: {
      changes: { added: Backbone.Model[]; removed: Backbone.Model[]; merged: Backbone.Model[] };
    }) {
      callback.call(context, {
        kind: 'update',
        added: changes.added,
        removed: changes.removed,
        updated: changes.merged.map(model => ({ previous: model, current: model }))
      });
    };
    const events = {
      sort: onSort,
      reset: onReset,
      update: onUpdate
    };

    return subscribe(collection, events, context);
  }
};

export default BackboneApi;
