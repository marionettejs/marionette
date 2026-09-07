import eachOwn from '../utils/each-own.ts';
import { MarionetteError, getValue } from '@marionette/utils';
import type { TriggerTarget } from './view-events.ts';

export interface BehaviorInstance {
  _isDestroyed?: boolean;
  behaviors?: unknown;
  destroy(options?: unknown): unknown;
  _delegateViewEvents(view: TriggerTarget): unknown;
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
}

type BehaviorConstruction = new (options: unknown, view: unknown) => BehaviorInstance;

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

export default {
  _initBehaviors(this: BehaviorContainer) {
    this._behaviors = [];

    parseBehaviors(this, getValue(this, 'behaviors'));
  },

  _delegateBehaviorViewEvents(this: BehaviorContainer & TriggerTarget) {
    eachBehavior(this._behaviors, behavior => behavior._delegateViewEvents(this));
  },

  _undelegateBehaviorViewEvents(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior._undelegateViewEvents());
  },

  // delegate modelEvents and collectionEvents
  _delegateBehaviorEntityEvents(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior.delegateEntityEvents());
  },

  // undelegate modelEvents and collectionEvents
  _undelegateBehaviorEntityEvents(this: BehaviorContainer) {
    eachBehavior(this._behaviors, behavior => behavior.undelegateEntityEvents());
  },

  _destroyBehaviors(this: BehaviorContainer, options?: unknown) {
    // Call destroy on each behavior after
    // destroying the view.
    // This unbinds event listeners
    // that behaviors have registered for.
    eachBehavior(this._behaviors, behavior => behavior.destroy(options));
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
