import { Events, extend, setProperty } from '@marionette/utils';

import type { EventMethods as EventSource, Merge, Constructed, CallableParent } from '@marionette/utils';

export type ModelAttributes = Record<string, unknown>;
export interface MutationOptions {
  silent?: boolean;
  [key: string]: unknown;
}

type ModelExtend<Base extends ModelAttributes, Props extends object, Statics extends object> = {
  extend<Added extends { constructor: (...args: never[]) => unknown }, AddedStatics extends object = {}>(
    this: Function & { prototype: object },
    prototypeProperties: Added & ThisType<Merge<ModelInstance<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: CallableParent,
    prototypeProperties?: Added & ThisType<Merge<ModelInstance<Base>, Merge<Props, Added>>>,
    staticProperties?: AddedStatics & ThisType<ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>>
  ): ModelExtension<Base, Merge<Props, Added>, Merge<Statics, AddedStatics>>;
}['extend'];

type ModelConstructor<Base extends ModelAttributes, Props extends object, Statics extends object> =
  Props extends { constructor: (...args: infer Args) => unknown }
    ? {
        new (...args: Args): Constructed<Props, Merge<ModelInstance<Base>, Props>>;
        (this: ThisParameterType<Props['constructor']>, ...args: Args): ReturnType<Props['constructor']>;
        prototype: Merge<ModelInstance<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : ModelExtend<Base, Props, Statics>;
      }
    : {
        new <Attributes extends Base = Base>(attributes?: Partial<Attributes> | null, options?: unknown): Merge<ModelInstance<Attributes>, Props>;
        (this: object, attributes?: Partial<Base> | null, options?: unknown): void;
        prototype: Merge<ModelInstance<Base>, Props>;
        extend: 'extend' extends keyof Statics ? Statics['extend'] : ModelExtend<Base, Props, Statics>;
      };

type ModelExtension<Base extends ModelAttributes, Props extends object, Statics extends object> =
  [keyof Statics] extends [never] ? ModelConstructor<Base, Props, Statics>
    : ModelConstructor<Base, Props, Statics> & Omit<Statics, 'prototype' | 'extend'>;

export interface Model<Attributes extends ModelAttributes = ModelAttributes> extends EventSource {
  attributes: Partial<Attributes>;
  changed: Partial<Attributes>;
  readonly cid: string;
  id: unknown;
  idAttribute: string;

  initialize(attributes?: Partial<Attributes> | null, options?: unknown): void;
  get<Key extends keyof Attributes>(key: Key): Attributes[Key] | undefined;
  get(key: string): unknown;
  has(key: string): boolean;
  set(attributes: Partial<Attributes>, options?: MutationOptions | null): this;
  set<Key extends string>(key: Key, value: Key extends keyof Attributes ? Attributes[Key] | undefined : unknown, options?: MutationOptions | null): this;
  unset(key: string, options?: MutationOptions | null): this;
  clear(options?: MutationOptions | null): this;
  reset(attributes?: Partial<Attributes>, options?: MutationOptions | null): this;
  toObject(): Partial<Attributes>;
  isDestroyed(): boolean;
  destroy(options?: unknown): this;
}

export type ModelInstance<Attributes extends ModelAttributes = ModelAttributes> = Model<Attributes>;

interface ModelRuntime extends ModelInstance {
  cid: string;
  _isDestroyed: boolean;
  defaults?: ModelAttributes | (() => ModelAttributes);
}

let modelId = 0;

function getDefaults(model: ModelRuntime) {
  const defaults = model.defaults;
  return typeof defaults === 'function' ? defaults.call(model) : defaults;
}

function noChange<Receiver extends ModelRuntime>(model: Receiver) {
  if (!model._isDestroyed) { model.changed = {}; }
  return model;
}

function update<Receiver extends ModelRuntime>(model: Receiver, attributes: ModelAttributes, options: MutationOptions | null = {}, removed: string[] = []) {
  if (model._isDestroyed) { return model; }
  options = options == null ? {} : options;
  const previous: ModelAttributes = {};
  const changed: ModelAttributes = {};
  const changedKeys: string[] = [];

  for (const key of removed) {
    if (!Object.hasOwn(model.attributes, key)) { continue; }
    setProperty(previous, key, model.attributes[key]);
    setProperty(changed, key, undefined);
    changedKeys.push(key);
    delete model.attributes[key];
  }

  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    const hadKey = Object.hasOwn(model.attributes, key);
    if (hadKey && Object.is(model.attributes[key], value)) { continue; }
    if (hadKey) { setProperty(previous, key, model.attributes[key]); }
    setProperty(changed, key, value);
    changedKeys.push(key);
    setProperty(model.attributes, key, value);
  }

  if (!changedKeys.length) {
    model.changed = changed;
    return model;
  }
  model.id = model.get(model.idAttribute);
  model.changed = changed;

  if (!options.silent) {
    const change = { ...options, changed, previous };
    for (const key of changedKeys) {
      model.triggerMethod(`change:${ key }`, model, changed[key], change);
    }
    model.triggerMethod('change', model, change);
  }

  return model;
}

// The constructor and generic instance interface share the public name.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Model = function(this: ModelRuntime, attributes: ModelAttributes | null = {}, options: unknown = {}) {
  this.cid = `mnd${ ++modelId }`;
  this.attributes = {};
  const defaults = getDefaults(this);
  update(this, { ...defaults, ...attributes }, { silent: true });
  this.changed = {};
  this.initialize(attributes, options);
} as unknown as ModelExtension<ModelAttributes, {}, {}>;

(Model as unknown as { extend: typeof extend }).extend = extend;

Object.assign(Model.prototype, Events, {
  idAttribute: 'id',
  _isDestroyed: false,

  initialize() {},

  get(key: string) {
    return Object.hasOwn(this.attributes, key) ? this.attributes[key] : undefined;
  },

  has(key: string) {
    return Object.hasOwn(this.attributes, key);
  },

  set(key: string | ModelAttributes, value?: unknown, options?: MutationOptions | null) {
    if (key == null) { return noChange(this); }
    const attributes = typeof key === 'object' ? key : { [key]: value };
    return update(this, attributes, typeof key === 'object' ? value as MutationOptions | null | undefined : options);
  },

  unset(key: string, options?: MutationOptions | null) {
    return key == null ? noChange(this) : update(this, {}, options, [key]);
  },

  clear(options?: MutationOptions | null) {
    return update(this, {}, options, Object.keys(this.attributes));
  },

  reset(attributes: ModelAttributes = {}, options?: MutationOptions | null) {
    if (this._isDestroyed) { return this; }
    const next = { ...getDefaults(this), ...attributes };
    const removed = Object.keys(this.attributes).filter(key => !Object.hasOwn(next, key));
    return update(this, next, options, removed);
  },

  toObject() {
    return { ...this.attributes };
  },

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy(options?: unknown) {
    if (this._isDestroyed) { return this; }
    this._isDestroyed = true;
    this.triggerMethod('destroy', this, options);
    this.stopListening();
    this.off();
    return this;
  }
} satisfies ThisType<ModelRuntime> & Pick<ModelRuntime,
  'idAttribute' | '_isDestroyed' | 'initialize' | 'get' | 'has' | 'set' |
  'unset' | 'clear' | 'reset' | 'toObject' | 'isDestroyed' | 'destroy'>);

export default Model;
