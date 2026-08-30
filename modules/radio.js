import { setDebug, debugLog, log } from './common/radio.js';
import Events from '../mixins/events.js';
import Requests from '../mixins/requests.js';

import { assignOwn, setProperty } from '../utils/assign-in.js';
import callHandler from '../utils/call-handler.js';
import MarionetteError from '../utils/error.js';

const objectKeys = Object.keys;
const _logs = Object.create(null);

// This is to produce an identical function in both tuneIn and tuneOut,
// so that Events unregisters it.
function _partial(channelName) {
  return _logs[channelName] || (_logs[channelName] = log.bind(Radio, channelName));
}

const Radio = {};

assignOwn(Radio, {
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

Radio._channels = Object.create(null);

Radio.channel = function(channelName) {
  if (!channelName) {
    throw new MarionetteError({
      code: 'MN0017',
      message: 'You must provide a name for the channel.'
    });
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

assignOwn(Radio.Channel.prototype, Events, Requests, {

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

const systems = [Events, Requests];
for (let systemIndex = 0, systemsLength = systems.length; systemIndex < systemsLength; systemIndex++) {
  const methodNames = objectKeys(systems[systemIndex]);
  for (let index = 0, length = methodNames.length; index < length; index++) {
    const methodName = methodNames[index];
    setProperty(Radio, methodName, function(channelName, ...args) {
      const channel = this.channel(channelName);
      return callHandler(channel[methodName], channel, args);
    });
  }
}

Radio.reset = function(channelName) {
  if (!arguments.length) {
    const channelNames = objectKeys(this._channels);
    for (let index = 0, length = channelNames.length; index < length; index++) {
      this._channels[channelNames[index]].reset();
    }
    return;
  }

  if (!channelName) {
    Radio.channel(channelName);
  }

  let channel;
  try {
    channel = this._channels[channelName];
  } catch {
    // The stable diagnostic below formats hostile property keys safely.
  }

  if (!channel) {
    throw new MarionetteError({
      code: 'MN0021',
      message: 'Radio channel does not exist.'
    });
  }

  channel.reset();
};

export default Radio;
