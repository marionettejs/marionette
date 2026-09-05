interface ReduxStore<TState> {
  getState(): TState;
  subscribe(listener: () => void): () => void;
}

export interface ReduxDataApiOptions<TState, TModel, TKey> {
  key(model: TModel): TKey;
  select(state: TState): readonly TModel[];
}

declare function createReduxDataApi<TState, TModel, TKey>(
  options: ReduxDataApiOptions<TState, TModel, TKey>,
): {
  key(model: TModel): TKey;
  models(store: ReduxStore<TState>): readonly TModel[];
  observeCollection(
    store: ReduxStore<TState>,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};

export default createReduxDataApi;
