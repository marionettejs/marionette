// Application
// -----------

import { assignOwn, setProperty } from '../utils/assign-in.js';
import MarionetteError from './error.ts';
import extend from '../utils/extend.ts';
import uniqueId from '../utils/unique-id.ts';
import CommonMixin from '../mixins/common.js';
import DestroyMixin from '../mixins/destroy.js';
import RadioMixin from '../mixins/radio.js';
import StateMixin from '../mixins/state.js';
import disposeAll from '../utils/dispose-all.ts';
import Region from './region.js';
import buildRegion from './common/build-region.js';
import { setStateApi } from '../runtime/state-api.js';
import { defaultRuntimeId, runtimeId } from '../runtime/runtime-id.js';

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

const Application = function(options) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);

  try {
    this._initRegion();
    this._initRadio();
    this._initState(options);
    this.initialize.apply(this, arguments);
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

function isCurrentOperation(application, operation) {
  return application._lifecycleOperation === operation;
}

function throwApplicationOwnershipConflict(message) {
  throw new MarionetteError({
    code: 'MN0031',
    name: classErrorName,
    message
  });
}

function isTerminal(application) {
  return application._lifecycleState === DESTROYING ||
    application._lifecycleState === DESTROYED;
}

function hasTerminalOwner(application) {
  let owner = application._parentApp;

  while (owner) {
    if (isTerminal(owner)) { return true; }
    owner = owner._parentApp;
  }

  return false;
}

function isSameChildApp(owner, name, application) {
  return application._parentApp === owner && application._name === name &&
    owner._childApps?.get(name) === application;
}

function assertChildAppCanRegister(owner, name, application) {
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

  let parent = owner;
  while (parent) {
    if (parent === application) {
      throwApplicationOwnershipConflict('A child Application cannot be an ancestor of its owner.');
    }
    parent = parent._parentApp;
  }
}

function removeChildAppReference(owner, name, application) {
  owner._childApps.delete(name);
  delete application._parentApp;
  delete application._name;

  if (owner._childApps.size === 0) {
    delete owner._childApps;
  }
}

async function destroyChildApps(application, options) {
  // Destroy removes the current child from this Map without skipping the next.
  for (const child of application._childApps.values()) {
    await child.destroy(options);
  }
}

function hasStableLifecycleState(application, state) {
  return application._lifecycleState === state && !application._lifecycleOperation;
}

async function startChildApps(application, operation, options) {
  if (!application._childApps) { return true; }

  for (const child of application._childApps.values()) {
    if (!isCurrentOperation(application, operation)) { return false; }
    const started = await child.start(options);
    if (!isCurrentOperation(application, operation) ||
        !started || !hasStableLifecycleState(child, RUNNING)) {
      return false;
    }
  }

  return true;
}

function canStopChildren(application, operation) {
  if (isCurrentOperation(application, operation)) { return true; }

  // A replacement stop, restart, or destroy continues the adopted stop phase.
  const current = application._lifecycleOperation;
  return current?.stopReadiness !== undefined && current.stopReadiness === operation.stopReadiness &&
    current.kind !== 'start';
}

function cancelStopReadiness(operation) {
  operation.stopReadiness.isCanceled = true;
  return false;
}

async function stopChildApps(application, operation, options) {
  if (!application._childApps) { return true; }

  for (const child of application._childApps.values()) {
    if (!canStopChildren(application, operation)) { return cancelStopReadiness(operation); }
    const stopped = await child.stop(options);
    if (!canStopChildren(application, operation)) { return cancelStopReadiness(operation); }
    if (stopped && hasStableLifecycleState(child, STOPPED)) { continue; }
    if (!isTerminal(application)) { return cancelStopReadiness(operation); }
    await child.destroy(options);
  }

  return true;
}

function hasActiveChildApps(application) {
  for (const child of application._childApps.values()) {
    if (child._lifecycleState !== STOPPED && child._lifecycleState !== DESTROYED) {
      return true;
    }
  }

  return false;
}

function clearRootView(application) {
  const region = application._region;

  region?.off('empty', application._onRootRegionEmpty, application);
  delete application._view;
}

function getRootView(application) {
  const view = application._view;

  if (view && application._region?.currentView !== view) {
    clearRootView(application);
    return;
  }

  return view;
}

function emptyRootView(application, options) {
  if (!getRootView(application)) { return; }

  try {
    application._region.empty(options);
  } finally {
    getRootView(application);
  }
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function beginReadiness(operation, options, callback) {
  const deferred = createDeferred();
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

function completeReadiness(operation) {
  delete operation.readiness;
}

function getFailureState(application, operation) {
  if (operation?.stopReadiness) { return operation.failureState; }
  return application._lifecycleState === RUNNING ? RUNNING : STOPPED;
}

function supersedeOperation(application) {
  const operation = application._lifecycleOperation;
  if (!operation) { return; }

  delete application._lifecycleOperation;
  operation.resolve(!!operation.isCompleting);
  return operation;
}

function completeOperation(application, operation) {
  if (!isCurrentOperation(application, operation)) { return; }

  delete application._lifecycleOperation;
  operation.resolve(true);
}

function cancelOperation(application, operation) {
  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.resolve(false);
}

function failOperation(application, operation, error) {
  if (!isCurrentOperation(application, operation)) { return; }

  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.reject(error);
}

// A lifecycle callback may settle after a newer operation has superseded it.
// Only the current operation may commit or restore Application state.
function runOperation(application, operation, callback) {
  (async() => {
    try {
      await callback();
      completeOperation(application, operation);
    } catch (error) {
      failOperation(application, operation, error);
    }
  })();
}

function beginOperation(application, kind, state, failureState, callback) {
  const superseded = supersedeOperation(application);
  const deferred = createDeferred();
  // A canceled child traversal cannot be continued by a later operation.
  const stopReadiness = superseded?.stopReadiness?.isCanceled ? undefined : superseded?.stopReadiness;

  const operation = {
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

async function startApplication(application, operation, options) {
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

async function stopApplication(application, operation, options) {
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
export default /* @__PURE__ */ (methods => {
  assignOwn(Application, { extend, setStateApi });
  assignOwn(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, methods);
  Object.defineProperty(Application.prototype, runtimeId, { value: defaultRuntimeId });
  return Application;
})({
  cidPrefix: 'mna',

  _lifecycleState: STOPPED,

  isRunning() {
    return this._lifecycleState === RUNNING;
  },

  // Kick off all of the application's processes.
  start(options) {
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

  stop(options) {
    if (this._lifecycleState === DESTROYED) {
      return Promise.resolve(true);
    }

    const operation = this._lifecycleOperation;
    if (this._lifecycleState === DESTROYING) {
      if (!operation?.stopReadiness) { return Promise.resolve(true); }
      // Destroy cannot be superseded and starts its stop phase synchronously.
      if (!operation.stopDeferred) {
        operation.stopDeferred = createDeferred();
      }
      return operation.stopDeferred.promise;
    }
    if (operation?.kind === 'stop') { return operation.promise; }
    if (operation?.isStopped) {
      const superseded = supersedeOperation(this);
      this._lifecycleState = STOPPED;
      superseded.readiness?.controller.abort();
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

  restart(options) {
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

  destroy(options) {
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
            removeChildAppReference(this._parentApp, this._name, this);
          }
          disposeAll([
            () => this.stopListening(),
            () => this.triggerMethod('destroy', this, options),
            () => this._destroyState(),
            () => this._destroyRadio()
          ]);
        },
        () => ownedRegion?.destroy(options)
      ]);
    });
  },

  addChildApp(name, application) {
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

  removeChildApp(name, options) {
    const application = this.getChildApp(name);
    if (!application) { return Promise.resolve(); }

    return application.destroy(options).then(() => application);
  },

  hasChildApp(name) {
    return !!this._childApps?.has(name);
  },

  getChildApp(name) {
    return this._childApps?.get(name);
  },

  getChildApps() {
    const applications = {};
    this._childApps?.forEach((application, name) => {
      setProperty(applications, name, application);
    });
    return applications;
  },

  getName() {
    return this._name;
  },

  regionClass: Region,

  _initRegion() {
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

  getRegion() {
    return this._region;
  },

  _onRootRegionEmpty() {
    clearRootView(this);
  },

  showView(view, ...args) {
    if (isTerminal(this)) { return view; }

    const region = this.getRegion();
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

  getView() {
    return getRootView(this);
  }
});
