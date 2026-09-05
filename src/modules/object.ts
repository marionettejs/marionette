// Object
// ------

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.ts';
import uniqueId from '../utils/unique-id.ts';
import CommonMixin from '../mixins/common.js';
import DestroyMixin from '../mixins/destroy.js';
import RadioMixin from '../mixins/radio.js';
import StateMixin from '../mixins/state.js';
import disposeAll from '../utils/dispose-all.ts';
import { setStateApi } from '../runtime/state-api.js';

export type EventCallback = (...args: never[]) => unknown;
export type EventMap = Record<string, EventCallback>;
export type Bindings = Record<string, string | EventCallback>;

export interface EventSource {
  on(name: string, callback?: EventCallback, context?: unknown): unknown;
  off(name?: string | null, callback?: EventCallback | null, context?: unknown): unknown;
}

export interface Events extends EventSource {
  on(name: string, callback?: EventCallback, context?: unknown): this;
  on(events: EventMap, context?: unknown): this;
  once(name: string, callback?: EventCallback, context?: unknown): this;
  once(events: EventMap, context?: unknown): this;
  off(name?: string | null, callback?: EventCallback | null, context?: unknown): this;
  off(events: EventMap, context?: unknown): this;
  listenTo(source: EventSource, name: string | EventMap, callback?: EventCallback): this;
  listenToOnce(source: EventSource, name: string | EventMap, callback?: EventCallback): this;
  stopListening(source?: EventSource | null, name?: string | EventMap | null, callback?: EventCallback | null): this;
  trigger(name: string, ...args: unknown[]): this;
  trigger(events: Record<string, unknown>): this;
  triggerMethod(name: string, ...args: unknown[]): unknown;
}

export interface Channel extends Events {
  channelName: string;
  reply(name: string | Record<string, unknown>, callback?: unknown, context?: unknown): this;
  replyOnce(name: string | Record<string, unknown>, callback?: unknown, context?: unknown): this;
  stopReplying(name?: string | Record<string, unknown> | null, callback?: unknown, context?: unknown): this;
  request(name: string, ...args: unknown[]): unknown;
  request(requests: Record<string, unknown>, ...args: unknown[]): Record<string, unknown>;
  reset(): this;
}

export interface RadioApi {
  setDebug(enabled?: boolean): void;
  channel(name: string): Channel;
  on(channel: string, name: string, callback?: EventCallback, context?: unknown): Channel;
  on(channel: string, events: EventMap, context?: unknown): Channel;
  once(channel: string, name: string, callback?: EventCallback, context?: unknown): Channel;
  once(channel: string, events: EventMap, context?: unknown): Channel;
  off(channel: string, name?: string | null, callback?: EventCallback | null, context?: unknown): Channel;
  off(channel: string, events: EventMap, context?: unknown): Channel;
  listenTo(channel: string, source: EventSource, name: string | EventMap, callback?: EventCallback): Channel;
  listenToOnce(channel: string, source: EventSource, name: string | EventMap, callback?: EventCallback): Channel;
  stopListening(channel: string, source?: EventSource | null, name?: string | EventMap | null, callback?: EventCallback | null): Channel;
  trigger(channel: string, name: string, ...args: unknown[]): Channel;
  trigger(channel: string, events: Record<string, unknown>): Channel;
  triggerMethod(channel: string, name: string, ...args: unknown[]): unknown;
  reply(channel: string, name: string | Record<string, unknown>, callback?: unknown, context?: unknown): Channel;
  replyOnce(channel: string, name: string | Record<string, unknown>, callback?: unknown, context?: unknown): Channel;
  stopReplying(channel: string, name?: string | Record<string, unknown> | null, callback?: unknown, context?: unknown): Channel;
  request(channel: string, name: string, ...args: unknown[]): unknown;
  request(channel: string, requests: Record<string, unknown>, ...args: unknown[]): Record<string, unknown>;
  reset(name?: string): void;
  tuneIn(name: string): RadioApi;
  tuneOut(name: string): RadioApi;
}

export interface StateApi<Source = unknown> {
  subscribe: (source: Source, name: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
  disposeOwned?: (source: Source) => void;
}

export interface MnObject<Options extends object = object, State = object> extends Events {
  cid: string;
  cidPrefix: string;
  options: Options;
  channelName?: string | (() => string);
  radioEvents?: Bindings | (() => Bindings);
  radioRequests?: Bindings | (() => Bindings);
  stateEvents?: Bindings | (() => Bindings);
  state?: unknown;
  Radio: RadioApi;
  State: StateApi<State>;
  initialize(options?: Options): void;
  getState(): State;
  createState(options?: Options): unknown;
  isDestroyed(): boolean;
  destroy(options?: unknown): this;
  getOption<Key extends keyof Options | keyof this>(key: Key):
    (Key extends keyof Options ? Options[Key] : never) |
    (Key extends keyof this ? this[Key] : undefined);
  getOption(key: string): unknown;
  mergeOptions(options: object | null | undefined, keys: readonly string[]): void;
  normalizeMethods(bindings: Bindings): EventMap;
  normalizeMethods(bindings?: null | false): undefined;
  bindEvents(source?: EventSource | null, bindings?: Bindings | null): this;
  unbindEvents(source?: EventSource | null, bindings?: Bindings | null): this;
  bindRequests(channel?: Channel | null, bindings?: Bindings | null): this;
  unbindRequests(channel?: Channel | null, bindings?: Bindings | null): this;
  getChannel(): Channel | undefined;
}

type Merge<Left, Right> = Omit<Left, keyof Right> & Right;
type ArgumentsFor<Props, Previous extends unknown[]> =
  Props extends { constructor: (...args: infer Args) => unknown } ? Args :
  Props extends { initialize: (...args: infer Args) => unknown } ? Args : Previous;
type OptionsFor<Args extends unknown[]> = [NonNullable<Args[0]>] extends [never] ? object :
  NonNullable<Args[0]> extends object ? NonNullable<Args[0]> : object;
type DefaultOptions<Props> = Props extends { options: infer Options }
  ? Options extends (...args: never[]) => infer Result ? Result extends object ? Result : object
    : Options extends object ? Options : object
  : object;
type SuppliedState<Options, Previous> = 'state' extends keyof Options
  ? Exclude<Options['state'], undefined> | (undefined extends Options['state'] ? Previous : never)
  : Previous;
type StateFor<Props> = SuppliedState<Props,
  Props extends { createState: (...args: never[]) => infer State } ? State : object>;
type Instance<Props, Args extends unknown[], State> =
  MnObject<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State> & Omit<Props, 'options'>;

export type MnObjectConstructor<
  Props extends object = {},
  Args extends unknown[] = [options?: object],
  State = object,
  Statics extends object = {}
> = {
  new <Provided extends Args = Args>(...args: Provided): Instance<Props, Provided, SuppliedState<Provided[0], State>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: Merge<Instance<Props, Args, State>, Props>;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setStateApi<Constructor>(this: Constructor, api: Partial<StateApi<State>>): Constructor;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    prototypeProperties?: Added & ThisType<Instance<
      Merge<Props, Added>, ArgumentsFor<Added, Args>, StateFor<Merge<Props, Added>>
    >>,
    staticProperties?: AddedStatics & ThisType<MnObjectConstructor<
      Merge<Props, Added>, ArgumentsFor<Added, Args>, StateFor<Merge<Props, Added>>,
      Merge<Statics, AddedStatics>
    >>
  ): MnObjectConstructor<
    Merge<Props, Added>, ArgumentsFor<Added, Args>, StateFor<Merge<Props, Added>>,
    Merge<Statics, AddedStatics>
  >;
}, Statics>;

interface ObjectInternals {
  cid: string;
  cidPrefix: string;
  _setOptions(options: object | undefined, names: string[]): void;
  _initRadio(): void;
  _initState(options: object | undefined): void;
  initialize: { apply(receiver: object, args: IArguments): unknown };
  _initStateEvents(): void;
  stopListening(): void;
  _destroyRadio(): void;
  _destroyState(): void;
}

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests',
  'stateEvents'
];

// Object borrows many conventions and utilities from Backbone.
const MarionetteObject = function(this: ObjectInternals, options?: object) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  try {
    this._initRadio();
    this._initState(options);
    this.initialize.apply(this, arguments);
    this._initStateEvents();
  } catch (error) {
    disposeAll([
      () => this.stopListening(),
      () => this._destroyRadio(),
      () => this._destroyState()
    ], error);
  }
};

assignOwn(MarionetteObject, { extend, setStateApi });

// Object Methods
// --------------

assignOwn(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, {
  cidPrefix: 'mno',
});

// Existing mixins and prototype assignment establish this constructor shape.
export default MarionetteObject as unknown as MnObjectConstructor;
