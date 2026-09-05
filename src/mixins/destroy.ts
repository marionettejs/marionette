import disposeAll from '../utils/dispose-all.ts';
import type { Events } from './events.ts';

export interface DestroyHost extends Pick<Events, 'stopListening' | 'trigger' | 'triggerMethod'> {
  _isDestroyed?: boolean;
  _isDestroying?: boolean;
  _destroyState?(): unknown;
  _destroyRadio?(): unknown;
}

export default {
  _isDestroyed: false,

  isDestroyed(this: DestroyHost & { _isDestroyed: boolean }) {
    return this._isDestroyed;
  },

  destroy<Receiver extends DestroyHost>(this: Receiver, options?: unknown) {
    if (this._isDestroyed || this._isDestroying) { return this; }
    this._isDestroying = true;
    try {
      this.triggerMethod('before:destroy', this, options);
    } catch (error) {
      delete this._isDestroying;
      throw error;
    }
    this._isDestroyed = true;
    disposeAll([
      () => this.stopListening(),
      () => this.triggerMethod('destroy', this, options),
      () => this._destroyState?.(),
      () => this._destroyRadio?.()
    ]);

    return this;
  }
};
