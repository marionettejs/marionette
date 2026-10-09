// Application
// -----------

import { setProperty, MarionetteError, uniqueId, getValue, normalizeBindings } from '@mnjs/utils';
import extend from '../utils/extend.ts';
import CommonMixin from '../mixins/common.ts';
import DestroyMixin from '../mixins/destroy.ts';
import RadioMixin from '../mixins/radio.ts';
import StateMixin from '../mixins/state.ts';
import Region from './region.ts';
import buildRegion from './common/build-region.ts';
import { setStateApi } from '../runtime/state-api.ts';
import { defaultRuntimeId, runtimeId } from '../runtime-id.ts';

import type { RegionInstance, RegionInternals, ShowOptions } from './region.ts';
import type { RegionClass, RegionDefinition } from './common/build-region.ts';
import type { SupportedView } from './common/view.ts';
import type { StateApi } from '../runtime/state-api.ts';
import type { RadioApi, Channel } from '@mnjs/radio';
import type { Bindings } from '@mnjs/utils';
import type { RadioHost } from '../mixins/radio.ts';
import type { StateHost } from '../mixins/state.ts';
import type { Constructed, Merge, ArgumentsFor, DefaultOptions, OptionsFor, StateFor, SuppliedState } from './object.ts';

export interface LifecycleContext {
  signal: AbortSignal;
}
type ChildApplications = Record<string, new () => ApplicationInstance<object, unknown>>;
export interface ApplicationOptions {
  childApps?: ChildApplications | (() => ChildApplications);
  channelName?: string | (() => string);
  radioEvents?: Bindings | (() => Bindings);
  radioRequests?: Bindings | (() => Bindings);
  region?: RegionDefinition;
  regionClass?: RegionClass;
  viewEvents?: Bindings | (() => Bindings);
  stateEvents?: Bindings | (() => Bindings);
  state?: unknown;
}
export interface ApplicationStartOptions {
  region?: RegionInstance;
  [key: string]: unknown;
}

export interface ApplicationRestartOptions {
  region?: RegionInstance;
  [key: string]: unknown;
}

type Common = typeof CommonMixin;
export interface ApplicationInstance<Options extends object = object, State = object, StartResult = unknown> extends Common {
  cid: string;
  cidPrefix: string;
  options: Options;
  childApps?: ApplicationOptions['childApps'];
  channelName?: ApplicationOptions['channelName'];
  radioEvents?: ApplicationOptions['radioEvents'];
  radioRequests?: ApplicationOptions['radioRequests'];
  region?: RegionDefinition;
  regionClass: RegionClass;
  viewEvents?: ApplicationOptions['viewEvents'];
  stateEvents?: ApplicationOptions['stateEvents'];
  state?: unknown;
  State: Partial<StateApi<never>>;
  Radio: RadioApi;
  preinitialize(options?: Options): void;
  initialize(options?: Options): void;
  createState(options?: Options): unknown;
  getState(): State;
  getChannel(): Channel | undefined;
  isDestroyed(): boolean;
  isRunning(): boolean;
  start(options?: ApplicationStartOptions): Promise<boolean>;
  stop(options?: unknown): boolean;
  restart(options?: ApplicationRestartOptions): Promise<boolean>;
  destroy(options?: unknown): boolean;
  prepareStart?(options: unknown, context: LifecycleContext): StartResult | PromiseLike<StartResult>;
  onBeforeStart?(application: this, options: unknown): unknown;
  onBeforeStop?(application: this, options: unknown): unknown;
  onBeforeDestroy?(application: this, options: unknown): unknown;
  onStart?(application: this, options: unknown, result: StartResult): unknown;
  onStop?(application: this, options: unknown): unknown;
  onDestroy?(application: this, options: unknown): unknown;
  addChildApp<Child extends ApplicationInstance<object, unknown>>(name: string, application: Child): Child;
  removeChildApp(name: string, options?: unknown): ApplicationInstance<object, unknown> | undefined;
  hasChildApp(name: string): boolean;
  getChildApp(name: string): ApplicationInstance<object, unknown> | undefined;
  getChildApps(): Record<string, ApplicationInstance<object, unknown>>;
  getName(): string | undefined;
  getRegion(): RegionInstance | undefined;
  setView<Child extends SupportedView>(view: Child): Child;
  showView(view?: undefined, options?: ShowOptions): SupportedView | undefined;
  showView<Child extends SupportedView>(view: Child, ...args: [options?: ShowOptions]): Child;
  getView(): SupportedView | undefined;
}

type StartResultFor<Props> = Props extends { prepareStart: (...args: never[]) => infer Result } ? Awaited<Result>
  : Props extends { prepareStart?: (...args: never[]) => infer Result } ? Awaited<Result> | undefined : unknown;
type ApplicationResult<Props, Args extends unknown[], State> = Merge<
  ApplicationInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State, StartResultFor<Props>>,
  'options' extends keyof Props ? Omit<Props, 'options'> : Props
>;
export type ApplicationConstructor<Props extends object = {}, Args extends unknown[] = [options?: ApplicationOptions],
  State = object, Statics extends object = {}> = {
  new <Provided extends Args = Args>(...args: Provided): Constructed<Props, ApplicationResult<Props, Provided, SuppliedState<Provided[0], State>>>;
  (this: object, ...args: Args): void;
} & Merge<{
  prototype: ApplicationResult<Props, Args, State>;
  call(receiver: object, ...args: Args): void;
  apply(receiver: object, args: Args | IArguments): void;
  setStateApi: typeof setStateApi;
  extend<Added extends object = {}, AddedStatics extends object = {}>(
    this: Added extends { constructor: (...args: never[]) => unknown } ? object : (this: object, ...args: never[]) => unknown,
    prototypeProperties?: Added & ThisType<ApplicationResult<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
      StateFor<Merge<Props, Added>>>>,
    staticProperties?: AddedStatics & ThisType<ApplicationConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
      StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>>>
  ): ApplicationConstructor<Merge<Props, Added>, ArgumentsFor<Merge<Props, Added>, Args>,
    StateFor<Merge<Props, Added>>, Merge<Statics, AddedStatics>>;
}, Statics>;

interface PendingStart {
  controller: AbortController;
  promise: Promise<boolean>;
  resolve(value: boolean): void;
}

type ApplicationInternals = ApplicationInstance<object, unknown> & RadioHost & StateHost & {
  [runtimeId]: object;
  _pendingStart?: PendingStart;
  _isStopping?: boolean;
  _isDestroying?: boolean;
  _parentApp?: ApplicationInternals;
  _name?: string;
  _childApps?: Map<string, ApplicationInternals>;
  _region?: RegionInstance;
  _ownsRegion?: boolean;
  _preparedView?: SupportedView;
  _displayedView?: SupportedView;
  _viewEventViews?: WeakSet<SupportedView>;
  _isDestroyed: boolean;
  _initRegion(): void;
  _initRadio(): void;
  _destroyRadio(): unknown;
  _initState(options?: unknown): void;
  _isRunning: boolean;
  _initStateEvents(shouldDeliver: (application: ApplicationInternals) => boolean): unknown;
};

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests',
  'region',
  'regionClass',
  'stateEvents',
  'viewEvents'
];

const classErrorName = 'ApplicationError';

const Application = function(this: ApplicationInternals, options?: ApplicationOptions) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  (this.preinitialize as Function).apply(this, arguments);
  this._initRegion();
  this._initRadio();
  this._initState(options);
  const declaration = this.getOption('childApps') as ApplicationOptions['childApps'];
  const childApps = typeof declaration === 'function' ? declaration.call(this) : declaration;
  if (childApps) {
    for (const [name, ChildApp] of Object.entries(childApps)) {
      this.addChildApp(name, new ChildApp());
    }
  }
  (this.initialize as { apply(receiver: ApplicationInternals, args: IArguments): unknown }).apply(this, arguments);
  this._initStateEvents(isApplicationRunning);
};

function isApplicationRunning(application: ApplicationInternals) {
  return application._isRunning;
}

function throwApplicationOwnershipConflict(message: string) {
  throw new MarionetteError({
    code: 'MN0031',
    name: classErrorName,
    message
  });
}

function isTerminal(application: ApplicationInternals) {
  return application._isDestroying || application._isDestroyed;
}

function hasStoppingOwner(application: ApplicationInternals) {
  let owner = application._parentApp;

  while (owner) {
    if (isTerminal(owner) || owner._isStopping) { return true; }
    owner = owner._parentApp;
  }

  return false;
}

function isSameChildApp(owner: ApplicationInternals, name: string, application: ApplicationInternals) {
  return application._parentApp === owner && application._name === name &&
    owner._childApps?.get(name) === application;
}

function assertChildAppCanRegister(owner: ApplicationInternals, name: string, application: ApplicationInternals) {
  if (name.length === 0) {
    throwApplicationOwnershipConflict('A child Application name must be a non-empty string.');
  }

  if (application[runtimeId] !== owner[runtimeId]) {
    throwApplicationOwnershipConflict('A child Application must belong to the same Marionette runtime as its owner.');
  }

  if (isSameChildApp(owner, name, application)) { return; }

  if (application === owner) {
    throwApplicationOwnershipConflict('An Application cannot own itself.');
  }

  if (application._parentApp !== undefined) {
    throwApplicationOwnershipConflict('An Application instance cannot be registered with more than one owner or name.');
  }

  if (owner._childApps?.has(name)) {
    throwApplicationOwnershipConflict(`Child Application name "${name}" is already registered.`);
  }

  let parent: ApplicationInternals | undefined = owner;
  while (parent) {
    if (parent === application) {
      throwApplicationOwnershipConflict('A child Application cannot be an ancestor of its owner.');
    }
    parent = parent._parentApp;
  }
}

function removeChildAppReference(owner: ApplicationInternals, name: string, application: ApplicationInternals) {
  owner._childApps!.delete(name);
  delete application._parentApp;
  delete application._name;

  if (owner._childApps!.size === 0) {
    delete owner._childApps;
  }
}

function destroyChildApps(application: ApplicationInternals, options: unknown) {
  // Destroy removes the current child from this Map without skipping the next.
  for (const child of application._childApps!.values()) {
    child.destroy(options);
  }
}

function releasePreparedView(application: ApplicationInternals) {
  const view = application._preparedView;
  if (!view) { return; }

  delete application._preparedView;
  view.off('destroy', onPreparedViewDestroyed, application);
  if (view._parent === application) { delete view._parent; }
  return view;
}

function onPreparedViewDestroyed(this: ApplicationInternals) {
  releasePreparedView(this);
}

function releaseDisplayedView(application: ApplicationInternals, view = application._displayedView,
  region = application.getRegion()) {
  if (!view || application._displayedView !== view) { return; }

  delete application._displayedView;
  region?.off('empty', onDisplayedRegionEmpty, application);
  return view;
}

function onDisplayedRegionEmpty(this: ApplicationInternals, region: RegionInstance, view: SupportedView) {
  releaseDisplayedView(this, view, region);
}

function emptyView(application: ApplicationInternals, options?: unknown) {
  releasePreparedView(application)?.destroy();
  const region = application.getRegion();
  const displayed = releaseDisplayedView(application);
  if (region?.currentView && (application._ownsRegion || region.currentView === displayed)) {
    region.empty(options as ShowOptions | undefined);
  }
}

function cancelStart(application: ApplicationInternals) {
  const pending = application._pendingStart;
  delete application._pendingStart;
  pending?.resolve(false);
  pending?.controller.abort();
}

function replaceStartRegion(application: ApplicationInternals, region: RegionInstance) {
  if (region === application._region) { return; }
  if ((region as RegionInternals)[runtimeId] !== application[runtimeId]) {
    throw new MarionetteError({
      code: 'MN0030',
      name: 'RegionError',
      message: 'A Region instance must belong to the same Marionette runtime as its owner.'
    });
  }

  const current = application._region;
  const owned = application._ownsRegion;
  const displayed = releaseDisplayedView(application);
  if (displayed && current?.currentView === displayed) { current.empty(); }
  if (owned) { current?.destroy(); }
  if (isTerminal(application)) { return; }
  application._region = region;
  application._ownsRegion = false;
}

async function prepareApplication(application: ApplicationInternals, pending: PendingStart,
  options: unknown, region?: RegionInstance) {
  if (application._pendingStart !== pending) { return false; }
  if (region) { replaceStartRegion(application, region); }
  if (application._pendingStart !== pending) { return false; }
  application.triggerMethod('before:start', application, options);
  if (application._pendingStart !== pending) { return false; }

  const result = await application.prepareStart?.(options, { signal: pending.controller.signal });
  if (application._pendingStart !== pending) { return false; }

  delete application._pendingStart;
  application._isRunning = true;
  application.triggerMethod('start', application, options, result);
  return true;
}

function beginStart(application: ApplicationInternals, options: unknown, region?: RegionInstance) {
  const previous = application._pendingStart;
  const { promise, resolve, reject } = Promise.withResolvers<boolean>();
  const pending = { controller: new AbortController(), promise, resolve };
  application._pendingStart = pending;
  previous?.resolve(false);
  previous?.controller.abort();

  prepareApplication(application, pending, options, region).then(resolve, error => {
    if (application._pendingStart === pending) { delete application._pendingStart; }
    reject(error);
  });
  return promise;
}

function stopApplication(application: ApplicationInternals, options: unknown,
  notify = application._isRunning || !!application._pendingStart) {
  if (application._isStopping) { return; }
  application._isStopping = true;
  cancelStart(application);
  if (application._isDestroyed) { return; }
  if (notify) { application.triggerMethod('before:stop', application, options); }
  application._childApps?.forEach(child => child.stop(options));
  if (application._isDestroyed) { return; }
  application._isRunning = false;
  emptyView(application, options);
  application._isStopping = false;
  if (notify && !application._isDestroyed) { application.triggerMethod('stop', application, options); }
}

// Application Methods
// --------------

// Keep prototype composition inside the exported initialization boundary so an
// unused Application can be removed without treating its local mutations as global.
export default /* @__PURE__ */ ((methods: object) => {
  Object.assign(Application, { extend, setStateApi });
  Object.assign(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, methods);
  Object.defineProperty(Application.prototype, runtimeId, { value: defaultRuntimeId });
  return Application as unknown as ApplicationConstructor;
})({
  preinitialize() {},

  cidPrefix: 'mna',

  _isRunning: false,

  isRunning(this: ApplicationInternals) {
    return isApplicationRunning(this);
  },

  // Start joins pending readiness; restart replaces it without stopping the active run.
  start(this: ApplicationInternals, options?: ApplicationStartOptions) {
    if (isTerminal(this) || this._isStopping || hasStoppingOwner(this)) { return Promise.resolve(false); }
    if (this._isRunning) { return Promise.resolve(true); }
    return this._pendingStart?.promise || beginStart(this, options, options?.region);
  },

  stop(this: ApplicationInternals, options?: unknown) {
    if (!isTerminal(this)) { stopApplication(this, options); }
    return true;
  },

  restart(this: ApplicationInternals, options?: ApplicationRestartOptions) {
    if (isTerminal(this) || this._isStopping || hasStoppingOwner(this)) { return Promise.resolve(false); }
    return beginStart(this, options);
  },

  destroy(this: ApplicationInternals, options?: unknown) {
    if (isTerminal(this)) { return true; }
    const notifyStop = this._isRunning || !!this._pendingStart;
    this._isDestroying = true;
    this._isRunning = false;
    stopApplication(this, options, notifyStop);
    if (this._isStopping) {
      this._childApps?.forEach(child => child.stop(options));
      emptyView(this, options);
    }
    this.triggerMethod('before:destroy', this, options);
    if (this._childApps) { destroyChildApps(this, options); }
    if (this._ownsRegion) { this._region?.destroy(options as ShowOptions | undefined); }
    delete this._region;
    delete this._ownsRegion;
    this._isDestroyed = true;
    if (this._parentApp) { removeChildAppReference(this._parentApp, this._name!, this); }
    this._destroyRadio();
    this._destroyState();
    this.triggerMethod('destroy', this, options);
    this.stopListening();
    this.off();
    return true;
  },

  addChildApp(this: ApplicationInternals, name: string, application: ApplicationInternals) {
    if (isTerminal(this)) { return application; }

    if (application[runtimeId] === this[runtimeId] && isTerminal(application)) {
      return application;
    }

    assertChildAppCanRegister(this, name, application);
    if (isSameChildApp(this, name, application)) { return application; }

    const children = this._childApps || (this._childApps = new Map());
    application._parentApp = this;
    application._name = name;
    children.set(name, application);
    return application;
  },

  removeChildApp(this: ApplicationInternals, name: string, options?: unknown) {
    const application = this.getChildApp(name);
    application?.destroy(options);
    return application;
  },

  hasChildApp(this: ApplicationInternals, name: string) {
    return !!this._childApps?.has(name);
  },

  getChildApp(this: ApplicationInternals, name: string) {
    return this._childApps?.get(name);
  },

  getChildApps(this: ApplicationInternals) {
    const applications: Record<string, ApplicationInstance<object, unknown>> = {};
    this._childApps?.forEach((application, name) => {
      setProperty(applications, name, application);
    });
    return applications;
  },

  getName(this: ApplicationInternals) {
    return this._name;
  },

  regionClass: Region,

  _initRegion(this: ApplicationInternals) {
    const region = this.region;

    if (!region) { return; }

    const defaults = {
      [runtimeId]: this[runtimeId],
      regionClass: this.regionClass
    };

    this._region = buildRegion(region, defaults);

    if (!(region instanceof Region)) {
      this._ownsRegion = true;
    }
  },

  getRegion(this: ApplicationInternals) {
    return this._region;
  },

  setView(this: ApplicationInternals, view: SupportedView) {
    if (isTerminal(this)) { return view; }

    if (view._isDestroyed) {
      throw new MarionetteError({
        code: 'MN0007',
        name: 'ApplicationError',
        message: `View (cid: "${view.cid}") has already been destroyed and cannot be used.`
      });
    }
    if (view._parent && view !== this._preparedView && view !== this._displayedView) {
      throw new MarionetteError({
        code: 'MN0003',
        name: 'ApplicationError',
        message: 'View is already managed by an Application, Region, or CollectionView'
      });
    }

    const declaration = this._viewEventViews?.has(view) ? undefined : getValue(this, 'viewEvents') as Bindings | undefined;
    const bindings = declaration && normalizeBindings(this, declaration);
    if (view !== this._preparedView) {
      releasePreparedView(this)?.destroy();
      if (isTerminal(this)) { return view; }
      if (view !== this._displayedView) {
        this._preparedView = view;
        view._parent = this;
        view.on('destroy', onPreparedViewDestroyed, this);
      }
    }
    if (bindings) {
      this.listenTo(view, bindings);
      (this._viewEventViews || (this._viewEventViews = new WeakSet())).add(view);
    }
    return view;
  },

  showView(this: ApplicationInternals, view?: SupportedView, ...args: [options?: ShowOptions]) {
    if (isTerminal(this)) { return view; }
    if (view) { this.setView(view); }
    if (isTerminal(this)) { return view; }

    const root = this.getView();
    if (!root) { return; }

    // The Region becomes the sole owner after adoption. An allowed missing
    // mount leaves the prepared View with the Application for later cleanup.
    const region = this.getRegion()!;
    if (root === region.currentView) { return root; }
    delete root._parent;
    region.show(root, ...args);
    if (region.currentView === root) {
      releasePreparedView(this);
      this._displayedView = root;
      region.on('empty', onDisplayedRegionEmpty, this);
    } else {
      root._parent = this;
    }
    return root;
  },

  getView(this: ApplicationInternals) {
    return this._preparedView || this._displayedView;
  }
});
