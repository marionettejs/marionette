import { assignOwn } from '../utils/assign-in.js';
import eachOwn from '../utils/each-own.js';
import MarionetteError from '../utils/error.js';
import getValue from '../utils/get-value.js';

// MixinOptions
// - behaviors

// Takes care of getting the behavior class
// given options and a key.
// If a user passes in options.behaviorClass
// default to using that.
// If a user passes in a Behavior Class directly, use that
// Otherwise an error is thrown
function getBehaviorClass(options) {
  if (options.behaviorClass) {
    return { BehaviorClass: options.behaviorClass, options };
  }

  // Treat functions as a Behavior constructor.
  if (typeof options === 'function') {
    return { BehaviorClass: options, options: {} };
  }

  throw new MarionetteError({
    code: 'MN0016',
    message: 'Unable to get behavior class. A Behavior constructor should be passed directly or as behaviorClass property of options',
    url: 'marionette.behavior.html#defining-and-attaching-behaviors'
  });
}

function addBehavior(view, behaviorDefinition, allBehaviors) {
  const { BehaviorClass, options } = getBehaviorClass(behaviorDefinition);
  const behavior = new BehaviorClass(options, view);
  allBehaviors.push(behavior);

  parseBehaviors(view, getValue(behavior, 'behaviors'), allBehaviors);
}

// Iterate over the behaviors object, for each behavior
// instantiate it and get its grouped behaviors.
// This accepts a list of behaviors in either an object or array form
function parseBehaviors(view, behaviors, allBehaviors) {
  if (Array.isArray(behaviors)) {
    for (let index = 0, length = behaviors.length; index < length; index++) {
      addBehavior(view, behaviors[index], allBehaviors);
    }
  } else {
    eachOwn(behaviors, behaviorDefinition => {
      addBehavior(view, behaviorDefinition, allBehaviors);
    });
  }

  return allBehaviors;
}

function mergeBehaviorMaps(behaviors, getMap) {
  if (behaviors == null) { return {}; }

  const length = behaviors.length;
  const maps = Array(length);

  for (let index = 0; index < length; index++) {
    maps[index] = getMap(behaviors[index]);
  }

  const merged = {};
  for (let index = 0; index < length; index++) {
    assignOwn(merged, maps[index]);
  }

  return merged;
}

function eachBehavior(behaviors, iteratee) {
  if (behaviors == null) { return; }

  for (let index = 0, length = behaviors.length; index < length; index++) {
    iteratee(behaviors[index]);
  }
}

function rollbackBehaviors(behaviors) {
  for (let index = 0, length = behaviors.length; index < length; index++) {
    try {
      behaviors[index].destroy();
    } catch {
      // Preserve the construction error and continue rolling back.
    }
  }
}

export default {
  _initBehaviors() {
    this._behaviors = [];

    try {
      parseBehaviors(this, getValue(this, 'behaviors'), this._behaviors);
    } catch (error) {
      this._rollbackBehaviors();
      throw error;
    }
  },

  _rollbackBehaviors() {
    rollbackBehaviors(this._behaviors || []);
    this._behaviors = [];
  },

  _getBehaviorTriggers() {
    return mergeBehaviorMaps(this._behaviors, behavior => behavior._getTriggers());
  },

  _getBehaviorEvents() {
    return mergeBehaviorMaps(this._behaviors, behavior => behavior._getEvents());
  },

  // proxy behavior el to the view's el.
  _setBehaviorElements() {
    eachBehavior(this._behaviors, behavior => behavior._syncElement());
  },

  _undelegateBehaviorViewEvents() {
    eachBehavior(this._behaviors, behavior => behavior._undelegateViewEvents());
  },

  // delegate modelEvents and collectionEvents
  _delegateBehaviorEntityEvents() {
    eachBehavior(this._behaviors, behavior => behavior.delegateEntityEvents());
  },

  // undelegate modelEvents and collectionEvents
  _undelegateBehaviorEntityEvents() {
    const behaviors = this._behaviors;
    if (behaviors == null) { return; }

    let error;
    let hasError = false;

    for (let index = 0, length = behaviors.length; index < length; index++) {
      try {
        behaviors[index].undelegateEntityEvents();
      } catch (undelegateError) {
        if (!hasError) {
          error = undelegateError;
          hasError = true;
        }
      }
    }

    if (hasError) { throw error; }
  },

  _destroyBehaviors(options) {
    // Call destroy on each behavior after
    // destroying the view.
    // This unbinds event listeners
    // that behaviors have registered for.
    const behaviors = this._behaviors;
    if (behaviors == null) { return; }

    let error;
    let hasError = false;
    for (let index = 0, length = behaviors.length; index < length; index++) {
      try {
        behaviors[index].destroy(options);
      } catch (destroyError) {
        if (!hasError) {
          error = destroyError;
          hasError = true;
        }
      }
    }

    if (hasError) { throw error; }
  },

  // Remove a behavior
  _removeBehavior(behavior) {
    // Don't worry about the clean up if the view is destroyed
    if (this._isDestroyed) { return; }

    const remainingBehaviors = [];
    for (let index = 0, length = this._behaviors.length; index < length; index++) {
      const currentBehavior = this._behaviors[index];
      if (currentBehavior !== behavior) {
        remainingBehaviors.push(currentBehavior);
      }
    }
    this._behaviors = remainingBehaviors;
  },

  _bindBehaviorUIElements() {
    eachBehavior(this._behaviors, behavior => behavior.bindUIElements());
  },

  _unbindBehaviorUIElements() {
    eachBehavior(this._behaviors, behavior => behavior.unbindUIElements());
  },

  _triggerEventOnBehaviors(eventName, view, options) {
    eachBehavior(this._behaviors, behavior => behavior.triggerMethod(eventName, view, options));
  }
};
