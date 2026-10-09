import type * as Backbone from 'backbone';

function subscribe(entity: Backbone.Events, events: Backbone.EventMap,
  context?: unknown, explicitContext?: unknown): () => void;
function subscribe(entity: Backbone.Events, eventName: string | Backbone.EventMap,
  callback?: Backbone.EventHandler, context?: unknown): () => void;
function subscribe(entity: Backbone.Events, eventName: string | Backbone.EventMap,
  callback?: unknown, context?: unknown): () => void {
  // Backbone accepts event maps at runtime; its Events declarations only expose strings.
  let isSubscribed = true;
  entity.on(eventName as string, callback as Backbone.EventHandler, context);

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
    const pendingUpdates = new WeakSet<object>();
    const onMutation = function(_: Backbone.Model, _collection: Backbone.Collection, options: object) {
      pendingUpdates.add(options);
    };
    const onSort = function(_: Backbone.Collection, options: object = {}) {
      // Native add/remove events establish an update will follow; option flags do not.
      if (pendingUpdates.has(options)) { return; }
      callback.call(context, { kind: 'reorder' });
    };
    const onReset = function() {
      callback.call(context, { kind: 'reset' });
    };
    const onUpdate = function(_: Backbone.Collection, options: {
      changes: { added: Backbone.Model[]; removed: Backbone.Model[]; merged: Backbone.Model[] };
    }) {
      pendingUpdates.delete(options);
      const { changes } = options;
      callback.call(context, {
        kind: 'update',
        added: changes.added,
        removed: changes.removed,
        // Merges retain the model; child model events own its rendering, as in v4.
        updated: []
      });
    };
    const events = {
      add: onMutation,
      remove: onMutation,
      sort: onSort,
      reset: onReset,
      update: onUpdate
    };

    return subscribe(collection, events, context);
  }
};

export default BackboneApi;
