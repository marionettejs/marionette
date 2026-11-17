import type { Collection, EventCallback, EventCallbackMap, IEventEmitter, Model, Options } from '@converse/skeletor';

function subscribe(entity: IEventEmitter, events: EventCallbackMap,
  context?: unknown, explicitContext?: unknown): () => void;
function subscribe(entity: IEventEmitter, eventName: string | EventCallbackMap,
  callback?: EventCallback, context?: unknown): () => void;
function subscribe(entity: IEventEmitter, eventName: string | EventCallbackMap,
  callback?: unknown, context?: unknown): () => void {
  let isSubscribed = true;
  entity.on(eventName, callback, context);

  return function() {
    if (!isSubscribed) { return; }
    isSubscribed = false;
    entity.off(eventName, callback, context);
  };
}

function get(model: Model, attribute: string): unknown {
  if (Object.hasOwn(model.computed, attribute)) { return model.get(attribute); }
  return Object.hasOwn(model.attributes, attribute) ? model.attributes[attribute] : undefined;
}

function has(model: Model, attribute: string): boolean {
  return Object.hasOwn(model.attributes, attribute) || Object.hasOwn(model.computed, attribute);
}

const SkeletorApi = {
  key(model: Model): string {
    return model.cid;
  },

  get,

  has,

  serialize(model: Model): Record<string, unknown> {
    // A template snapshot includes computed keys; persistence remains Skeletor's concern.
    const keys = new Set([...Object.keys(model.attributes), ...Object.keys(model.computed)]);
    return Object.fromEntries([...keys].map(key => [key, get(model, key)]));
  },

  models<TModel extends Model>(collection: Collection<TModel>): TModel[] {
    return collection.models.slice();
  },

  subscribe,

  // Never destroy a persistence-capable model or remove caller-owned listeners.
  disposeOwned(source: IEventEmitter): void {
    void source;
  },

  observeCollection<TModel extends Model>(collection: Collection<TModel>,
    callback: (change: unknown) => void, context?: unknown): () => void {
    let previous = collection.models.slice();
    let sortedOptions: Options | undefined;
    const notify = function(change: unknown) {
      previous = collection.models.slice();
      callback.call(context, change);
    };
    const onSort = function(_: Collection<TModel>, options: Options = {}) {
      sortedOptions = options;
      if (!(options.add || options.remove || options.merge)) {
        notify({ kind: 'reorder' });
        return;
      }
      // set() can emit sort without update when it only reorders existing models.
      // Reconcile here, then consume the matching update if one follows.
      const before = new Set(previous);
      const after = new Set(collection.models);
      notify({
        kind: 'update',
        added: collection.models.filter(model => !before.has(model)),
        removed: previous.filter(model => !after.has(model)),
        updated: []
      });
    };
    const onReset = function() {
      sortedOptions = undefined;
      notify({ kind: 'reset' });
    };
    const onUpdate = function(_: Collection<TModel>, options: Options) {
      if (options === sortedOptions) { sortedOptions = undefined; return; }
      const { added, removed } = options.changes;
      // Merges retain model identity; child model events own their rendering.
      notify({ kind: 'update', added, removed, updated: [] });
    };

    return subscribe(collection, { sort: onSort, reset: onReset, update: onUpdate }, context);
  }
};

export default SkeletorApi;
