interface XStateStore<TSnapshot> {
  getSnapshot(): TSnapshot;
  subscribe(observer: (snapshot: TSnapshot) => void): { unsubscribe(): void };
}

declare function createXStateStoreDataApi<TSnapshot, TModel, TKey>(
  options: {
    key(model: TModel): TKey;
    select(snapshot: TSnapshot): readonly TModel[];
  },
): {
  key(model: TModel): TKey;
  models(store: XStateStore<TSnapshot>): readonly TModel[];
  observeCollection(
    store: XStateStore<TSnapshot>,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};

export = createXStateStoreDataApi;
