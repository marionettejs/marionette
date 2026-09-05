import getValue from '../utils/get-value.ts';
import disposeAll from '../utils/dispose-all.ts';
import StateApi from '../runtime/state-api.ts';
import subscribeBindings from '../utils/subscribe-bindings.js';

const StateMixin = {
  State: StateApi,

  _initState(options = {}) {
    const stateOption = options != null && Object.hasOwn(options, 'state') ?
      options.state : undefined;
    const hasStateOption = stateOption !== undefined;
    const state = hasStateOption ? stateOption : this.state;

    if (hasStateOption || state !== undefined) {
      this._state = state;
      return;
    }

    if (this.createState !== StateMixin.createState) {
      this._stateOptions = options;
    }
  },

  _initStateEvents() {
    if (this._isDestroyed) { return this; }

    const stateEvents = getValue(this, 'stateEvents');
    if (stateEvents && !this._isDestroyed) {
      // A subscription can synchronously destroy its owner before returning cleanup.
      this._isBindingStateEvents = true;
      try {
        this._stateEventCleanup = subscribeBindings(
          this,
          this.State,
          this.getState(),
          stateEvents,
          'StateApi'
        );
      } catch (error) {
        delete this._isBindingStateEvents;
        disposeAll([() => this._destroyState()], error);
      }
      delete this._isBindingStateEvents;

      if (this._isDestroyed) { this._destroyState(); }
    }

    return this;
  },

  getState() {
    if (Object.hasOwn(this, '_state')) { return this._state; }

    const options = this._stateOptions;
    const state = this.createState(options);
    delete this._stateOptions;
    this._state = state;
    this._ownsState = true;

    if (this._isDestroyed) {
      this._destroyState();
    }

    return state;
  },

  _destroyState() {
    if (this._isBindingStateEvents || !Object.hasOwn(this, '_state') || this._stateReleased) { return this; }

    const state = this._state;
    const cleanup = this._stateEventCleanup;
    const ownsState = this._ownsState;
    const disposeOwned = this.State.disposeOwned;

    this._stateReleased = true;
    delete this._stateEventCleanup;
    delete this._ownsState;

    disposeAll([
      ownsState && typeof disposeOwned === 'function' && (() => disposeOwned.call(this.State, state)),
      cleanup
    ]);

    return this;
  },

  createState() {
    return {};
  }
};

export default StateMixin;
