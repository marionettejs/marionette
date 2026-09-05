import eachOwn from '../utils/each-own.js';
import MarionetteError from '../modules/error.ts';
import disposeAll from '../utils/dispose-all.ts';
import getValue from '../utils/get-value.ts';

export interface BehaviorInstance {
  _isDestroyed?: boolean;
  behaviors?: unknown;
  destroy(options?: unknown): unknown;
  _syncElement(): unknown;
  _undelegateViewEvents(options?: unknown): unknown;
  delegateEntityEvents(): unknown;
  undelegateEntityEvents(options?: unknown): unknown;
  bindUIElements(): unknown;
  unbindUIElements(): unknown;
  triggerMethod(event: string, ...args: unknown[]): unknown;
}

export type BehaviorConstructor = new (options: never, view: never) => BehaviorInstance;
export interface BehaviorOptionsDefinition {
  behaviorClass: BehaviorConstructor;
  [key: string]: unknown;
}
export type BehaviorDefinition = BehaviorConstructor | BehaviorOptionsDefinition;
export type BehaviorDefinitions = readonly BehaviorDefinition[] | Record<string, BehaviorDefinition>;

export interface BehaviorContainer {
  behaviors?: BehaviorDefinitions | (() => BehaviorDefinitions);
  _behaviors?: BehaviorInstance[];
  _isDestroyed?: boolean;
  _rollbackBehaviors(): void;
}

type BehaviorConstruction = new (options: unknown, view: unknown) => BehaviorInstance;
type CleanupMethod = 'destroy' | '_undelegateViewEvents' | 'undelegateEntityEvents';

// MixinOptions
// - behaviors

// Takes care of getting the behavior class
// given options and a key.
// If a user passes in options.behaviorClass
// default to using that.
// If a user passes in a Behavior Class directly, use that
// Otherwise an error is thrown
function getBehaviorClass(options: BehaviorDefinition) {
  if ((options as BehaviorOptionsDefinition).behaviorClass) {
    return { BehaviorClass: (options as BehaviorOptionsDefinition).behaviorClass, options };
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

function addBehavior(view: BehaviorContainer, behaviorDefinition: BehaviorDefinition) {
  const { BehaviorClass, options } = getBehaviorClass(behaviorDefinition);
  const behavior = new (BehaviorClass as BehaviorConstruction)(options, view);
  if (!behavior._isDestroyed) {
    view._behaviors!.push(behavior);
  }

  parseBehaviors(view, getValue(behavior, 'behaviors'));
}

// Iterate over the behaviors object, for each behavior
// instantiate it and get its grouped behaviors.
// This accepts a list of behaviors in either an object or array form
function parseBehaviors(view: BehaviorContainer, behaviors: unknown) {
  if (Array.isArray(behaviors)) {
    for (let index = 0, length = behaviors.length; index < length; index++) {
      addBehavior(view, behaviors[index]);
    }
  } else {
    eachOwn(behaviors, (behaviorDefinition: BehaviorDefinition) => {
      addBehavior(view, behaviorDefinition);
    });
  }
}

function eachBehavior(behaviors: BehaviorInstance[] | undefined, iteratee: (behavior: BehaviorInstance) => unknown) {
  if (behaviors == null) { return; }

  for (let index = 0, length = behaviors.length; index < length; index++) {
    iteratee(behaviors[index]);
  }
}

function disposeBehaviors(behaviors: BehaviorInstance[] | undefined, method: CleanupMethod, options?: unknown) {
  if (behaviors == null) { return; }

  disposeAll(behaviors.map(behavior => () => behavior[method](options)).reverse());
}

function rollbackBehaviors(behaviors: BehaviorInstance[]) {
  for (let index = 0, length = behaviors.length; index < length; index++) {
    try {
      behaviors[index].destroy();
    } catch {
      // Preserve the construction error and continue rolling back.
    }
  }
}

export default {
  _initBehaviors(this: BehaviorContainer) {
    this._behaviors = [];

    try {
      parseBehaviors(this, getValue(this, 'behaviors'));
    } catch (error) {
      this._rollbackBehaviors();
      throw error;
    }
  },

  _rollbackBehaviors(this: BehaviorContainer) {
    rollbackBehaviors(this._behaviors || []);
    this._behaviors = [];
  },

  // proxy behavior el to the view's el.
  _setBehaviorElements(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior._syncElement());
  },

  _undelegateBehaviorViewEvents(this: BehaviorContainer) {
    disposeBehaviors(this._behaviors, '_undelegateViewEvents');
  },

  // delegate modelEvents and collectionEvents
  _delegateBehaviorEntityEvents(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior.delegateEntityEvents());
  },

  // undelegate modelEvents and collectionEvents
  _undelegateBehaviorEntityEvents(this: BehaviorContainer) {
    disposeBehaviors(this._behaviors, 'undelegateEntityEvents');
  },

  _destroyBehaviors(this: BehaviorContainer, options?: unknown) {
    // Call destroy on each behavior after
    // destroying the view.
    // This unbinds event listeners
    // that behaviors have registered for.
    disposeBehaviors(this._behaviors, 'destroy', options);
  },

  // Remove a behavior
  _removeBehavior(this: BehaviorContainer, behavior: BehaviorInstance) {
    // Don't worry about the clean up if the view is destroyed
    if (this._isDestroyed) { return; }

    const remainingBehaviors: BehaviorInstance[] = [];
    for (let index = 0, length = this._behaviors!.length; index < length; index++) {
      const currentBehavior = this._behaviors![index];
      if (currentBehavior !== behavior) {
        remainingBehaviors.push(currentBehavior);
      }
    }
    this._behaviors = remainingBehaviors;
  },

  _bindBehaviorUIElements(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior.bindUIElements());
  },

  _unbindBehaviorUIElements(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior.unbindUIElements());
  },

  _triggerEventOnBehaviors(this: BehaviorContainer, eventName: string, view: unknown, options?: unknown) {
    eachBehavior(this._behaviors, behavior => behavior.triggerMethod(eventName, view, options));
  }
};
