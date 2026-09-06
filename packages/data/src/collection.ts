import { Events, extend } from 'marionette';
import assignOwn from './assign-own.ts';
import Model, { addModelOwner, removeModelOwner } from './model.ts';
import {
  initializeObservers,
  notifyCollection,
  releaseObservers
} from './observers.ts';

import type { EventSource } from './events.ts';
import type { Merge, Constructed, CallableParent } from './extend-types.ts';
import type { ModelInstance as ModelType, ModelAttributes, MutationOptions } from './model.ts';

type CollectionExtend<Base extends ModelType, Props extends object, Statics extends object> = {
  extend<Added extends { constructor: (...args: never[]) => unknown }, AddedStatics extends object = {}>(
    this: Function & { prototype: object },
    prototypeProperties: Added & ThisType<Merge<CollectionInstance<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: CallableParent,
    prototypeProperties?: Added & ThisType<Merge<CollectionInstance<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): CollectionExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
}['extend'];

// A configured model can replace an input instance. Constructor options may
// replace that configuration again, so retain both possible model families.
type ConfiguredModel<Factory> = Factory extends new (...args: never[]) => infer M
  ? M extends ModelType ? M : never : never;
type ExtendedCollectionInstance<M extends ModelType, Props extends object> = 'model' extends keyof Props
  ? Merge<CollectionInstance<M | ConfiguredModel<Props['model']>>, Omit<Props, 'model'>>
  : Merge<CollectionInstance<M>, Props>;

type CollectionConstructor<Base extends ModelType, Props extends object, Statics extends object> =
  Props extends { constructor: (...args: infer Args) => unknown }
    ? {
        new (...args: Args): Constructed<Props, ExtendedCollectionInstance<Base, Props>>;
        (this: ThisParameterType<Props['constructor']>, ...args: Args): ReturnType<Props['constructor']>;
        prototype: Merge<CollectionInstance<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : CollectionExtend<Base, Props, Statics>;
      }
    : {
        new <M extends Base = Base>(
          models?: ModelInput<M> | ReadonlyArray<ModelInput<M>> | null,
          options?: CollectionOptions<M> | null
        ): ExtendedCollectionInstance<M, Props>;
        (this: object, models?: ModelInput<Base> | ReadonlyArray<ModelInput<Base>> | null, options?: CollectionOptions<Base> | null): void;
        prototype: Merge<CollectionInstance<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : CollectionExtend<Base, Props, Statics>;
      };

type CollectionExtension<Base extends ModelType, Props extends object, Statics extends object> =
  [keyof Statics] extends [never] ? CollectionConstructor<Base, Props, Statics>
    : CollectionConstructor<Base, Props, Statics> & Omit<Statics, 'prototype' | 'extend'>;

export type ModelInput<M extends ModelType = ModelType> = M | ModelAttributes;

export interface CollectionOptions<M extends ModelType = ModelType> {
  model?: new (attributes?: ModelAttributes, options?: unknown) => M;
}

export type CollectionChange<M extends ModelType = ModelType> =
  | { kind: 'reset' }
  | { kind: 'reorder' }
  | {
      kind: 'update';
      added: M[];
      removed: M[];
      updated: Array<{ previous: M; current: M }>;
    };

export interface Collection<M extends ModelType = ModelType> extends EventSource, Iterable<M> {
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
  [Symbol.iterator](): ReturnType<M[][typeof Symbol.iterator]>;
}

export type CollectionInstance<M extends ModelType = ModelType> = Collection<M>;

interface CollectionInstanceRuntime extends CollectionInstance {
  models: ModelType[];
  length: number;
  _isDestroyed: boolean;
  comparator?: string | ((left: ModelType, right: ModelType) => number);
  _prepareModel(model: ModelInput): ModelType;
  _bindModel(model: ModelType): void;
  _unbindModel(model: ModelType): void;
  _bindModels(models: ModelType[]): void;
  _replaceBindings(previousModels: ModelType[], currentModels: ModelType[]): void;
  _onModelEvent(eventName: string, model: ModelType, ...args: unknown[]): void;
  _notify(change: CollectionChange): void;
}

function asArray<Input>(models: Input | ReadonlyArray<Input> | null | undefined): ReadonlyArray<Input> {
  if (models == null) { return []; }
  return Array.isArray(models) ? models : [models as Input];
}

function normalizeOptions<Options>(options: Options | null | undefined): Options | Record<string, never> {
  return options == null ? {} : options;
}

function sameValueZero(left: unknown, right: unknown) {
  // Keep this aligned with CollectionView's stable-key equality.
  return left === right || Number.isNaN(left) && Number.isNaN(right);
}

function assertUniqueModels(models: ModelType[]) {
  const knownModels = new Set();
  const knownIds = new Set();

  for (const model of models) {
    if (knownModels.has(model) || model.id != null && knownIds.has(model.id)) {
      throw new TypeError('@marionette/data Collection models must have unique instances and ids.');
    }
    knownModels.add(model);
    if (model.id != null) { knownIds.add(model.id); }
  }
}

function releaseOwnedModel(collection: CollectionInstanceRuntime, model: ModelType) {
  const nextModels = collection.models.filter(current => current !== model);
  const options = {};
  const change: CollectionChange = { kind: 'update', added: [], removed: [model], updated: [] };
  collection._unbindModel(model);
  collection.models = nextModels;
  collection.length = nextModels.length;
  collection._notify(change);
  collection.triggerMethod('remove', model, collection, options);
  collection.triggerMethod('update', collection, { ...options, changes: change });
}

// The constructor and generic instance interface share the public name.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Collection = function(this: CollectionInstanceRuntime, models: ModelInput | ReadonlyArray<ModelInput> | null = [], options: CollectionOptions | null = {}) {
  options = normalizeOptions(options);
  this.models = [];
  this.length = 0;
  if (options.model) { this.model = options.model; }
  initializeObservers(this);
  this.reset(models, { silent: true });
  this.initialize(models, options);
} as unknown as CollectionExtension<ModelType, {}, {}>;

(Collection as unknown as { extend: typeof extend }).extend = extend;

assignOwn(Collection.prototype, Events, {
  model: Model,
  _isDestroyed: false,

  initialize() {},

  _prepareModel(model: ModelInput) {
    const ModelClass = this.model;
    return model instanceof ModelClass ? model : new ModelClass(model as ModelAttributes);
  },

  _bindModel(model: ModelType) {
    model.on('all', this._onModelEvent, this);
    addModelOwner(model, this, () => releaseOwnedModel(this, model));
  },

  _unbindModel(model: ModelType) {
    model.off('all', this._onModelEvent, this);
    removeModelOwner(model, this);
  },

  _bindModels(models: ModelType[]) {
    for (const model of models) { this._bindModel(model); }
  },

  _replaceBindings(previousModels: ModelType[], currentModels: ModelType[]) {
    let added = currentModels;
    let removed = previousModels;
    if (previousModels.length && currentModels.length) {
      const previous = new Set(previousModels);
      const current = new Set(currentModels);
      added = currentModels.filter(model => !previous.has(model));
      removed = previousModels.filter(model => !current.has(model));
    }

    this._bindModels(added);
    for (const model of removed) { this._unbindModel(model); }
  },

  _onModelEvent(eventName: string, model: ModelType, ...args: unknown[]) {
    this.triggerMethod(eventName, model, ...args);
  },

  _notify(change: CollectionChange) {
    notifyCollection(this, change);
  },

  at(index: number) {
    return this.models.at(index);
  },

  get(identity: unknown) {
    if (identity == null) { return undefined; }
    return this.models.find(model =>
      model === identity || model.cid === identity || sameValueZero(model.id, identity)
    );
  },

  indexOf(model: ModelType) {
    return this.models.indexOf(model);
  },

  forEach(callback: (model: ModelType, index: number, models: ModelType[]) => void, context?: unknown) {
    this.models.forEach(callback, context);
  },

  map<Result>(callback: (model: ModelType, index: number, models: ModelType[]) => Result, context?: unknown) {
    return this.models.map(callback, context);
  },

  add(models: ModelInput | ReadonlyArray<ModelInput> | null, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return Array.isArray(models) ? [] : undefined; }
    const added: ModelType[] = [];
    const knownModels = new Set(this.models);
    const knownIds = new Set(
      this.models.filter(model => model.id != null).map(model => model.id)
    );
    for (const candidate of asArray(models)) {
      if (!(candidate instanceof this.model) && candidate != null && typeof candidate === 'object') {
        const idAttribute = this.model.prototype.idAttribute;
        const rawId = Object.hasOwn(candidate, idAttribute) ? (candidate as ModelAttributes)[idAttribute] : undefined;
        if (rawId != null && knownIds.has(rawId)) { continue; }
      }
      const model = this._prepareModel(candidate);
      if (knownModels.has(model) || model.id != null && knownIds.has(model.id)) { continue; }
      added.push(model);
      knownModels.add(model);
      if (model.id != null) { knownIds.add(model.id); }
    }
    if (!added.length) { return Array.isArray(models) ? added : undefined; }
    this._bindModels(added);

    const at = Number.isInteger(options.at) ?
      Math.max(0, Math.min(options.at as number, this.models.length)) : this.models.length;
    this.models.splice(at, 0, ...added);
    this.length = this.models.length;

    if (!options.silent) {
      const change: CollectionChange = { kind: 'update', added, removed: [], updated: [] };
      this._notify(change);
      for (const model of added) { this.triggerMethod('add', model, this, options); }
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return Array.isArray(models) ? added : added[0];
  },

  remove(models: unknown, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return Array.isArray(models) ? [] : undefined; }
    const removed: ModelType[] = [];
    for (const candidate of asArray(models)) {
      const model = this.get(candidate);
      if (!model || removed.includes(model)) { continue; }
      removed.push(model);
    }
    if (!removed.length) { return Array.isArray(models) ? removed : undefined; }
    const nextModels = this.models.filter(model => !removed.includes(model));
    this._replaceBindings(this.models, nextModels);
    this.models = nextModels;
    this.length = this.models.length;

    if (!options.silent) {
      const change: CollectionChange = { kind: 'update', added: [], removed, updated: [] };
      this._notify(change);
      for (const model of removed) { this.triggerMethod('remove', model, this, options); }
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return Array.isArray(models) ? removed : removed[0];
  },

  reset(models: ModelInput | ReadonlyArray<ModelInput> | null = [], options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return this; }
    const preparedModels = asArray(models).map(model => this._prepareModel(model));
    assertUniqueModels(preparedModels);
    this._replaceBindings(this.models, preparedModels);
    this.models = preparedModels;
    this.length = this.models.length;

    if (!options.silent) {
      this._notify({ kind: 'reset' });
      this.triggerMethod('reset', this, options);
    }
    return this;
  },

  replace(previous: unknown, current: ModelInput, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return undefined; }
    const previousModel = this.get(previous);
    if (!previousModel) { return undefined; }
    const currentModel = this._prepareModel(current);
    const index = this.models.indexOf(previousModel);
    const nextModels = this.models.slice();
    nextModels[index] = currentModel;
    assertUniqueModels(nextModels);
    const previousKey = previousModel.id == null ? previousModel.cid : previousModel.id;
    const currentKey = currentModel.id == null ? currentModel.cid : currentModel.id;
    this._replaceBindings([previousModel], [currentModel]);
    this.models[index] = currentModel;

    if (!options.silent) {
      const change: CollectionChange = sameValueZero(previousKey, currentKey) ? {
        kind: 'update',
        added: [],
        removed: [],
        updated: [{ previous: previousModel, current: currentModel }]
      } : {
        kind: 'update',
        added: [currentModel],
        removed: [previousModel],
        updated: []
      };
      this._notify(change);
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return currentModel;
  },

  touch(model: unknown, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    const currentModel = this.get(model);
    if (!currentModel || this._isDestroyed) { return undefined; }
    if (!options.silent) {
      const change: CollectionChange = {
        kind: 'update',
        added: [],
        removed: [],
        updated: [{ previous: currentModel, current: currentModel }]
      };
      this._notify(change);
      this.triggerMethod('update', this, { ...options, changes: change });
    }
    return currentModel;
  },

  move(model: unknown, index: number, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    const currentModel = this.get(model);
    if (!currentModel || this._isDestroyed) { return undefined; }
    if (!Number.isInteger(index)) {
      throw new TypeError('@marionette/data Collection.move() requires an integer index.');
    }
    const previousIndex = this.models.indexOf(currentModel);
    const nextIndex = Math.max(0, Math.min(index, this.models.length - 1));
    if (previousIndex === nextIndex) { return currentModel; }
    this.models.splice(previousIndex, 1);
    this.models.splice(nextIndex, 0, currentModel);
    if (!options.silent) {
      this._notify({ kind: 'reorder' });
      this.triggerMethod('reorder', this, options);
    }
    return currentModel;
  },

  swap(first: unknown, second: unknown, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    const firstModel = this.get(first);
    const secondModel = this.get(second);
    if (!firstModel || !secondModel || firstModel === secondModel || this._isDestroyed) { return this; }
    const firstIndex = this.models.indexOf(firstModel);
    const secondIndex = this.models.indexOf(secondModel);
    this.models[firstIndex] = secondModel;
    this.models[secondIndex] = firstModel;
    if (!options.silent) {
      this._notify({ kind: 'reorder' });
      this.triggerMethod('reorder', this, options);
    }
    return this;
  },

  sort(this: CollectionInstanceRuntime, comparator: string | ((left: ModelType, right: ModelType) => number) | undefined = this.comparator, options: MutationOptions | null = {}) {
    options = normalizeOptions(options);
    if (this._isDestroyed) { return this; }
    const previousModels = this.models.slice();
    if (typeof comparator === 'string') {
      this.models.sort((left, right) => {
        // Attribute ordering follows JavaScript relational coercion.
        const leftValue = left.get(comparator) as string | number | bigint;
        const rightValue = right.get(comparator) as string | number | bigint;
        return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      });
    } else if (typeof comparator === 'function') {
      this.models.sort(comparator.bind(this));
    } else {
      return this;
    }
    if (this.models.every((model, index) => model === previousModels[index])) { return this; }
    if (!options.silent) {
      this._notify({ kind: 'reorder' });
      this.triggerMethod('reorder', this, options);
    }
    return this;
  },

  toJSON() {
    return this.models.map(model => model.toJSON());
  },

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy(options?: unknown) {
    if (this._isDestroyed) { return this; }
    this._isDestroyed = true;
    for (let index = this.models.length; index--;) { this._unbindModel(this.models[index]); }
    releaseObservers(this);
    this.triggerMethod('destroy', this, options);
    this.stopListening();
    this.off();
    return this;
  }
} satisfies ThisType<CollectionInstanceRuntime> & Pick<CollectionInstanceRuntime,
  'model' | '_isDestroyed' | 'initialize' | '_prepareModel' | '_bindModel' |
  '_unbindModel' | '_bindModels' | '_replaceBindings' |
  '_onModelEvent' | '_notify' | 'at' | 'get' | 'indexOf' | 'forEach' | 'map' |
  'reset' | 'replace' | 'touch' | 'move' | 'swap' | 'sort' | 'toJSON' |
  'isDestroyed' | 'destroy'> & {
  add(models: ModelInput | ReadonlyArray<ModelInput> | null, options?: MutationOptions | null): ModelType | ModelType[] | undefined;
  remove(models: unknown, options?: MutationOptions | null): ModelType | ModelType[] | undefined;
});

Collection.prototype[Symbol.iterator] = function(this: CollectionInstanceRuntime) {
  return this.models[Symbol.iterator]();
};

export default Collection;
