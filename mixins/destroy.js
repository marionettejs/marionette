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
    this.triggerMethod('destroy', this, options);
    this.stopListening();

    return this;
  }
};
