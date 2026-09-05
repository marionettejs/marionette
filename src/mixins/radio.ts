import Radio from '../modules/radio.ts';
import disposeAll from '../utils/dispose-all.ts';
import getValue from '../utils/get-value.ts';
import type { Channel, RadioApi } from '../modules/radio.ts';
import type { Events } from './events.ts';
import type { bindEvents } from '../modules/common/bind-events.ts';
import type { bindRequests } from '../modules/common/bind-requests.ts';

export interface RadioHost extends Pick<Events, 'listenTo' | 'stopListening'> {
  Radio: RadioApi;
  _channel?: Channel;
  bindEvents: typeof bindEvents;
  bindRequests: typeof bindRequests;
}


// MixinOptions
// - channelName
// - radioEvents
// - radioRequests

export default {

  Radio,

  _initRadio(this: RadioHost) {
    const channelName = getValue(this, 'channelName');

    if (!channelName) {
      return;
    }

    const channel = this._channel = this.Radio.channel(channelName as string);

    const radioEvents = getValue(this, 'radioEvents');
    this.bindEvents(channel, radioEvents as Parameters<typeof bindEvents>[1]);

    const radioRequests = getValue(this, 'radioRequests');
    this.bindRequests(channel, radioRequests as Parameters<typeof bindRequests>[1]);
  },

  _destroyRadio<Receiver extends RadioHost>(this: Receiver) {
    const channel = this._channel;
    if (!channel) { return this; }

    disposeAll([
      () => this.stopListening(channel),
      () => channel.stopReplying(null, null, this)
    ]);

    return this;
  },

  getChannel(this: RadioHost) {
    return this._channel;
  }
};
