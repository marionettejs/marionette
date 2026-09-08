// Object
// ------


import extend from '../utils/extend.ts';
import { uniqueId } from '@marionette/utils';
import CommonMixin from '../mixins/common.ts';
import DestroyMixin from '../mixins/destroy.ts';
import RadioMixin from '../mixins/radio.ts';
import StateMixin from '../mixins/state.ts';
import { setStateApi } from '../runtime/state-api.ts';
import type { StateApi } from '../runtime/state-api.ts';
import type {
  getOption,
  mergeOptions,
  Bindings,
  normalizeMethods,
  bindEvents,
  unbindEvents,
  bindRequests,
  unbindRequests,
  Merge,
  Constructed
} from '@marionette/utils';
import type { Channel, RadioApi } from '@marionette/radio';
import type { EventsContract as Events } from '@marionette/utils';

export type { Channel, RadioApi } from '@marionette/radio';
export type { Bindings } from '@marionette/utils';
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

export type { Merge, Constructed } from '@marionette/utils';

export type ArgumentsFor<Props, Previous extends unknown[]> =
  Props extends { constructor: (...args: infer Args) => unknown } ? Args :
  Props extends { initialize: (...args: infer Args) => unknown } ? Args : Previous;
export type OptionsFor<Args extends unknown[]> = [NonNullable<Args[0]>] extends [never] ? object :
  NonNullable<Args[0]> extends object ? NonNullable<Args[0]> : object;
export type DefaultOptions<Props> = Props extends { options: infer Options }
  ? Options extends (...args: never[]) => infer Result ? Result extends object ? Result : object
    : Options extends object ? Options : object
  : object;
export type SuppliedState<Options, Previous> = 'state' extends keyof Options
  ? Exclude<Options['state'], undefined> | (undefined extends Options['state'] ? Previous : never)
  : Previous;
export type StateFor<Props> = SuppliedState<Props,
  Props extends { createState: (...args: never[]) => infer State } ? State : object>;
export type Instance<Props, Args extends unknown[], State> =
  Merge<MnObject<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State>,
    'options' extends keyof Props ? Omit<Props, 'options'> : Props>;

// Optional type information avoids inferring through the whole recursive constructor.
// No property or symbol is created at runtime.
declare const constructorTypes: unique symbol;
interface ConstructorTypes {
  props: object;
  args: unknown[];
  state: unknown;
  statics: object;
}

export type MetadataFor<Parent> = typeof constructorTypes extends keyof Parent
  ? NonNullable<Parent[typeof constructorTypes]> extends ConstructorTypes
    ? NonNullable<Parent[typeof constructorTypes]> : never
  : never;

export type MnObjectConstructor<
  Props extends object = {},
  Args extends unknown[] = [options?: object],
  State = object,
  Statics extends object = {}
> = {
  readonly [constructorTypes]?: { props: Props; args: Args; state: State; statics: Statics };
  new <Provided extends Args = Args>(...args: Provided): Constructed<Props, Instance<Props, Provided, SuppliedState<Provided[0], State>>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: Merge<Instance<Props, Args, State>, Props>;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setStateApi: typeof setStateApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
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

  this._initRadio();
  this._initState(options);
  this.initialize.apply(this, arguments);
  this._initStateEvents();
};

Object.assign(MarionetteObject, { extend, setStateApi });

// Object Methods
// --------------

Object.assign(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, {
  cidPrefix: 'mno',
});

// Existing mixins and prototype assignment establish this constructor shape.
export default MarionetteObject as unknown as MnObjectConstructor;
