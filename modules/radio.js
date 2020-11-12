import { each, extend, keys } from 'underscore';

import { setDebug, debugLog, log } from './common/radio';
import Events from '../mixins/events';
import Requests from '../mixins/requests';

import callHandler from '../utils/call-handler';

const _logs = {};

// This is to produce an identical function in both tuneIn and tuneOut,
// so that Events unregisters it.
function _partial(channelName) {
  return _logs[channelName] || (_logs[channelName] = log.bind(Radio, channelName));
}

const Radio = {};

extend(Radio, {
  setDebug,

  log,

  debugLog,

  // Logs all events on this channel to the console. It sets an
  // internal value on the channel telling it we're listening,
  // then sets a listener on the Events
  tuneIn(channelName) {
    const channel = Radio.channel(channelName);
    channel._tunedIn = true;
    channel.on('all', _partial(channelName));
    return this;
  },

  // Stop logging all of the activities on this channel to the console
  tuneOut(channelName) {
    const channel = Radio.channel(channelName);
    channel._tunedIn = false;
    channel.off('all', _partial(channelName));
    delete _logs[channelName];
    return this;
  }
});

/*
 * Radio.channel
 * ----------------------
 * Get a reference to a channel by name.
 *
 */

Radio._channels = {};

Radio.channel = function(channelName) {
  if (!channelName) {
    throw new Error('You must provide a name for the channel.');
  }

  if (Radio._channels[channelName]) {
    return Radio._channels[channelName];
  }

  return (Radio._channels[channelName] = new Radio.Channel(channelName));
};

/*
 * Radio.Channel
 * ----------------------
 * A Channel is an object that extends from Events,
 * and Radio.Requests.
 *
 */

Radio.Channel = function(channelName) {
  this.channelName = channelName;
};

extend(Radio.Channel.prototype, Events, Requests, {

  // Remove all handlers from the messaging systems of this channel
  reset() {
    this.off();
    this.stopListening();
    this.stopReplying();
    return this;
  },
});

/*
 * Top-level API
 * -------------
 * Supplies the 'top-level API' for working with Channels directly
 * from Radio.
 *
 */

each([Events, Requests], system => {
  each(keys(system), methodName => {
    Radio[methodName] = function(channelName, ...args) {
      const channel = this.channel(channelName);
      return callHandler(channel[methodName], channel, args);
    };
  });
});

Radio.reset = function(channelName) {
  const channels = !channelName ? this._channels : [this._channels[channelName]];
  each(channels, channel => { channel.reset(); });
};

export default Radio;
