export type EventCallback = (...args: unknown[]) => unknown;

export interface EventSource {
  on(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  once(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  off(name?: string, callback?: EventCallback, context?: unknown): this;
  trigger(name: string, ...args: unknown[]): this;
  triggerMethod(eventName: string, ...args: unknown[]): unknown;
  listenTo(source: EventSource, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  listenToOnce(source: EventSource, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  stopListening(source?: EventSource, name?: string, callback?: EventCallback): this;
}

export type ModelAttributes = Record<string, unknown>;

export interface MutationOptions {
  silent?: boolean;
  [key: string]: unknown;
}

export declare class Model<Attributes extends ModelAttributes = ModelAttributes> implements EventSource {
  constructor(attributes?: Partial<Attributes> | null, options?: unknown);
  static extend(
    prototypeProperties: Record<PropertyKey, unknown>,
    staticProperties?: Record<PropertyKey, unknown>
  ): typeof Model;

  attributes: Attributes;
  changed: Partial<Attributes>;
  readonly cid: string;
  id: unknown;
  idAttribute: string;

  initialize(attributes?: Partial<Attributes> | null, options?: unknown): void;
  get<Key extends keyof Attributes>(key: Key): Attributes[Key] | undefined;
  get(key: string): unknown;
  has(key: string): boolean;
  set(attributes: Partial<Attributes>, options?: MutationOptions | null): this;
  set(key: string, value: unknown, options?: MutationOptions | null): this;
  unset(key: string, options?: MutationOptions | null): this;
  clear(options?: MutationOptions | null): this;
  reset(attributes?: Partial<Attributes>, options?: MutationOptions | null): this;
  toJSON(): Attributes;
  isDestroyed(): boolean;
  destroy(options?: unknown): this;

  on(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  once(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  off(name?: string, callback?: EventCallback, context?: unknown): this;
  trigger(name: string, ...args: unknown[]): this;
  triggerMethod(eventName: string, ...args: unknown[]): unknown;
  listenTo(source: EventSource, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  listenToOnce(source: EventSource, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  stopListening(source?: EventSource, name?: string, callback?: EventCallback): this;
}

export type ModelInput<M extends Model = Model> = M | ModelAttributes;

export interface CollectionOptions<M extends Model = Model> {
  model?: new (attributes?: ModelAttributes, options?: unknown) => M;
}

export type CollectionChange<M extends Model = Model> =
  | { kind: 'reset' }
  | { kind: 'reorder' }
  | {
      kind: 'update';
      added: M[];
      removed: M[];
      updated: Array<{ previous: M; current: M }>;
    };

export declare class Collection<M extends Model = Model> implements EventSource, Iterable<M> {
  constructor(
    models?: ModelInput<M> | ReadonlyArray<ModelInput<M>> | null,
    options?: CollectionOptions<M> | null
  );
  static extend(
    prototypeProperties: Record<PropertyKey, unknown>,
    staticProperties?: Record<PropertyKey, unknown>
  ): typeof Collection;

  readonly models: M[];
  readonly length: number;
  model: new (attributes?: ModelAttributes, options?: unknown) => M;

  initialize(
    models?: ModelInput<M> | ReadonlyArray<ModelInput<M>> | null,
    options?: CollectionOptions<M> | null
  ): void;
  at(index: number): M | undefined;
  get(identity: unknown): M | undefined;
  indexOf(model: M): number;
  forEach(callback: (model: M, index: number, models: M[]) => void, context?: unknown): void;
  map<Result>(callback: (model: M, index: number, models: M[]) => Result, context?: unknown): Result[];
  add(model: ModelInput<M> | null, options?: MutationOptions | null): M | undefined;
  add(models: ReadonlyArray<ModelInput<M>>, options?: MutationOptions | null): M[];
  remove(identity: unknown, options?: MutationOptions | null): M | undefined;
  remove(identities: ReadonlyArray<unknown>, options?: MutationOptions | null): M[];
  reset(models?: ModelInput<M> | ReadonlyArray<ModelInput<M>> | null, options?: MutationOptions | null): this;
  replace(previous: unknown, current: ModelInput<M>, options?: MutationOptions | null): M | undefined;
  touch(identity: unknown, options?: MutationOptions | null): M | undefined;
  move(identity: unknown, index: number, options?: MutationOptions | null): M | undefined;
  swap(first: unknown, second: unknown, options?: MutationOptions | null): this;
  sort(comparator?: string | ((left: M, right: M) => number), options?: MutationOptions | null): this;
  toJSON(): ModelAttributes[];
  isDestroyed(): boolean;
  destroy(options?: unknown): this;
  [Symbol.iterator](): IterableIterator<M>;

  on(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  once(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  off(name?: string, callback?: EventCallback, context?: unknown): this;
  trigger(name: string, ...args: unknown[]): this;
  triggerMethod(eventName: string, ...args: unknown[]): unknown;
  listenTo(source: EventSource, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  listenToOnce(source: EventSource, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  stopListening(source?: EventSource, name?: string, callback?: EventCallback): this;
}

export declare const DataApi: {
  key(model: { id?: unknown; cid?: unknown }): unknown;
  get(model: Model | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey): unknown;
  has(model: Model | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey): boolean;
  serialize(model: unknown): unknown;
  models<M extends Model>(collection: Collection<M>): M[];
  subscribe(
    source: EventSource,
    eventName: string,
    callback: EventCallback,
    context?: unknown
  ): () => void;
  observeCollection<M extends Model>(
    collection: Collection<M>,
    callback: (change: CollectionChange<M>) => void,
    context?: unknown
  ): () => void;
};

export declare const StateApi: {
  subscribe(
    source: EventSource,
    eventName: string,
    callback: EventCallback,
    context?: unknown
  ): () => void;
  disposeOwned(source: { destroy?: () => unknown } | null | undefined): void;
};

export declare function triggerMethod(this: unknown, eventName: string, ...args: unknown[]): unknown;
