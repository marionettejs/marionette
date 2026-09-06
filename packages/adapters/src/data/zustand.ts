import createKeyedSnapshotDataApi from './keyed-snapshot.ts';
import type { KeyedSnapshotDataApi } from './keyed-snapshot.ts';

interface ZustandStore<TState> {
  getState(): TState;
  subscribe(listener: (state: TState, previousState: TState) => void): () => void;
}

export interface ZustandDataApiOptions<TState, TModel, TKey> {
  key(model: TModel): TKey;
  select(state: TState): readonly TModel[];
}

function readSnapshot<TState>(store: ZustandStore<TState>) {
  if (typeof store?.getState !== 'function') {
    throw new TypeError('Zustand adapter requires a store with getState().');
  }
  return store.getState();
}

function subscribe<TState>(store: ZustandStore<TState>, notify: () => void) {
  if (typeof store?.subscribe !== 'function') {
    throw new TypeError('Zustand adapter requires a store with subscribe().');
  }
  return store.subscribe(notify);
}

export default function createZustandDataApi<TState, TModel, TKey>(
  options: ZustandDataApiOptions<TState, TModel, TKey>
): KeyedSnapshotDataApi<ZustandStore<TState>, TModel, TKey>;
export default function createZustandDataApi<TState, TModel, TKey>(
  { key, select }: Partial<ZustandDataApiOptions<TState, TModel, TKey>> = {}
): KeyedSnapshotDataApi<ZustandStore<TState>, TModel, TKey> {
  return createKeyedSnapshotDataApi({
    adapterName: 'Zustand',
    key,
    readSnapshot,
    select,
    subscribe
  });
}
