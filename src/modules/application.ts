// Application
// -----------

import { assignOwn, setProperty } from '../utils/assign-in.js';
import MarionetteError from './error.ts';
import extend from '../utils/extend.ts';
import uniqueId from '../utils/unique-id.ts';
import CommonMixin from '../mixins/common.ts';
import DestroyMixin from '../mixins/destroy.ts';
import RadioMixin from '../mixins/radio.ts';
import StateMixin from '../mixins/state.ts';
import disposeAll from '../utils/dispose-all.ts';
import Region from './region.ts';
import buildRegion from './common/build-region.ts';
import { setStateApi } from '../runtime/state-api.ts';
import { defaultRuntimeId, runtimeId } from '../runtime/runtime-id.js';

import type { RegionInstance, ShowOptions } from './region.ts';
import type { RegionClass, RegionDefinition } from './common/build-region.ts';
import type { SupportedView } from './common/view.ts';
import type { StateApi } from '../runtime/state-api.ts';
import type { RadioApi, Channel } from './radio.ts';
import type { Bindings } from './common/normalize-methods.ts';
import type { RadioHost } from '../mixins/radio.ts';
import type { StateHost } from '../mixins/state.ts';
import type { Constructed, Merge, ArgumentsFor, DefaultOptions, OptionsFor, StateFor, SuppliedState } from './object.ts';

export interface LifecycleContext {
  signal: AbortSignal;
}
export interface ApplicationOptions {
  channelName?: string | (() => string);
  radioEvents?: Bindings | (() => Bindings);
  radioRequests?: Bindings | (() => Bindings);
  region?: RegionDefinition;
  regionClass?: RegionClass;
  stateEvents?: Bindings | (() => Bindings);
  state?: unknown;
}

type Common = typeof CommonMixin;
export interface ApplicationInstance<Options extends object = object, State = object> extends Common {
  cid: string;
  cidPrefix: string;
  options: Options;
  channelName?: ApplicationOptions['channelName'];
  radioEvents?: ApplicationOptions['radioEvents'];
  radioRequests?: ApplicationOptions['radioRequests'];
  region?: RegionDefinition;
  regionClass: RegionClass;
  stateEvents?: ApplicationOptions['stateEvents'];
  state?: unknown;
  State: Partial<StateApi<never>>;
  Radio: RadioApi;
  initialize(options?: Options): void;
  createState(options?: Options): unknown;
  getState(): State;
  getChannel(): Channel | undefined;
  isDestroyed(): boolean;
  isRunning(): boolean;
  start(options?: unknown): Promise<boolean>;
  stop(options?: unknown): Promise<boolean>;
  restart(options?: unknown): Promise<boolean>;
  destroy(options?: unknown): Promise<boolean>;
  onBeforeStart?(application: this, options: unknown, context: LifecycleContext): unknown;
  onBeforeStop?(application: this, options: unknown, context: LifecycleContext): unknown;
  onBeforeDestroy?(application: this, options: unknown, context: LifecycleContext): unknown;
  onStart?(application: this, options: unknown): unknown;
  onStop?(application: this, options: unknown): unknown;
  onDestroy?(application: this, options: unknown): unknown;
  addChildApp<Child extends ApplicationInstance<object, unknown>>(name: string, application: Child): Child;
  removeChildApp(name: string, options?: unknown): Promise<ApplicationInstance<object, unknown> | undefined>;
  hasChildApp(name: string): boolean;
  getChildApp(name: string): ApplicationInstance<object, unknown> | undefined;
  getChildApps(): Record<string, ApplicationInstance<object, unknown>>;
  getName(): string | undefined;
  getRegion(): RegionInstance | undefined;
  showView<Child extends SupportedView>(view: Child, ...args: [options?: ShowOptions]): Child;
  getView(): SupportedView | undefined;
}

type ApplicationResult<Props, Args extends unknown[], State> = Merge<
  ApplicationInstance<Merge<DefaultOptions<Props>, OptionsFor<Args>>, State>,
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

type LifecycleState = 'destroyed' | 'destroying' | 'restarting' | 'running' | 'starting' | 'stopped' | 'stopping';
type OperationKind = 'start' | 'stop' | 'restart' | 'destroy';
type FailureState = 'running' | 'stopped' | 'destroyed';
interface Deferred<Value> {
  promise: Promise<Value>;
  resolve: (value: Value | PromiseLike<Value>) => void;
  reject: (reason: unknown) => void;
}
interface Readiness<Value = unknown> {
  promise: Promise<Value>;
  context: LifecycleContext;
  controller: AbortController;
  options: unknown;
  isCanceled?: boolean;
}
interface Operation extends Deferred<boolean> {
  kind: OperationKind;
  failureState: FailureState;
  readiness?: Readiness;
  stopReadiness?: Readiness<boolean>;
  stopDeferred?: Deferred<boolean>;
  isCompleting?: boolean;
  isStopped?: boolean;
}

type ApplicationInternals = ApplicationInstance<object, unknown> & RadioHost & StateHost & {
  [runtimeId]: object;
  _lifecycleState: LifecycleState;
  _lifecycleOperation?: Operation;
  _parentApp?: ApplicationInternals;
  _name?: string;
  _childApps?: Map<string, ApplicationInternals>;
  _region?: RegionInstance;
  _ownedRegion?: RegionInstance;
  _view?: SupportedView;
  _isDestroyed: boolean;
  _initRegion(): void;
  _initRadio(): void;
  _destroyRadio(): unknown;
  _initState(options?: unknown): void;
  _initStateEvents(): unknown;
  _onRootRegionEmpty(): void;
};

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests',
  'region',
  'regionClass',
  'stateEvents'
];

const DESTROYED = 'destroyed';
const DESTROYING = 'destroying';
const RESTARTING = 'restarting';
const RUNNING = 'running';
const STARTING = 'starting';
const STOPPED = 'stopped';
const STOPPING = 'stopping';
const classErrorName = 'ApplicationError';

const Application = function(this: ApplicationInternals, options?: ApplicationOptions) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  try {
    this._initRegion();
    this._initRadio();
    this._initState(options);
    (this.initialize as { apply(receiver: ApplicationInternals, args: IArguments): unknown }).apply(this, arguments);
    this._initStateEvents();
  } catch (error) {
    const ownedRegion = this._ownedRegion;
    disposeAll([
      () => this.stopListening(),
      () => {
        delete this._region;
        delete this._ownedRegion;
      },
      () => ownedRegion?.destroy(),
      () => clearRootView(this),
      () => this._destroyRadio(),
      () => this._destroyState(),
      () => emptyRootView(this),
      () => this._childApps?.forEach((child, name) => removeChildAppReference(this, name, child))
    ], error);
  }
};

function isCurrentOperation(application: ApplicationInternals, operation: Operation) {
  return application._lifecycleOperation === operation;
}

function throwApplicationOwnershipConflict(message: string) {
  throw new MarionetteError({
    code: 'MN0031',
    name: classErrorName,
    message
  });
}

function isTerminal(application: ApplicationInternals) {
  return application._lifecycleState === DESTROYING ||
    application._lifecycleState === DESTROYED;
}

function hasTerminalOwner(application: ApplicationInternals) {
  let owner = application._parentApp;

  while (owner) {
    if (isTerminal(owner)) { return true; }
    owner = owner._parentApp;
  }

  return false;
}

function isSameChildApp(owner: ApplicationInternals, name: string, application: ApplicationInternals) {
  return application._parentApp === owner && application._name === name &&
    owner._childApps?.get(name) === application;
}

function assertChildAppCanRegister(owner: ApplicationInternals, name: string, application: ApplicationInternals) {
  if (typeof name !== 'string' || name.length === 0) {
    throwApplicationOwnershipConflict('A child Application name must be a non-empty string.');
  }

  if (!(application instanceof Application)) {
    throwApplicationOwnershipConflict('A child Application must be an Application instance.');
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

async function destroyChildApps(application: ApplicationInternals, options: unknown) {
  // Destroy removes the current child from this Map without skipping the next.
  for (const child of application._childApps!.values()) {
    await child.destroy(options);
  }
}

function hasStableLifecycleState(application: ApplicationInternals, state: LifecycleState) {
  return application._lifecycleState === state && !application._lifecycleOperation;
}

async function startChildApps(application: ApplicationInternals, operation: Operation, options: unknown) {
  if (!application._childApps) { return true; }

  for (const child of application._childApps!.values()) {
    if (!isCurrentOperation(application, operation)) { return false; }
    const started = await child.start(options);
    if (!isCurrentOperation(application, operation) ||
        !started || !hasStableLifecycleState(child, RUNNING)) {
      return false;
    }
  }

  return true;
}

function canStopChildren(application: ApplicationInternals, operation: Operation) {
  if (isCurrentOperation(application, operation)) { return true; }

  // A replacement stop, restart, or destroy continues the adopted stop phase.
  const current = application._lifecycleOperation;
  return current?.stopReadiness !== undefined && current.stopReadiness === operation.stopReadiness &&
    current.kind !== 'start';
}

function cancelStopReadiness(operation: Operation) {
  operation.stopReadiness!.isCanceled = true;
  return false;
}

async function stopChildApps(application: ApplicationInternals, operation: Operation, options: unknown) {
  if (!application._childApps) { return true; }

  for (const child of application._childApps!.values()) {
    if (!canStopChildren(application, operation)) { return cancelStopReadiness(operation); }
    const stopped = await child.stop(options);
    if (!canStopChildren(application, operation)) { return cancelStopReadiness(operation); }
    if (stopped && hasStableLifecycleState(child, STOPPED)) { continue; }
    if (!isTerminal(application)) { return cancelStopReadiness(operation); }
    await child.destroy(options);
  }

  return true;
}

function hasActiveChildApps(application: ApplicationInternals) {
  for (const child of application._childApps!.values()) {
    if (child._lifecycleState !== STOPPED && child._lifecycleState !== DESTROYED) {
      return true;
    }
  }

  return false;
}

function clearRootView(application: ApplicationInternals) {
  const region = application._region;

  region?.off('empty', application._onRootRegionEmpty, application);
  delete application._view;
}

function getRootView(application: ApplicationInternals) {
  const view = application._view;

  if (view && application._region?.currentView !== view) {
    clearRootView(application);
    return;
  }

  return view;
}

function emptyRootView(application: ApplicationInternals, options?: unknown) {
  if (!getRootView(application)) { return; }

  try {
    application._region!.empty(options as ShowOptions | undefined);
  } finally {
    getRootView(application);
  }
}

function createDeferred<Value = unknown>() {
  let resolve!: Deferred<Value>['resolve'];
  let reject!: Deferred<Value>['reject'];
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function beginReadiness<Value>(operation: Operation, options: unknown, callback: (context: LifecycleContext) => Value | PromiseLike<Value>) {
  const deferred = createDeferred<Value>();
  const controller = new AbortController();
  const readiness = {
    ...deferred,
    context: { signal: controller.signal },
    controller,
    options
  };

  operation.readiness = readiness;

  try {
    Promise.resolve(callback(readiness.context)).then(readiness.resolve, readiness.reject);
  } catch (error) {
    readiness.reject(error);
  }

  return readiness;
}

function completeReadiness(operation: Operation) {
  delete operation.readiness;
}

function getFailureState(application: ApplicationInternals, operation?: Operation) {
  if (operation?.stopReadiness) { return operation.failureState; }
  return application._lifecycleState === RUNNING ? RUNNING : STOPPED;
}

function supersedeOperation(application: ApplicationInternals) {
  const operation = application._lifecycleOperation;
  if (!operation) { return; }

  delete application._lifecycleOperation;
  operation.resolve(!!operation.isCompleting);
  return operation;
}

function completeOperation(application: ApplicationInternals, operation: Operation) {
  if (!isCurrentOperation(application, operation)) { return; }

  delete application._lifecycleOperation;
  operation.resolve(true);
}

function cancelOperation(application: ApplicationInternals, operation: Operation) {
  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.resolve(false);
}

function failOperation(application: ApplicationInternals, operation: Operation, error: unknown) {
  if (!isCurrentOperation(application, operation)) { return; }

  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.reject(error);
}

// A lifecycle callback may settle after a newer operation has superseded it.
// Only the current operation may commit or restore Application state.
function runOperation(application: ApplicationInternals, operation: Operation, callback: () => unknown) {
  (async() => {
    try {
      await callback();
      completeOperation(application, operation);
    } catch (error) {
      failOperation(application, operation, error);
    }
  })();
}

function beginOperation(application: ApplicationInternals, kind: OperationKind, state: LifecycleState, failureState: FailureState, callback: (operation: Operation) => unknown) {
  const superseded = supersedeOperation(application);
  const deferred = createDeferred<boolean>();
  // A canceled child traversal cannot be continued by a later operation.
  const stopReadiness = superseded?.stopReadiness?.isCanceled ? undefined : superseded?.stopReadiness;

  const operation: Operation = {
    ...deferred,
    kind,
    failureState,
    readiness: stopReadiness,
    stopReadiness
  };

  application._lifecycleOperation = operation;
  application._lifecycleState = state;

  if (superseded?.readiness && superseded.readiness !== stopReadiness) {
    superseded.readiness.controller.abort();
  }

  if (!isCurrentOperation(application, operation)) { return deferred.promise; }
  runOperation(application, operation, () => callback(operation));

  return deferred.promise;
}

async function startApplication(application: ApplicationInternals, operation: Operation, options: unknown) {
  if (operation.stopReadiness) {
    const readiness = operation.stopReadiness;
    const childrenStopped = await readiness.promise;
    if (!isCurrentOperation(application, operation)) { return; }

    completeReadiness(operation);
    if (childrenStopped) { operation.failureState = STOPPED; }
    delete operation.stopReadiness;
  }

  const readiness = beginReadiness(operation, options, async context => {
    await application.triggerMethod('before:start', application, options, context);
    return startChildApps(application, operation, options);
  });

  const childrenStarted = await readiness.promise;
  if (!isCurrentOperation(application, operation)) { return; }

  completeReadiness(operation);
  if (!childrenStarted) {
    cancelOperation(application, operation);
    return;
  }
  application._lifecycleState = RUNNING;
  operation.failureState = RUNNING;
  operation.isCompleting = true;
  application.triggerMethod('start', application, options);
}

async function stopApplication(application: ApplicationInternals, operation: Operation, options: unknown) {
  try {
    if (!operation.stopReadiness) {
      const readiness = beginReadiness(operation, options, async context => {
        await application.triggerMethod('before:stop', application, options, context);
        return stopChildApps(application, operation, options);
      });
      operation.stopReadiness = readiness;
    }

    const readiness = operation.stopReadiness;
    const childrenStopped = await readiness.promise;
    if (!isCurrentOperation(application, operation)) { return; }

    completeReadiness(operation);
    delete operation.stopReadiness;
    if (!childrenStopped) {
      cancelOperation(application, operation);
      return;
    }
    emptyRootView(application, readiness.options);
    if (!isCurrentOperation(application, operation)) { return; }
    operation.failureState = STOPPED;
    operation.isStopped = true;
    if (operation.kind === 'stop') {
      application._lifecycleState = STOPPED;
      operation.isCompleting = true;
    }
    application.triggerMethod('stop', application, readiness.options);
    operation.stopDeferred?.resolve(true);
  } catch (error) {
    operation.stopDeferred?.reject(error);
    throw error;
  }
}

// Application Methods
// --------------

// Keep prototype composition inside the exported initialization boundary so an
// unused Application can be removed without treating its local mutations as global.
export default /* @__PURE__ */ ((methods: object) => {
  assignOwn(Application, { extend, setStateApi });
  assignOwn(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, methods);
  Object.defineProperty(Application.prototype, runtimeId, { value: defaultRuntimeId });
  return Application as unknown as ApplicationConstructor;
})({
  cidPrefix: 'mna',

  _lifecycleState: STOPPED,

  isRunning(this: ApplicationInternals) {
    return this._lifecycleState === RUNNING;
  },

  // Kick off all of the application's processes.
  start(this: ApplicationInternals, options?: unknown) {
    if (isTerminal(this) || hasTerminalOwner(this)) {
      return Promise.resolve(false);
    }

    const operation = this._lifecycleOperation;
    if (operation?.kind === 'start') { return operation.promise; }
    if (this._lifecycleState === RUNNING && !operation) { return Promise.resolve(true); }

    const failureState = getFailureState(this, operation);
    return beginOperation(this, 'start', STARTING, failureState, nextOperation => {
      return startApplication(this, nextOperation, options);
    });
  },

  stop(this: ApplicationInternals, options?: unknown) {
    if (this._lifecycleState === DESTROYED) {
      return Promise.resolve(true);
    }

    const operation = this._lifecycleOperation;
    if (this._lifecycleState === DESTROYING) {
      if (!operation?.stopReadiness) { return Promise.resolve(true); }
      // Destroy cannot be superseded and starts its stop phase synchronously.
      if (!operation.stopDeferred) {
        operation.stopDeferred = createDeferred<boolean>();
      }
      return operation.stopDeferred.promise;
    }
    if (operation?.kind === 'stop') { return operation.promise; }
    if (operation?.isStopped) {
      const superseded = supersedeOperation(this);
      this._lifecycleState = STOPPED;
      superseded!.readiness?.controller.abort();
      return Promise.resolve(true);
    }
    if (this._lifecycleState === STOPPED && !operation) {
      try {
        emptyRootView(this, options);
        return Promise.resolve(true);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'stop', STOPPING, failureState, nextOperation => {
      return stopApplication(this, nextOperation, options);
    });
  },

  restart(this: ApplicationInternals, options?: unknown) {
    if (isTerminal(this) || hasTerminalOwner(this)) {
      return Promise.resolve(false);
    }

    const operation = this._lifecycleOperation;
    if (operation?.kind === 'restart') { return operation.promise; }
    const shouldStop = !operation?.isStopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'restart', RESTARTING, failureState, async nextOperation => {
      if (shouldStop) {
        await stopApplication(this, nextOperation, options);
      } else { emptyRootView(this, options); }
      if (!isCurrentOperation(this, nextOperation)) { return; }
      await startApplication(this, nextOperation, options);
    });
  },

  destroy(this: ApplicationInternals, options?: unknown) {
    if (this._lifecycleState === DESTROYED) { return Promise.resolve(true); }

    const operation = this._lifecycleOperation;
    if (operation?.kind === 'destroy') { return operation.promise; }
    const shouldStop = !operation?.isStopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'destroy', DESTROYING, failureState, async nextOperation => {
      if (shouldStop) {
        await stopApplication(this, nextOperation, options);
      } else if (this._childApps && hasActiveChildApps(this)) {
        await stopChildApps(this, nextOperation, options);
      }

      emptyRootView(this, options);

      const readiness = beginReadiness(nextOperation, options, context => {
        return this.triggerMethod('before:destroy', this, options, context);
      });

      await readiness.promise;
      completeReadiness(nextOperation);
      if (this._childApps) {
        await destroyChildApps(this, options);
      }
      const ownedRegion = this._ownedRegion;
      disposeAll([
        () => {
          if (ownedRegion && !ownedRegion.isDestroyed()) { return; }
          delete this._region;
          delete this._ownedRegion;
          this._isDestroyed = true;
          this._lifecycleState = DESTROYED;
          nextOperation.failureState = DESTROYED;
          nextOperation.isCompleting = true;
          if (this._parentApp) {
            removeChildAppReference(this._parentApp, this._name!, this);
          }
          disposeAll([
            () => this.stopListening(),
            () => this.triggerMethod('destroy', this, options),
            () => this._destroyState(),
            () => this._destroyRadio()
          ]);
        },
        () => ownedRegion?.destroy(options as ShowOptions | undefined)
      ]);
    });
  },

  addChildApp(this: ApplicationInternals, name: string, application: ApplicationInternals) {
    if (isTerminal(this)) { return application; }

    if (application instanceof Application && application[runtimeId] === this[runtimeId] && isTerminal(application)) {
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
    if (!application) { return Promise.resolve(); }

    return application.destroy(options).then(() => application);
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
      this._ownedRegion = this._region;
    }
  },

  getRegion(this: ApplicationInternals) {
    return this._region;
  },

  _onRootRegionEmpty(this: ApplicationInternals) {
    clearRootView(this);
  },

  showView(this: ApplicationInternals, view: SupportedView, ...args: [options?: ShowOptions]) {
    if (isTerminal(this)) { return view; }

    const region = this.getRegion()!;
    region.show(view, ...args);
    if (region.currentView === view) {
      if (this._view !== view) {
        clearRootView(this);
        region.on('empty', this._onRootRegionEmpty, this);
      }
      this._view = view;
    }
    return view;
  },

  getView(this: ApplicationInternals) {
    return getRootView(this);
  }
});
