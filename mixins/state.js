import getValue from '../utils/get-value.js';
import MarionetteError from '../utils/error.js';
import State from '../modules/state.js';
import disposeAll from '../utils/dispose-all.js';

function throwStateOwnershipConflict() {
  throw new MarionetteError({
    code: 'MN0035',
    name: 'StateError',
    message: 'A State instance must be live and unowned before composition.',
    url: 'marionette.state.html#owned-state'
  });
}

export default {
  _initState(options = {}) {
    const hasStateOption = options != null && Object.hasOwn(options, 'state');
    const state = hasStateOption ? options.state : this.state;

    if (hasStateOption || state !== undefined) {
      this._stateDefinition = state;
      this.getState();
    }
  },

  _initStateEvents() {
    if (this._isDestroyed) { return this; }

    const stateEvents = getValue(this, 'stateEvents');
    if (stateEvents) {
      this.bindEvents(this.getState(), stateEvents);
    }

    return this;
  },

  getState() {
    if (this._state) { return this._state; }

    const hasStateDefinition = Object.hasOwn(this, '_stateDefinition');
    const definition = getValue(this, hasStateDefinition ? '_stateDefinition' : 'state');
    delete this._stateDefinition;

    const state = definition instanceof State ? definition : new State(definition);
    if (state._owner !== undefined || state.isDestroyed()) {
      throwStateOwnershipConflict();
    }

    state._owner = this;
    this._state = state;

    if (this._isDestroyed) {
      this._destroyState();
    }

    return state;
  },

  _destroyState() {
    const state = this._state;
    if (!state) { return this; }

    disposeAll([
      () => {
        if (!state.isDestroyed()) { state.destroy(); }
      },
      () => { delete state._owner; },
      () => this.unbindEvents(state)
    ]);

    return this;
  }
};
