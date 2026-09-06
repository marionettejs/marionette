import createKeyedSnapshotDataApi from './keyed-snapshot.ts';
import type { KeyedSnapshotDataApi } from './keyed-snapshot.ts';

interface XStateStore<TState> {
  getSnapshot(): TState;
  subscribe(observer: (snapshot: TState) => void): { unsubscribe(): void };
}

export interface XStateStoreDataApiOptions<TState, TModel, TKey> {
  key(model: TModel): TKey;
  select(state: TState): readonly TModel[];
}

function readSnapshot<TState>(store: XStateStore<TState>) {
  if (typeof store?.getSnapshot !== 'function') {
    throw new TypeError('XState Store adapter requires a store with getSnapshot().');
  }
  return store.getSnapshot();
}

function subscribe<TState>(store: XStateStore<TState>, notify: () => void) {
  if (typeof store?.subscribe !== 'function') {
    throw new TypeError('XState Store adapter requires a store with subscribe().');
  }
  return store.subscribe(notify);
}

export default function createXStateStoreDataApi<TState, TModel, TKey>(
  options: XStateStoreDataApiOptions<TState, TModel, TKey>
): KeyedSnapshotDataApi<XStateStore<TState>, TModel, TKey>;
export default function createXStateStoreDataApi<TState, TModel, TKey>(
  { key, select }: Partial<XStateStoreDataApiOptions<TState, TModel, TKey>> = {}
): KeyedSnapshotDataApi<XStateStore<TState>, TModel, TKey> {
  return createKeyedSnapshotDataApi({
    adapterName: 'XState Store',
    key,
    readSnapshot,
    select,
    subscribe
  });
}
