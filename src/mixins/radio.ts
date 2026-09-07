import { Radio } from '@marionette/radio';
import { getValue } from '@marionette/utils';
import type { Channel, RadioApi } from '@marionette/radio';
import type { EventsContract as Events } from '@marionette/utils';
import type { bindEvents, bindRequests } from '@marionette/utils';

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

    channel.stopReplying(null, null, this);
    this.stopListening(channel);

    return this;
  },

  getChannel(this: RadioHost) {
    return this._channel;
  }
};
