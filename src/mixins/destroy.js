import disposeAll from '../utils/dispose-all.ts';

export default {
  _isDestroyed: false,

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy(options) {
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
