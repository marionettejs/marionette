import { result } from 'underscore';
import Radio from '../modules/radio';


// MixinOptions
// - channelName
// - radioEvents
// - radioRequests

export default {

  _initRadio() {
    const channelName = result(this, 'channelName');

    if (!channelName) {
      return;
    }

    const channel = this._channel = Radio.channel(channelName);

    const radioEvents = result(this, 'radioEvents');
    this.bindEvents(channel, radioEvents);

    const radioRequests = result(this, 'radioRequests');
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
