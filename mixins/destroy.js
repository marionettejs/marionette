export default {
  _isDestroyed: false,

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy(options) {
    if (this._isDestroyed || this._isDestroying) { return this; }
    this._isDestroying = true;

    this.triggerMethod('before:destroy', this, options);
    this._isDestroyed = true;
    this.triggerMethod('destroy', this, options);
    this.stopListening();

    return this;
  }
};
