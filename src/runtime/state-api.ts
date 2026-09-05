// State API
// ---------
import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from '../modules/error.ts';

export interface StateApi<Source = unknown> {
  subscribe: (source: Source, name: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
  disposeOwned?: (source: Source) => void;
}

interface StateApiClass {
  prototype: { State: Partial<StateApi<never>> };
}

// Static setter
export function setStateApi<Receiver extends StateApiClass, Mixin extends object>(
  this: Receiver,
  mixin?: Mixin & Partial<StateApi<never>> | null | boolean | number | bigint | string | symbol
): Receiver {
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
} satisfies StateApi<unknown> as StateApi<unknown>;
