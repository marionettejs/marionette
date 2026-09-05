interface ReduxStore<TState> {
  getState(): TState;
  subscribe(listener: () => void): () => void;
}

declare function createReduxDataApi<TState, TModel, TKey>(
  options: {
    key(model: TModel): TKey;
    select(state: TState): readonly TModel[];
  },
): {
  key(model: TModel): TKey;
  models(store: ReduxStore<TState>): readonly TModel[];
  observeCollection(
    store: ReduxStore<TState>,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};

export = createReduxDataApi;
