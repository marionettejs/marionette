interface XStateStore<TSnapshot> {
  getSnapshot(): TSnapshot;
  subscribe(observer: (snapshot: TSnapshot) => void): { unsubscribe(): void };
}

export interface XStateStoreDataApiOptions<TSnapshot, TModel, TKey> {
  key(model: TModel): TKey;
  select(snapshot: TSnapshot): readonly TModel[];
}

declare function createXStateStoreDataApi<TSnapshot, TModel, TKey>(
  options: XStateStoreDataApiOptions<TSnapshot, TModel, TKey>,
): {
  key(model: TModel): TKey;
  models(store: XStateStore<TSnapshot>): readonly TModel[];
  observeCollection(
    store: XStateStore<TSnapshot>,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};

export default createXStateStoreDataApi;
