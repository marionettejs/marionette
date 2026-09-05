// Event names do not encode payload types; registration accepts typed handlers.
export type EventCallback = (...args: never[]) => unknown;

interface Source {
  on(name: string, callback?: (...args: unknown[]) => unknown, context?: unknown): unknown;
  off(name?: string | null, callback?: ((...args: unknown[]) => unknown) | null, context?: unknown): unknown;
}

interface TriggerTarget {
  trigger: EventCallback;
}

export interface EventSource extends Source {
  on(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  on(events: Record<string, EventCallback>, context?: unknown, explicitContext?: unknown): this;
  once(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  once(events: Record<string, EventCallback>, context?: unknown, explicitContext?: unknown): this;
  off(name?: string | null, callback?: EventCallback | null, context?: unknown): this;
  off(events: Record<string, EventCallback>, context?: unknown, explicitContext?: unknown): this;
  trigger(name: string, ...args: unknown[]): this;
  trigger(events: Record<string, unknown>): this;
  triggerMethod: typeof triggerMethod;
  listenTo(source: Source | null | undefined, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  listenToOnce(source: Source | null | undefined, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  stopListening(source?: Source | null, name?: string | Record<string, EventCallback> | null, callback?: EventCallback | null): this;
}

export type ModelAttributes = Record<string, unknown>;

export interface MutationOptions {
  silent?: boolean;
  [key: string]: unknown;
}

type Merge<Left, Right> = [Extract<keyof Left, keyof Right>] extends [never]
  ? Left & Right : Omit<Left, keyof Right> & Right;

// Unknown constructor results cannot promise an instance. An explicit generic
// receiver return preserves descendants; void/primitive returns declare ordinary construction.
type Returned<Result, Normal> = Result extends object ? Result : Normal;
type Constructed<Props, Normal> = Props extends { constructor: infer Constructor }
  ? Constructor extends (...args: never[]) => unknown
    ? unknown extends ReturnType<Constructor> ? unknown
      : Constructor extends <Receiver extends ThisParameterType<Constructor> & object>(
          this: Receiver, ...args: Parameters<Constructor>
        ) => Receiver ? Normal : Returned<ReturnType<Constructor>, Normal>
    : Normal
  : Normal;

interface CallableParent {
  (...args: never[]): unknown;
  prototype: object;
}

type ModelExtend<Base extends ModelAttributes, Props extends object, Statics extends object> = {
  extend<Added extends { constructor: (...args: never[]) => unknown }, AddedStatics extends object = {}>(
    this: Function & { prototype: object },
    prototypeProperties: Added & ThisType<Merge<Model<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: CallableParent,
    prototypeProperties?: Added & ThisType<Merge<Model<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
}['extend'];

type ModelConstructor<Base extends ModelAttributes, Props extends object, Statics extends object> =
  Props extends { constructor: (...args: infer Args) => unknown }
    ? {
        new (...args: Args): Constructed<Props, Merge<Model<Base>, Props>>;
        (this: ThisParameterType<Props['constructor']>, ...args: Args): ReturnType<Props['constructor']>;
        prototype: Merge<Model<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : ModelExtend<Base, Props, Statics>;
      }
    : {
        new <Attributes extends Base = Base>(attributes?: Partial<Attributes> | null, options?: unknown): Merge<Model<Attributes>, Props>;
        (this: object, attributes?: Partial<Base> | null, options?: unknown): void;
        prototype: Merge<Model<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : ModelExtend<Base, Props, Statics>;
      };

type ModelExtension<Base extends ModelAttributes, Props extends object, Statics extends object> =
  [keyof Statics] extends [never] ? ModelConstructor<Base, Props, Statics>
    : ModelConstructor<Base, Props, Statics> & Omit<Statics, 'prototype' | 'extend'>;

type CollectionExtend<Base extends Model, Props extends object, Statics extends object> = {
  extend<Added extends { constructor: (...args: never[]) => unknown }, AddedStatics extends object = {}>(
    this: Function & { prototype: object },
    prototypeProperties: Added & ThisType<Merge<Collection<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: CallableParent,
    prototypeProperties?: Added & ThisType<Merge<Collection<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
}['extend'];

// A configured model can replace an input instance. Constructor options may
// replace that configuration again, so retain both possible model families.
type ConfiguredModel<Factory> = Factory extends new (...args: never[]) => infer M
  ? M extends Model ? M : never : never;
type CollectionInstance<M extends Model, Props extends object> = 'model' extends keyof Props
  ? Merge<Collection<M | ConfiguredModel<Props['model']>>, Omit<Props, 'model'>>
  : Merge<Collection<M>, Props>;

type CollectionConstructor<Base extends Model, Props extends object, Statics extends object> =
  Props extends { constructor: (...args: infer Args) => unknown }
    ? {
        new (...args: Args): Constructed<Props, CollectionInstance<Base, Props>>;
        (this: ThisParameterType<Props['constructor']>, ...args: Args): ReturnType<Props['constructor']>;
        prototype: Merge<Collection<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : CollectionExtend<Base, Props, Statics>;
      }
    : {
        new <M extends Base = Base>(
          models?: ModelInput<M> | ReadonlyArray<ModelInput<M>> | null,
          options?: CollectionOptions<M> | null
        ): CollectionInstance<M, Props>;
        (this: object, models?: ModelInput<Base> | ReadonlyArray<ModelInput<Base>> | null, options?: CollectionOptions<Base> | null): void;
        prototype: Merge<Collection<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : CollectionExtend<Base, Props, Statics>;
      };

type CollectionExtension<Base extends Model, Props extends object, Statics extends object> =
  [keyof Statics] extends [never] ? CollectionConstructor<Base, Props, Statics>
    : CollectionConstructor<Base, Props, Statics> & Omit<Statics, 'prototype' | 'extend'>;

export declare const Model: ModelExtension<ModelAttributes, {}, {}>;
export interface Model<Attributes extends ModelAttributes = ModelAttributes> extends EventSource {
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

export declare const Collection: CollectionExtension<Model, {}, {}>;
export interface Collection<M extends Model = Model> extends EventSource, Iterable<M> {
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
  [Symbol.iterator](): ArrayIterator<M>;
}

export declare const DataApi: {
  key(model: { id?: unknown; cid?: unknown }): unknown;
  get(model: Model | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey): unknown;
  has(model: Model | Record<PropertyKey, unknown> | null | undefined, property: PropertyKey): boolean;
  serialize(model: unknown): unknown;
  models<M extends Model>(collection: Collection<M>): M[];
  subscribe(
    source: Source,
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
    source: Source,
    eventName: string,
    callback: EventCallback,
    context?: unknown
  ): () => void;
  disposeOwned(source: { destroy?: () => unknown } | null | undefined): void;
};

export declare function triggerMethod(this: TriggerTarget, eventName: string, ...args: unknown[]): unknown;
