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

function computedDefinitions(model: Model): Record<string, unknown> {
  // Skeletor accepts methods as well as getters at runtime.
  type Definitions = Record<string, unknown> | undefined;
  const definitions = model.computed as Definitions | (() => Definitions);
  return (typeof definitions === 'function' ? definitions.call(model) : definitions) ?? {};
}

function get(model: Model, attribute: string): unknown {
  if (Object.hasOwn(computedDefinitions(model), attribute)) { return model.get(attribute); }
  return Object.hasOwn(model.attributes, attribute) ? model.attributes[attribute] : undefined;
}

function has(model: Model, attribute: string): boolean {
  return Object.hasOwn(model.attributes, attribute) || Object.hasOwn(computedDefinitions(model), attribute);
}

const SkeletorApi = {
  key(model: Model): string {
    return model.cid;
  },

  get,

  has,

  serialize(model: Model): Record<string, unknown> {
    // A template snapshot includes computed keys; persistence remains Skeletor's concern.
    const definitions = computedDefinitions(model);
    const keys = new Set([...Object.keys(model.attributes), ...Object.keys(definitions)]);
    return Object.fromEntries([...keys].map(key => [
      key, Object.hasOwn(definitions, key) ? model.get(key) : model.attributes[key]
    ]));
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
    const sortedOptions = new WeakSet<Options>();

    const snapshotChange = function() {
      const current = collection.models.slice();
      const before = new Set(previous);
      const after = new Set(current);
      const added = current.filter(model => !before.has(model));
      const removed = previous.filter(model => !after.has(model));
      const reordered = current.some((model, index) => model !== previous[index]);
      previous = current;
      return { added, removed, reordered };
    };
    const onSort = function(_: Collection<TModel>, options?: Options) {
      const fromMutation = options && (options.add || options.remove || options.merge);
      if (fromMutation) { sortedOptions.add(options); }

      // A set may emit only sort. Reconcile now and suppress a later matching
      // update unless intervening callbacks changed the source again.
      const { added, removed } = snapshotChange();
      if (fromMutation || added.length || removed.length) {
        callback.call(context, { kind: 'update', added, removed, updated: [] });
      } else {
        callback.call(context, { kind: 'reorder' });
      }
    };
    const onReset = function() {
      previous = collection.models.slice();
      callback.call(context, { kind: 'reset' });
    };
    const onUpdate = function(_: Collection<TModel>, options?: Options) {
      const alreadySorted = options && sortedOptions.delete(options);
      const { added, removed, reordered } = snapshotChange();
      // Do not replay a stale outer membership delta after a nested event.
      // Merges and explicit bare updates still refresh ordering and filtering.
      if (!added.length && !removed.length && !reordered &&
          (alreadySorted || (options?.changes && !options.changes.merged?.length))) { return; }

      // Model events still own row rendering.
      callback.call(context, { kind: 'update', added, removed, updated: [] });
    };

    return subscribe(collection, { sort: onSort, reset: onReset, update: onUpdate }, context);
  }
};

export default SkeletorApi;
