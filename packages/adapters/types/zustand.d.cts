interface ZustandStore<TState> {
  getState(): TState;
  subscribe(listener: (state: TState, previousState: TState) => void): () => void;
}

declare function createZustandDataApi<TState, TModel, TKey>(
  options: {
    key(model: TModel): TKey;
    select(state: TState): readonly TModel[];
  },
): {
  key(model: TModel): TKey;
  models(store: ZustandStore<TState>): readonly TModel[];
  observeCollection(
    store: ZustandStore<TState>,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};

export = createZustandDataApi;
