// State API
// ---------
import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from '../utils/error.js';

// Static setter
export function setStateApi(mixin) {
  this.prototype.State = assignOwn({}, this.prototype.State, mixin);
  return this;
}

export default {
  subscribe() {
    throw new MarionetteError({
      code: 'MN0037',
      name: 'StateApiError',
      message: 'The default StateApi cannot observe stateEvents. Configure a StateApi that supports this state source or remove stateEvents.',
      url: 'marionette.state.html#state-events'
    });
  }
};
