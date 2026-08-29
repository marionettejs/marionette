import Radio from '../modules/radio.js';
import getValue from '../utils/get-value.js';


// MixinOptions
// - channelName
// - radioEvents
// - radioRequests

export default {

  _initRadio() {
    const channelName = getValue(this, 'channelName');

    if (!channelName) {
      return;
    }

    const channel = this._channel = Radio.channel(channelName);

    const radioEvents = getValue(this, 'radioEvents');
    this.bindEvents(channel, radioEvents);

    const radioRequests = getValue(this, 'radioRequests');
    this.bindRequests(channel, radioRequests);

    this.on('destroy', this._destroyRadio);
  },

  _destroyRadio() {
    this._channel.stopReplying(null, null, this);
  },

  getChannel() {
    return this._channel;
  }
};
