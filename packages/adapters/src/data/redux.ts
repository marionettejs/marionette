import createKeyedSnapshotDataApi from './keyed-snapshot.ts';
import type { KeyedSnapshotDataApi } from './keyed-snapshot.ts';

interface ReduxStore<TState> {
  getState(): TState;
  subscribe(listener: () => void): () => void;
}

export interface ReduxDataApiOptions<TState, TModel, TKey> {
  key(model: TModel): TKey;
  select(state: TState): readonly TModel[];
}

function readSnapshot<TState>(store: ReduxStore<TState>) {
  if (typeof store?.getState !== 'function') {
    throw new TypeError('Redux adapter requires a store with getState().');
  }
  return store.getState();
}

function subscribe<TState>(store: ReduxStore<TState>, notify: () => void) {
  if (typeof store?.subscribe !== 'function') {
    throw new TypeError('Redux adapter requires a store with subscribe().');
  }
  return store.subscribe(notify);
}

export default function createReduxDataApi<TState, TModel, TKey>(
  options: ReduxDataApiOptions<TState, TModel, TKey>
): KeyedSnapshotDataApi<ReduxStore<TState>, TModel, TKey>;
export default function createReduxDataApi<TState, TModel, TKey>(
  { key, select }: Partial<ReduxDataApiOptions<TState, TModel, TKey>> = {}
): KeyedSnapshotDataApi<ReduxStore<TState>, TModel, TKey> {
  return createKeyedSnapshotDataApi({
    adapterName: 'Redux',
    key,
    readSnapshot,
    select,
    subscribe
  });
}
