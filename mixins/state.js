import getValue from '../utils/get-value.js';
import disposeAll from '../utils/dispose-all.js';
import StateApi from '../runtime/state-api.js';
import subscribeBindings from '../utils/subscribe-bindings.js';

const StateMixin = {
  State: StateApi,

  _initState(options = {}) {
    const hasStateOption = options != null && Object.hasOwn(options, 'state');
    const state = hasStateOption ? options.state : this.state;

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
    if (stateEvents) {
      this._stateEventUnsubscribe = subscribeBindings(
        this,
        this.State,
        this.getState(),
        stateEvents,
        'StateApi'
      );
    }

    return this;
  },

  getState() {
    if (Object.hasOwn(this, '_state')) { return this._state; }

    const options = this._stateOptions;
    delete this._stateOptions;
    const state = this.createState(options);
    this._state = state;
    this._ownsState = true;

    if (this._isDestroyed) {
      this._destroyState();
    }

    return state;
  },

  _destroyState() {
    if (!Object.hasOwn(this, '_state') || this._stateReleased) { return this; }

    const state = this._state;
    const unsubscribe = this._stateEventUnsubscribe;
    const ownsState = this._ownsState;
    const disposeOwned = this.State.disposeOwned;

    this._stateReleased = true;
    delete this._stateEventUnsubscribe;
    delete this._ownsState;

    disposeAll([
      ownsState && typeof disposeOwned === 'function' && (() => disposeOwned.call(this.State, state)),
      unsubscribe
    ]);

    return this;
  },

  createState() {
    return {};
  }
};

export default StateMixin;
