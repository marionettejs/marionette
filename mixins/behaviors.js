import { isFunction, extend, reduce, result, without, map } from 'underscore';
import MarionetteError from '../utils/error';

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

  //treat functions as a Behavior constructor
  if (isFunction(options)) {
    return { BehaviorClass: options, options: {} };
  }

  throw new MarionetteError({
    message: 'Unable to get behavior class. A Behavior constructor should be passed directly or as behaviorClass property of options',
    url: 'marionette.behavior.html#defining-and-attaching-behaviors'
  });
}

// Iterate over the behaviors object, for each behavior
// instantiate it and get its grouped behaviors.
// This accepts a list of behaviors in either an object or array form
function parseBehaviors(view, behaviors, allBehaviors) {
  return reduce(behaviors, (reducedBehaviors, behaviorDefiniton) => {
    const { BehaviorClass, options } = getBehaviorClass(behaviorDefiniton);
    const behavior = new BehaviorClass(options, view);
    reducedBehaviors.push(behavior);

    return parseBehaviors(view, result(behavior, 'behaviors'), reducedBehaviors);
  }, allBehaviors);
}

export default {
  _initBehaviors() {
    this._behaviors = parseBehaviors(this, result(this, 'behaviors'), []);
  },

  _getBehaviorTriggers() {
    const triggers = map(this._behaviors, behavior => behavior._getTriggers());
    return reduce(triggers, function(memo, _triggers) {
      return extend(memo, _triggers);
    }, {});
  },

  _getBehaviorEvents() {
    const events = map(this._behaviors, behavior => behavior._getEvents());
    return reduce(events, function(memo, _events) {
      return extend(memo, _events);
    }, {});
  },

  // proxy behavior el to the view's el.
  _setBehaviorElements() {
    map(this._behaviors, behavior => behavior.setElement());
  },

  // delegate modelEvents and collectionEvents
  _delegateBehaviorEntityEvents() {
    map(this._behaviors, behavior => behavior.delegateEntityEvents());
  },

  // undelegate modelEvents and collectionEvents
  _undelegateBehaviorEntityEvents() {
    map(this._behaviors, behavior => behavior.undelegateEntityEvents());
  },

  _destroyBehaviors(options) {
    // Call destroy on each behavior after
    // destroying the view.
    // This unbinds event listeners
    // that behaviors have registered for.
    map(this._behaviors, behavior => behavior.destroy(options));
  },

  // Remove a behavior
  _removeBehavior(behavior) {
    // Don't worry about the clean up if the view is destroyed
    if (this._isDestroyed) { return; }

    // Remove behavior-only triggers and events
    this.undelegate(`.trig${ behavior.cid } .${ behavior.cid }`);

    this._behaviors = without(this._behaviors, behavior);
  },

  _bindBehaviorUIElements() {
    map(this._behaviors, behavior => behavior.bindUIElements());
  },

  _unbindBehaviorUIElements() {
    map(this._behaviors, behavior => behavior.unbindUIElements());
  },

  _triggerEventOnBehaviors(eventName, view, options) {
    map(this._behaviors, behavior => behavior.triggerMethod(eventName, view, options));
  }
};
