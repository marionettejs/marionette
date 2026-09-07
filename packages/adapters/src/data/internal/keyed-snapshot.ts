export interface KeyedSnapshotDataApi<TSource, TModel> {
  models(source: TSource): readonly TModel[];
  observeCollection(source: TSource, notify: (change: unknown) => void, context?: unknown): () => void;
}

interface Subscription {
  unsubscribe(): void;
}

interface KeyedSnapshotOptions<TSource, TSnapshot, TModel> {
  adapterName: string;
  readSnapshot(source: TSource): TSnapshot;
  select(snapshot: TSnapshot): readonly TModel[];
  subscribe(source: TSource, notify: () => void): Subscription;
}

type SnapshotChange<TModel> = { kind: 'reorder' } | {
  kind: 'update';
  added: TModel[];
  removed: TModel[];
  updated: [];
};

function buildSnapshot<TModel>(models: readonly TModel[], adapterName: string): Map<TModel, number> {
  const snapshot = new Map<TModel, number>();
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    if (model == null) {
      throw new TypeError(`${ adapterName } adapter selector returned a missing actor at index ${ index }.`);
    }
    if (snapshot.has(model)) {
      throw new TypeError(`${ adapterName } adapter selector returned a duplicate actor reference.`);
    }
    snapshot.set(model, index);
  }
  return snapshot;
}

function compareSnapshots<TModel>(
  previous: Map<TModel, number>, current: Map<TModel, number>
): SnapshotChange<TModel> | undefined {
  const added: TModel[] = [];
  const removed: TModel[] = [];
  let reordered = false;

  for (const [model, index] of current) {
    if (!previous.has(model)) {
      added.push(model);
    } else if (previous.get(model) !== index) {
      reordered = true;
    }
  }
  for (const model of previous.keys()) {
    if (!current.has(model)) { removed.push(model); }
  }

  if (added.length || removed.length) {
    return { kind: 'update', added, removed, updated: [] };
  }
  return reordered ? { kind: 'reorder' } : undefined;
}

export function normalizeDisposer(subscription: Subscription): () => void {
  let isDisposed = false;
  return function() {
    if (isDisposed) { return; }
    isDisposed = true;
    subscription.unsubscribe();
  };
}

export default function createKeyedSnapshotDataApi<TSource, TSnapshot, TModel>({
  adapterName,
  readSnapshot,
  select,
  subscribe
}: KeyedSnapshotOptions<TSource, TSnapshot, TModel>): KeyedSnapshotDataApi<TSource, TModel> {
  const getModels = (source: TSource) => select(readSnapshot(source));

  return {
    models: getModels,

    observeCollection(source, notify, context) {
      let selected = getModels(source);
      let observed = buildSnapshot(selected, adapterName);

      const onChange = function() {
        const currentModels = getModels(source);
        if (currentModels === selected) { return; }

        const current = buildSnapshot(currentModels, adapterName);
        const change = compareSnapshots(observed, current);
        selected = currentModels;
        observed = current;
        if (!change) { return; }

        notify.call(context, change);
      };

      return normalizeDisposer(subscribe(source, onChange));
    }
  };
}
