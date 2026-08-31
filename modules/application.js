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

const STOPPED = 'stopped';
const STARTING = 'starting';
const RUNNING = 'running';
const STOPPING = 'stopping';
const RESTARTING = 'restarting';
const DESTROYING = 'destroying';
const DESTROYED = 'destroyed';
const classErrorName = 'ApplicationError';

const Application = function(options) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);
  this._initRegion();
  this._initRadio();
  this.initialize.apply(this, arguments);
};

Application.extend = extend;

function throwApplicationOwnershipConflict(message) {
  throw new MarionetteError({
    code: 'MN0031',
    name: classErrorName,
    message
  });
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

    const transition = this._lifecycleTransition;
    if (transition?.type === 'start') { return transition.promise; }
    if (this._lifecycleState === RUNNING && !transition) { return Promise.resolve(true); }

    return this._beginTransition('start', STARTING, nextTransition => {
      return this._startLifecycle(nextTransition, options);
    });
  },

  stop(options) {
    if (this._lifecycleState === DESTROYED) {
      return Promise.resolve(true);
    }

    const transition = this._lifecycleTransition;
    if (this._lifecycleState === DESTROYING) {
      if (!transition?.stopReadiness) { return Promise.resolve(true); }
      // Destroy cannot be superseded and starts its stop phase synchronously.
      if (!transition.stopDeferred) {
        transition.stopDeferred = createDeferred();
      }
      return transition.stopDeferred.promise;
    }
    if (transition?.type === 'stop') { return transition.promise; }
    if (transition?.isStopped) {
      const superseded = this._supersedeTransition();
      this._lifecycleState = STOPPED;
      superseded.readiness?.controller.abort();
      return Promise.resolve(true);
    }
    if (this._lifecycleState === STOPPED && !transition) { return Promise.resolve(true); }

    return this._beginTransition('stop', STOPPING, nextTransition => {
      return this._stopLifecycle(nextTransition, options);
    });
  },

  restart(options) {
    if (this._lifecycleState === DESTROYING || this._lifecycleState === DESTROYED) {
      return Promise.resolve(false);
    }

    const transition = this._lifecycleTransition;
    if (transition?.type === 'restart') { return transition.promise; }
    const shouldStop = !transition?.isStopped && this._lifecycleState !== STOPPED;

    return this._beginTransition('restart', RESTARTING, async nextTransition => {
      if (shouldStop) {
        await this._stopLifecycle(nextTransition, options);
        if (this._lifecycleTransition !== nextTransition) { return; }
      }
      await this._startLifecycle(nextTransition, options);
    });
  },

  destroy(options) {
    if (this._lifecycleState === DESTROYED) { return Promise.resolve(true); }

    const transition = this._lifecycleTransition;
    if (transition?.type === 'destroy') { return transition.promise; }
    const shouldStop = !transition?.isStopped && this._lifecycleState !== STOPPED;

    return this._beginTransition('destroy', DESTROYING, async nextTransition => {
      if (shouldStop) {
        await this._stopLifecycle(nextTransition, options);
      }

      const readiness = this._beginReadiness(nextTransition, 'before:destroy', options);

      await readiness.promise;
      delete nextTransition.readiness;
      if (this._childApps) {
        await this._destroyChildApps(options);
      }
      this._isDestroyed = true;
      this._lifecycleState = DESTROYED;
      nextTransition.rollbackState = DESTROYED;
      nextTransition.isComplete = true;
      if (this._parentApp) {
        this._parentApp._removeChildAppReference(this._name, this);
      }
      this.triggerMethod('destroy', this, options);
      this.stopListening();
    });
  },

  _supersedeTransition() {
    const transition = this._lifecycleTransition;
    if (!transition) { return; }

    delete this._lifecycleTransition;
    transition.resolve(!!transition.isComplete);
    return transition;
  },

  _beginTransition(type, state, callback) {
    const currentTransition = this._lifecycleTransition;
    const rollbackState = currentTransition?.stopReadiness ?
      currentTransition.rollbackState :
      this._lifecycleState === RUNNING ? RUNNING : STOPPED;
    const superseded = this._supersedeTransition();
    const deferred = createDeferred();
    const stopReadiness = superseded?.stopReadiness;

    const transition = {
      ...deferred,
      type,
      rollbackState,
      readiness: stopReadiness,
      stopReadiness
    };

    this._lifecycleTransition = transition;
    this._lifecycleState = state;

    if (superseded?.readiness && superseded.readiness !== stopReadiness) {
      superseded.readiness.controller.abort();
    }

    if (this._lifecycleTransition !== transition) { return deferred.promise; }

    // A callback may settle after a newer transition supersedes it. Only the
    // current transition may commit or restore Application state.
    (async() => {
      try {
        await callback(transition);
        if (this._lifecycleTransition !== transition) { return; }

        delete this._lifecycleTransition;
        transition.resolve(true);
      } catch (error) {
        if (this._lifecycleTransition !== transition) { return; }

        delete this._lifecycleTransition;
        this._lifecycleState = transition.rollbackState;
        transition.reject(error);
      }
    })();

    return deferred.promise;
  },

  _beginReadiness(transition, eventName, options) {
    const deferred = createDeferred();
    const controller = new AbortController();
    const readiness = {
      ...deferred,
      context: { signal: controller.signal },
      controller,
      options
    };

    transition.readiness = readiness;

    try {
      Promise.resolve(
        this.triggerMethod(eventName, this, options, readiness.context)
      ).then(readiness.resolve, readiness.reject);
    } catch (error) {
      readiness.reject(error);
    }

    return readiness;
  },

  async _startLifecycle(transition, options) {
    if (transition.stopReadiness) {
      const readiness = transition.stopReadiness;
      await readiness.promise;
      if (this._lifecycleTransition !== transition) { return; }

      delete transition.readiness;
      transition.rollbackState = STOPPED;
      delete transition.stopReadiness;
    }

    const readiness = this._beginReadiness(transition, 'before:start', options);

    await readiness.promise;
    if (this._lifecycleTransition !== transition) { return; }

    delete transition.readiness;
    this._lifecycleState = RUNNING;
    transition.rollbackState = RUNNING;
    transition.isComplete = true;
    this.triggerMethod('start', this, options);
  },

  async _stopLifecycle(transition, options) {
    try {
      if (!transition.stopReadiness) {
        transition.stopReadiness = this._beginReadiness(
          transition,
          'before:stop',
          options
        );
      }

      const readiness = transition.stopReadiness;
      await readiness.promise;
      if (this._lifecycleTransition !== transition) { return; }

      delete transition.readiness;
      transition.rollbackState = STOPPED;
      delete transition.stopReadiness;
      transition.isStopped = true;
      if (transition.type === 'stop') {
        this._lifecycleState = STOPPED;
        transition.isComplete = true;
      }
      this.triggerMethod('stop', this, readiness.options);
      transition.stopDeferred?.resolve(true);
    } catch (error) {
      transition.stopDeferred?.reject(error);
      throw error;
    }
  },

  addChildApp(name, application) {
    if (this._lifecycleState === DESTROYING || this._lifecycleState === DESTROYED) {
      return application;
    }

    if (application instanceof Application &&
        (application._lifecycleState === DESTROYING ||
         application._lifecycleState === DESTROYED)) {
      return application;
    }

    this._assertChildAppCanRegister(name, application);
    if (application._parentApp === this && application._name === name &&
        this._childApps?.get(name) === application) {
      return application;
    }

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

  _assertChildAppCanRegister(name, application) {
    if (typeof name !== 'string' || name.length === 0) {
      throwApplicationOwnershipConflict('A child Application name must be a non-empty string.');
    }

    if (!(application instanceof Application)) {
      throwApplicationOwnershipConflict('A child Application must be an Application instance.');
    }

    if (application._parentApp === this && application._name === name &&
        this._childApps?.get(name) === application) {
      return;
    }

    if (application === this) {
      throwApplicationOwnershipConflict('An Application cannot own itself.');
    }

    if (application._parentApp !== undefined) {
      throwApplicationOwnershipConflict('An Application instance cannot be registered with more than one owner or name.');
    }

    if (this._childApps?.has(name)) {
      throwApplicationOwnershipConflict(`Child Application name "${name}" is already registered.`);
    }

    let parent = this;
    while (parent) {
      if (parent === application) {
        throwApplicationOwnershipConflict('A child Application cannot be an ancestor of its owner.');
      }
      parent = parent._parentApp;
    }
  },

  _removeChildAppReference(name, application) {
    this._childApps.delete(name);
    delete application._parentApp;
    delete application._name;

    if (this._childApps.size === 0) {
      delete this._childApps;
    }
  },

  async _destroyChildApps(options) {
    // Destroy removes the current child from this Map without skipping the next.
    for (const child of this._childApps.values()) {
      await child.destroy(options);
    }
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
