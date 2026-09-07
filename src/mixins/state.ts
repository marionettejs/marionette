import { getValue } from '@marionette/utils';
import StateApi from '../runtime/state-api.ts';
import type { StateApi as StateProvider } from '../runtime/state-api.ts';
import subscribeBindings from '../utils/subscribe-bindings.ts';

export interface StateHost<State = unknown> {
  State: Partial<StateProvider<never>>;
  state?: State;
  stateEvents?: unknown;
  _state?: State;
  _stateOptions?: unknown;
  _ownsState?: boolean;
  _isDestroyed?: boolean;
  _stateReleased?: boolean;
  _stateEventCleanup?: () => void;
  createState(options?: unknown): State;
  getState(): State;
  _destroyState(): unknown;
}

const StateMixin = {
  State: StateApi,

  _initState(this: StateHost, options: unknown = {}) {
    const stateOption = options != null && Object.hasOwn(options, 'state') ?
      (options as { state?: unknown }).state : undefined;
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

  _initStateEvents<Receiver extends StateHost>(this: Receiver) {
    if (this._isDestroyed) { return this; }

    const stateEvents = getValue(this, 'stateEvents');
    if (stateEvents && !this._isDestroyed) {
      this._stateEventCleanup = subscribeBindings(this, this.State, this.getState(), stateEvents);
    }

    return this;
  },

  getState<State>(this: StateHost<State>): State {
    if (Object.hasOwn(this, '_state')) { return this._state as State; }

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

  _destroyState<Receiver extends StateHost>(this: Receiver) {
    if (!Object.hasOwn(this, '_state') || this._stateReleased) { return this; }

    const state = this._state;
    const cleanup = this._stateEventCleanup;
    const ownsState = this._ownsState;
    const disposeOwned = this.State.disposeOwned;

    this._stateReleased = true;
    delete this._stateEventCleanup;
    delete this._ownsState;

    cleanup?.();
    if (ownsState && disposeOwned) {
      (disposeOwned as (source: unknown) => void).call(this.State, state);
    }

    return this;
  },

  createState() {
    return {};
  }
};

export default StateMixin;
