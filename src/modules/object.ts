// Object
// ------

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.ts';
import uniqueId from '../utils/unique-id.ts';
import CommonMixin from '../mixins/common.ts';
import DestroyMixin from '../mixins/destroy.js';
import RadioMixin from '../mixins/radio.js';
import StateMixin from '../mixins/state.js';
import disposeAll from '../utils/dispose-all.ts';
import { setStateApi } from '../runtime/state-api.ts';
import type { StateApi } from '../runtime/state-api.ts';
import type getOption from './common/get-option.ts';
import type mergeOptions from './common/merge-options.ts';
import type { Channel, RadioApi } from './radio.ts';
import type { Events } from '../mixins/events.ts';
import type { Bindings } from './common/normalize-methods.ts';
import type normalizeMethods from './common/normalize-methods.ts';
import type { bindEvents, unbindEvents } from './common/bind-events.ts';
import type { bindRequests, unbindRequests } from './common/bind-requests.ts';

export type { Channel, RadioApi } from './radio.ts';
export type { Bindings } from './common/normalize-methods.ts';
export type { StateApi } from '../runtime/state-api.ts';

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
  State: Partial<StateApi<never>>;
  initialize(options?: Options): void;
  getState(): State;
  createState(options?: Options): unknown;
  isDestroyed(): boolean;
  destroy<Receiver>(this: Receiver, options?: unknown): Receiver;
  getOption: typeof getOption;
  mergeOptions: typeof mergeOptions;
  normalizeMethods: typeof normalizeMethods;
  bindEvents: typeof bindEvents;
  unbindEvents: typeof unbindEvents;
  bindRequests: typeof bindRequests;
  unbindRequests: typeof unbindRequests;
  getChannel(): Channel | undefined;
}

type Merge<Left, Right> = [Extract<keyof Left, keyof Right>] extends [never]
  ? Left & Right : Omit<Left, keyof Right> & Right;
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
  Merge<MnObject<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State>,
    'options' extends keyof Props ? Omit<Props, 'options'> : Props>;

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
  setStateApi: typeof setStateApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    prototypeProperties?: Added & ThisType<Instance<
      Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>
    >>,
    staticProperties?: AddedStatics & ThisType<MnObjectConstructor<
      Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>,
      Merge<Statics, AddedStatics>
    >>
  ): MnObjectConstructor<
    Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>, StateFor<Merge<Props, Added>>,
    Merge<Statics, AddedStatics>
  >;
}, Statics>;

interface ObjectInternals {
  cid: string;
  cidPrefix: string;
  options?: unknown;
  mergeOptions: typeof mergeOptions;
  _setOptions: typeof CommonMixin._setOptions;
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
