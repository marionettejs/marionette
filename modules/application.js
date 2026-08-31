// Application
// -----------

import { assignOwn, setProperty } from '../utils/assign-in.js';
import MarionetteError from '../utils/error.js';
import extend from '../utils/extend.js';
import uniqueId from '../utils/unique-id.js';
import buildRegion from './common/build-region.js';
import CommonMixin from '../mixins/common.js';
import DestroyMixin from '../mixins/destroy.js';
import RadioMixin from '../mixins/radio.js';
import Region from './region.js';

const ClassOptions = [
  'channelName',
  'radioEvents',
  'radioRequests',
  'region',
  'regionClass'
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
  this._initRegion();
  this._initRadio();
  this.initialize.apply(this, arguments);
};

Application.extend = extend;

function isCurrentOperation(application, operation) {
  return application._lifecycleOperation === operation;
}

function getOwnChildApp(applications, name) {
  return applications?.get(name);
}

function setChildApp(applications, name, application) {
  applications.set(name, application);
  return application;
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

function isSameChildApp(owner, name, application) {
  return application._parentApp === owner && application._name === name &&
    getOwnChildApp(owner._childApps, name) === application;
}

function assertChildAppCanRegister(owner, name, application) {
  if (typeof name !== 'string' || name.length === 0) {
    throwApplicationOwnershipConflict('A child Application name must be a non-empty string.');
  }

  if (!(application instanceof Application)) {
    throwApplicationOwnershipConflict('A child Application must be an Application instance.');
  }

  if (isSameChildApp(owner, name, application)) { return; }

  if (application === owner) {
    throwApplicationOwnershipConflict('An Application cannot own itself.');
  }

  if (application._parentApp !== undefined) {
    throwApplicationOwnershipConflict('An Application instance cannot be registered with more than one owner or name.');
  }

  if (getOwnChildApp(owner._childApps, name)) {
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

function failOperation(application, operation, error) {
  if (!isCurrentOperation(application, operation)) { return; }

  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.reject(error);
}

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
  const stopReadiness = superseded?.stopReadiness;

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
    await readiness.promise;
    if (!isCurrentOperation(application, operation)) { return; }

    completeReadiness(operation);
    operation.failureState = STOPPED;
    delete operation.stopReadiness;
  }

  const readiness = beginReadiness(operation, options, context => {
    return application.triggerMethod('before:start', application, options, context);
  });

  await readiness.promise;
  if (!isCurrentOperation(application, operation)) { return; }

  completeReadiness(operation);
  application._lifecycleState = RUNNING;
  operation.failureState = RUNNING;
  operation.isCompleting = true;
  application.triggerMethod('start', application, options);
}

async function stopApplication(application, operation, options) {
  try {
    if (!operation.stopReadiness) {
      const readiness = beginReadiness(operation, options, context => {
        return application.triggerMethod('before:stop', application, options, context);
      });
      operation.stopReadiness = readiness;
    }

    const readiness = operation.stopReadiness;
    await readiness.promise;
    if (!isCurrentOperation(application, operation)) { return; }

    completeReadiness(operation);
    operation.failureState = STOPPED;
    delete operation.stopReadiness;
    operation.isStopped = true;
    if (operation.kind === 'stop') {
      application._lifecycleState = STOPPED;
      operation.isCompleting = true;
    }
    application.triggerMethod('stop', application, readiness.options);
    operation.stopResult?.resolve(true);
  } catch (error) {
    operation.stopResult?.reject(error);
    throw error;
  }
}

// Application Methods
// --------------

assignOwn(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, {
  cidPrefix: 'mna',

  _lifecycleState: STOPPED,

  isRunning() {
    return this._lifecycleState === RUNNING;
  },

  // Kick off all of the application's processes.
  start(options) {
    if (this._lifecycleState === DESTROYING || this._lifecycleState === DESTROYED) {
      return Promise.resolve(false);
    }

    const operation = this._lifecycleOperation;
    if (operation?.kind === 'start') { return operation.promise; }
    if (this._lifecycleState === RUNNING && !operation) { return Promise.resolve(true); }

    const failureState = getFailureState(this, operation);
    return beginOperation(this, 'start', STARTING, failureState, current => {
      return startApplication(this, current, options);
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
      if (!operation.stopResult) {
        operation.stopResult = createDeferred();
      }
      return operation.stopResult.promise;
    }
    if (operation?.kind === 'stop') { return operation.promise; }
    if (operation?.isStopped) {
      const superseded = supersedeOperation(this);
      this._lifecycleState = STOPPED;
      superseded.readiness?.controller.abort();
      return Promise.resolve(true);
    }
    if (this._lifecycleState === STOPPED && !operation) { return Promise.resolve(true); }
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'stop', STOPPING, failureState, current => {
      return stopApplication(this, current, options);
    });
  },

  restart(options) {
    if (this._lifecycleState === DESTROYING || this._lifecycleState === DESTROYED) {
      return Promise.resolve(false);
    }

    const operation = this._lifecycleOperation;
    if (operation?.kind === 'restart') { return operation.promise; }
    const shouldStop = !operation?.isStopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'restart', RESTARTING, failureState, async current => {
      if (shouldStop) {
        await stopApplication(this, current, options);
        if (!isCurrentOperation(this, current)) { return; }
      }
      await startApplication(this, current, options);
    });
  },

  destroy(options) {
    if (this._lifecycleState === DESTROYED) { return Promise.resolve(true); }

    const operation = this._lifecycleOperation;
    if (operation?.kind === 'destroy') { return operation.promise; }
    const shouldStop = !operation?.isStopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'destroy', DESTROYING, failureState, async current => {
      if (shouldStop) {
        await stopApplication(this, current, options);
      }

      const readiness = beginReadiness(current, options, context => {
        return this.triggerMethod('before:destroy', this, options, context);
      });

      await readiness.promise;
      completeReadiness(current);
      if (this._childApps) {
        await destroyChildApps(this, options);
      }
      this._isDestroyed = true;
      this._lifecycleState = DESTROYED;
      current.failureState = DESTROYED;
      current.isCompleting = true;
      if (this._parentApp) {
        removeChildAppReference(this._parentApp, this._name, this);
      }
      this.triggerMethod('destroy', this, options);
      this.stopListening();
    });
  },

  addChildApp(name, application) {
    if (isTerminal(this)) { return application; }

    if (application instanceof Application && isTerminal(application)) {
      return application;
    }

    assertChildAppCanRegister(this, name, application);
    if (isSameChildApp(this, name, application)) { return application; }

    const children = this._childApps || (this._childApps = new Map());
    application._parentApp = this;
    application._name = name;
    return setChildApp(children, name, application);
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
    return getOwnChildApp(this._childApps, name);
  },

  getChildApps() {
    const applications = {};
    this._childApps?.forEach((application, name) => {
      setProperty(applications, name, application);
    });
    return applications;
  },

  getParentApp() {
    return this._parentApp;
  },

  getRootApp() {
    let application = this;
    while (application._parentApp) {
      application = application._parentApp;
    }
    return application;
  },

  getName() {
    return this._name;
  },

  regionClass: Region,

  _initRegion() {
    const region = this.region;

    if (!region) { return; }

    const defaults = {
      regionClass: this.regionClass
    };

    this._region = buildRegion(region, defaults);
  },

  getRegion() {
    return this._region;
  },

  showView(view, ...args) {
    const region = this.getRegion();
    region.show(view, ...args);
    return view;
  },

  getView() {
    return this.getRegion().currentView;
  }
});

export default Application;
