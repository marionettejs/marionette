// Application
// -----------

import { assignOwn } from '../utils/assign-in.js';
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

function getFailureState(application, operation) {
  if (operation?.stopReadiness) { return operation.failureState; }
  return application._lifecycleState === RUNNING ? RUNNING : STOPPED;
}

function supersedeOperation(application) {
  const operation = application._lifecycleOperation;
  if (!operation) { return; }

  delete application._lifecycleOperation;
  operation.resolve(!!operation.completing);
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

  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  const operation = {
    kind,
    promise,
    reject,
    resolve,
    failureState,
    stopReadiness: superseded?.stopReadiness
  };

  application._lifecycleOperation = operation;
  application._lifecycleState = state;
  runOperation(application, operation, () => callback(operation));

  return promise;
}

async function startApplication(application, operation, options) {
  if (operation.stopReadiness) {
    await operation.stopReadiness.promise;
    if (!isCurrentOperation(application, operation)) { return; }

    operation.failureState = STOPPED;
    delete operation.stopReadiness;
  }

  await application.triggerMethod('before:start', application, options);
  if (!isCurrentOperation(application, operation)) { return; }

  application._lifecycleState = RUNNING;
  operation.completing = true;
  application.triggerMethod('start', application, options);
}

async function stopApplication(application, operation, options) {
  if (!operation.stopReadiness) {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    operation.stopReadiness = { promise };

    try {
      Promise.resolve(application.triggerMethod('before:stop', application, options))
        .then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  await operation.stopReadiness.promise;
  if (!isCurrentOperation(application, operation)) { return; }

  operation.failureState = STOPPED;
  delete operation.stopReadiness;
  operation.stopped = true;
  if (operation.kind === 'stop') {
    application._lifecycleState = STOPPED;
    operation.completing = true;
  }
  application.triggerMethod('stop', application, options);
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
      operation.stopPromise ||= operation.stopReadiness.promise.then(() => true);
      return operation.stopPromise;
    }
    if (operation?.kind === 'stop') { return operation.promise; }
    if (operation?.stopped) {
      supersedeOperation(this);
      this._lifecycleState = STOPPED;
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
    const shouldStop = !operation?.stopped && this._lifecycleState !== STOPPED;
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
    const shouldStop = !operation?.stopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);

    return beginOperation(this, 'destroy', DESTROYING, failureState, async current => {
      if (shouldStop) {
        await stopApplication(this, current, options);
      }

      await this.triggerMethod('before:destroy', this, options);

      this._isDestroyed = true;
      this._lifecycleState = DESTROYED;
      current.failureState = DESTROYED;
      current.completing = true;
      this.triggerMethod('destroy', this, options);
      this.stopListening();
    });
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
