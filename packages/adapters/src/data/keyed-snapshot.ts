export interface KeyedSnapshotDataApi<TSource, TModel, TKey> {
  key(model: TModel): TKey;
  models(source: TSource): readonly TModel[];
  observeCollection(source: TSource, notify: (change: unknown) => void, context?: unknown): () => void;
}

interface KeyedSnapshotOptions<TSource, TSnapshot, TModel, TKey> {
  adapterName: string;
  key?: (model: TModel) => TKey;
  readSnapshot(source: TSource): TSnapshot;
  select?: (snapshot: TSnapshot) => readonly TModel[];
  subscribe(source: TSource, notify: () => void): unknown;
}

interface SnapshotEntry<TModel, TKey> {
  index: number;
  key: TKey;
  model: TModel;
}

interface Snapshot<TModel, TKey> {
  entries: SnapshotEntry<TModel, TKey>[];
  byKey: Map<TKey, SnapshotEntry<TModel, TKey>>;
}

type SnapshotChange<TModel> = { kind: 'reorder' | 'reset' } | {
  kind: 'update';
  added: TModel[];
  removed: TModel[];
  updated: { previous: TModel; current: TModel }[];
};

type AdapterFunction = (...args: never[]) => unknown;

function assertFunction<TFunction extends AdapterFunction>(
  value: TFunction | undefined, name: string, adapterName: string
): asserts value is TFunction {
  if (typeof value !== 'function') {
    throw new TypeError(`${ adapterName } adapter requires a ${ name } function.`);
  }
}

function readModels<TSource, TSnapshot, TModel>(
  source: TSource, readSnapshot: (source: TSource) => TSnapshot,
  select: (snapshot: TSnapshot) => readonly TModel[], adapterName: string
): readonly TModel[] {
  const snapshot = readSnapshot(source);
  if (snapshot == null) {
    throw new TypeError(`${ adapterName } adapter source returned a missing synchronous snapshot.`);
  }
  const models = select(snapshot);
  if (!Array.isArray(models)) {
    throw new TypeError(`${ adapterName } adapter selector must return an ordered array.`);
  }
  return models;
}

function buildSnapshot<TModel, TKey>(
  models: readonly TModel[], key: (model: TModel) => TKey, adapterName: string
): Snapshot<TModel, TKey> {
  const entries = Array<SnapshotEntry<TModel, TKey>>(models.length);
  const byKey = new Map<TKey, SnapshotEntry<TModel, TKey>>();

  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    const modelKey = key(model);
    if (modelKey == null) {
      throw new TypeError(`${ adapterName } adapter key returned a missing value at index ${ index }.`);
    }
    if (byKey.has(modelKey)) {
      throw new TypeError(`${ adapterName } adapter key returned duplicate value "${ String(modelKey) }".`);
    }
    const entry = { index, key: modelKey, model };
    entries[index] = entry;
    byKey.set(modelKey, entry);
  }

  return { entries, byKey };
}

function compareSnapshots<TModel, TKey>(
  previous: Snapshot<TModel, TKey>, current: Snapshot<TModel, TKey>
): SnapshotChange<TModel> | undefined {
  const added: TModel[] = [];
  const removed: TModel[] = [];
  const updated: { previous: TModel; current: TModel }[] = [];
  let reordered = false;

  for (let index = 0; index < current.entries.length; index++) {
    const currentEntry = current.entries[index];
    const previousEntry = previous.byKey.get(currentEntry.key);
    if (!previousEntry) {
      added.push(currentEntry.model);
    } else {
      if (previousEntry.model !== currentEntry.model) {
        updated.push({ previous: previousEntry.model, current: currentEntry.model });
      }
      if (previousEntry.index !== index) { reordered = true; }
    }
  }

  for (const previousEntry of previous.entries) {
    if (!current.byKey.has(previousEntry.key)) {
      removed.push(previousEntry.model);
    }
  }

  if (added.length || removed.length || updated.length) {
    return { kind: 'update', added, removed, updated };
  }
  return reordered ? { kind: 'reorder' } : undefined;
}

export function normalizeDisposer(disposer: unknown, adapterName: string): () => void {
  let dispose: () => void;
  if (typeof disposer === 'function') {
    dispose = disposer as () => void;
  } else if (typeof (disposer as { unsubscribe?: unknown } | null | undefined)?.unsubscribe === 'function') {
    dispose = () => (disposer as { unsubscribe(): void }).unsubscribe();
  } else {
    throw new TypeError(`${ adapterName } adapter subscribe must return a disposer.`);
  }

  let isDisposed = false;
  return function() {
    if (isDisposed) { return; }
    isDisposed = true;
    dispose();
  };
}

export default function createKeyedSnapshotDataApi<TSource, TSnapshot, TModel, TKey>({
  adapterName,
  key,
  readSnapshot,
  select,
  subscribe
}: KeyedSnapshotOptions<TSource, TSnapshot, TModel, TKey>): KeyedSnapshotDataApi<TSource, TModel, TKey> {
  assertFunction(key, 'key', adapterName);
  assertFunction(select, 'selector', adapterName);

  const getModels = (source: TSource) => readModels(source, readSnapshot, select, adapterName);

  return {
    key,

    models(source) {
      return getModels(source);
    },

    observeCollection(source, notify, context) {
      let selected = getModels(source);
      let observed = buildSnapshot(selected, key, adapterName);

      const onChange = function() {
        const currentModels = getModels(source);
        if (currentModels === selected) { return; }

        const current = buildSnapshot(currentModels, key, adapterName);
        const change: SnapshotChange<TModel> | undefined = compareSnapshots(observed, current);
        selected = currentModels;
        observed = current;
        if (!change) { return; }

        notify.call(context, change);
      };

      return normalizeDisposer(subscribe(source, onChange), adapterName);
    }
  };
}
