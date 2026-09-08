import type { EventsContract as Events } from '@mnjs/utils';

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
    this.triggerMethod('before:destroy', this, options);
    this._isDestroyed = true;
    this._destroyRadio?.();
    this._destroyState?.();
    this.triggerMethod('destroy', this, options);
    this.stopListening();

    return this;
  }
};
