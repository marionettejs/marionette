import { each, extend, keys } from 'underscore';

import Events from '../mixins/events';
import Requests from '../mixins/requests';

import callHandler from '../utils/call-handler';


const Radio = {};

// Whether or not we're in DEBUG mode or not. DEBUG mode helps you
// get around the issues of lack of warnings when events are mis-typed.
Radio.DEBUG = false;

// Format debug text.
function debugText(warning, eventName, channelName) {
  return warning + (channelName ? ` on the ${ channelName } channel` : '') +
    `: "${ eventName }"`;
}

// This is the method that's called when an unregistered event was called.
// By default, it logs warning to the console. By overriding this you could
// make it throw an Error, for instance. This would make firing a nonexistent event
// have the same consequence as firing a nonexistent method on an Object.
Radio.debugLog = function(warning, eventName, channelName) {
  if (Radio.DEBUG && console && console.warn) {
    console.warn(debugText(warning, eventName, channelName));
  }
};

/*
 * tune-in
 * -------
 * Get console logs of a channel's activity
 *
 */

const _logs = {};

// This is to produce an identical function in both tuneIn and tuneOut,
// so that Events unregisters it.
function _partial(channelName) {
  return _logs[channelName] || (_logs[channelName] = Radio.log.bind(Radio, channelName));
}

extend(Radio, {

  // Log information about the channel and event
  log(channelName, eventName, ...args) {
    if (typeof console === 'undefined') { return; }
    console.log(`[${ channelName }] "${ eventName }"`, args);
  },

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
