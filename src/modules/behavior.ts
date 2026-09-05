// Behavior
// --------

// A Behavior is an isolated set of DOM /
// user interactions that can be mixed into any View.
// Behaviors allow you to blackbox View specific interactions
// into portable logical chunks, keeping your views simple and your code DRY.

import { assignOwn } from '../utils/assign-in.js';
import extend from '../utils/extend.ts';
import getValue from '../utils/get-value.ts';
import uniqueId from '../utils/unique-id.ts';
import CommonMixin from '../mixins/common.ts';
import DelegateEntityEventsMixin from '../mixins/delegate-entity-events.ts';
import StateMixin from '../mixins/state.ts';
import UIMixin from '../mixins/ui.ts';
import ViewEventsMixin from '../mixins/view-events.ts';
import { setEventDelegator } from '../runtime/event-delegator.ts';
import disposeAll from '../utils/dispose-all.ts';
import { setStateApi } from '../runtime/state-api.ts';

import type { EventSource } from '../mixins/events.ts';
import type { DataApi } from '../runtime/data-api.ts';
import type { StateApi } from '../runtime/state-api.ts';
import type { EventDelegator } from '../runtime/event-delegator.ts';
import type { UIHost, UIBindings, UISelectors } from '../mixins/ui.ts';
import type { ViewEventsHost, DOMEvents, DOMTriggers } from '../mixins/view-events.ts';
import type { StateHost } from '../mixins/state.ts';
import type { EntityEventHost } from '../mixins/delegate-entity-events.ts';
import type { BehaviorInstance as BehaviorLifecycle } from '../mixins/behaviors.ts';
import type { Constructed, Merge, ArgumentsFor, DefaultOptions, OptionsFor, StateFor, SuppliedState } from './object.ts';

export interface BehaviorHost<Query extends ArrayLike<Element> = ArrayLike<Element>, Wrapped = unknown> extends EventSource {
  el: Element;
  $el?: Wrapped;
  ui?: UIBindings | Record<string, Query>;
  model?: unknown;
  collection?: unknown;
  Data: Partial<DataApi>;
  _isDestroying?: boolean;
  _isDestroyed?: boolean;
  $(selector: string): Query;
  triggerMethod(event: string, ...args: unknown[]): unknown;
  _removeBehavior(behavior: BehaviorLifecycle): void;
}
export interface BehaviorOptions {
  events?: DOMEvents | (() => DOMEvents);
  triggers?: DOMTriggers | (() => DOMTriggers);
  ui?: UIBindings;
  modelEvents?: unknown;
  collectionEvents?: unknown;
  stateEvents?: unknown;
  state?: unknown;
}

type Common = Omit<typeof CommonMixin, 'initialize'>;
import type { BehaviorFluent } from './common/fluent-methods.ts';

export interface BehaviorInstance<Options extends object = BehaviorOptions, Host extends BehaviorHost = BehaviorHost, State = unknown,
  Query extends ArrayLike<Element> = ReturnType<Host['$']>, Wrapped = Host['$el']> extends Common, BehaviorFluent<{}> {
  cid: string;
  cidPrefix: string;
  options: Options;
  view: Host;
  el: Element;
  $el?: Wrapped;
  ui?: UIBindings | Record<string, Query>;
  events?: BehaviorOptions['events'];
  triggers?: BehaviorOptions['triggers'];
  modelEvents?: unknown;
  collectionEvents?: unknown;
  stateEvents?: unknown;
  state?: unknown;
  State: Partial<StateApi<never>>;
  EventDelegator: EventDelegator;
  initialize(options: Options, view: Host): void;
  createState(options?: Options): unknown;
  getState(): State;
  $(selector: string): Query;
  getUI(name: string): Query | undefined;
  normalizeUIString(value: string, bindings?: UISelectors): string;
  normalizeUIKeys<Value>(hash: Record<string, Value> | null | undefined, bindings?: UISelectors): Record<string, Value>;
  normalizeUIValues<Hash extends object>(hash: Hash, property?: string, bindings?: UISelectors): Hash;
  _undelegateViewEvents(): void;
}

type BehaviorArguments<Props, Previous extends unknown[]> =
  Props extends { constructor: (...args: infer Args) => unknown } ? Args :
  [options: ArgumentsFor<Props, Previous>[0], view: Previous[1]];
type BehaviorResult<Props, Args extends unknown[], Host extends BehaviorHost, State> =
  Extract<keyof BehaviorInstance, keyof Props> extends never ?
    BehaviorInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>, Host, State> & Props :
    Merge<Omit<BehaviorInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>, Host, State>, keyof BehaviorFluent<{}>>,
      'options' extends keyof Props ? Omit<Props, 'options'> : Props> & BehaviorFluent<Props>;
export type BehaviorConstructor<Props extends object = {}, Args extends unknown[] = [options: BehaviorOptions | undefined, view: BehaviorHost],
  State = unknown, Statics extends object = {}> = {
  new <Provided extends Args = Args>(...args: Provided): Constructed<Props, BehaviorResult<Props, Provided,
    Provided[1] extends BehaviorHost ? Provided[1] : BehaviorHost, SuppliedState<Provided[0], State>>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: BehaviorResult<Props, Args, Args[1] extends BehaviorHost ? Args[1] : BehaviorHost, State>;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setEventDelegator: typeof setEventDelegator;
  setStateApi: typeof setStateApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
    prototypeProperties?: Added & ThisType<BehaviorResult<Merge<Props, Added>, BehaviorArguments<Merge<Props, Added>, Args>,
      Args[1] extends BehaviorHost ? Args[1] : BehaviorHost, StateFor<Merge<Props, Added>>>>,
    staticProperties?: AddedStatics & ThisType<BehaviorConstructor<Merge<Props, Added>, BehaviorArguments<Merge<Props, Added>, Args>,
      StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>>>
  ): BehaviorConstructor<Merge<Props, Added>, BehaviorArguments<Merge<Props, Added>, Args>,
    StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>>;
}, Statics>;

type BehaviorInternals = BehaviorInstance & UIHost & ViewEventsHost & StateHost & EntityEventHost &
  typeof DelegateEntityEventsMixin & Omit<typeof StateMixin, 'State'> & typeof UIMixin & Omit<typeof ViewEventsMixin, 'EventDelegator'> & {
    _isDestroyed?: boolean;
  };

const ClassOptions = [
  'collectionEvents',
  'events',
  'modelEvents',
  'stateEvents',
  'triggers',
  'ui'
];

const Behavior = function(this: BehaviorInternals, options: BehaviorOptions | undefined, view: BehaviorHost) {
  // Setup reference to the view.
  // this comes in handy when a behavior
  // wants to directly talk up the chain
  // to the view.
  this.view = view;

  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  this._initViewEvents();
  this.el = view.el;
  if (view.$el) {
    this.$el = view.$el;
  }
  this._initState(options);

  try {
    // Construct an internal UI hash using the behaviors UI
    // hash combined and overridden by the view UI hash.
    // This allows the user to use UI hash elements defined
    // in the parent view as well as those defined in the behavior.
    // This order will help the reuse and share of a behavior
    // between multiple views, while letting a view override
    // a selector under an UI key.
    this.ui = assignOwn({}, getValue(this, 'ui'), getValue(view, 'ui')) as UISelectors;

    // Proxy view triggers
    this.listenTo(view, 'all', this.triggerMethod);

    (this.initialize as Function).apply(this, arguments);

    this._initStateEvents();
    if (this._isDestroyed) { return; }

    this._syncElement();
  } catch (error) {
    try {
      this.destroy();
    } catch {
      // Preserve the construction error after best-effort teardown.
    }
    throw error;
  }
};

assignOwn(Behavior, { extend, setEventDelegator, setStateApi });

// Behavior Methods
// --------------

assignOwn(Behavior.prototype, CommonMixin, DelegateEntityEventsMixin, StateMixin, UIMixin, ViewEventsMixin, {
  cidPrefix: 'mnb',

  // proxy behavior $ method to the view
  // this performs a configured DOM lookup scoped to the behavior's view.
  $(this: BehaviorInternals) {
    return (this.view.$ as { apply(receiver: BehaviorHost, args: IArguments): ArrayLike<Element> }).apply(this.view, arguments);
  },

  // Stops the behavior from listening to events.
  destroy(this: BehaviorInternals) {
    this._isDestroyed = true;
    disposeAll([
      () => this._deleteEntityEventHandlers(),
      () => this.view._removeBehavior(this),
      () => this.stopListening(),
      () => this._destroyState(),
      () => this._undelegateViewEvents()
    ]);

    return this;
  },

  _syncElement(this: BehaviorInternals) {
    this._undelegateViewEvents();

    this.el = this.view.el;
    if (this.view.$el) {
      this.$el = this.view.$el;
    } else {
      delete this.$el;
    }

    this._delegateViewEvents(this.view);

    return this;
  },

  bindUIElements(this: BehaviorInternals) {
    if (this.view._isDestroying || this.view._isDestroyed) { return this; }

    this._bindUIElements();

    return this;
  },

  unbindUIElements(this: BehaviorInternals) {
    this._unbindUIElements();

    return this;
  },

  getUI(this: BehaviorInternals, name: string) {
    return this._getUI(name);
  },

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents(this: BehaviorInternals) {
    if (this.view._isDestroying || this.view._isDestroyed) { return this; }

    this._delegateEntityEvents(this.view.model, this.view.collection, this.view.Data);

    return this;
  },

  undelegateEntityEvents(this: BehaviorInternals) {
    (this._undelegateEntityEvents as (...args: unknown[]) => void)(this.view.model, this.view.collection);

    return this;
  }
});

export default Behavior as unknown as BehaviorConstructor;
