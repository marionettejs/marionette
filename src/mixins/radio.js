import Radio from '../modules/radio.ts';
import disposeAll from '../utils/dispose-all.ts';
import getValue from '../utils/get-value.ts';


// MixinOptions
// - channelName
// - radioEvents
// - radioRequests

export default {

  Radio,

  _initRadio() {
    const channelName = getValue(this, 'channelName');

    if (!channelName) {
      return;
    }

    const channel = this._channel = this.Radio.channel(channelName);

    const radioEvents = getValue(this, 'radioEvents');
    this.bindEvents(channel, radioEvents);

    const radioRequests = getValue(this, 'radioRequests');
    this.bindRequests(channel, radioRequests);
  },

  _destroyRadio() {
    const channel = this._channel;
    if (!channel) { return this; }

    disposeAll([
      () => this.stopListening(channel),
      () => channel.stopReplying(null, null, this)
    ]);

    return this;
  },

  getChannel() {
    return this._channel;
  }
};
