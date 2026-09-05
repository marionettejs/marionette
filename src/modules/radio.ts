import { createDebug, debugLog, setDebug, log } from './common/radio.ts';
import Events from '../mixins/events.ts';
import type { EventCallback, Events as EventsContract } from '../mixins/events.ts';
import Requests from '../mixins/requests.ts';
import type { Requests as RequestsContract } from '../mixins/requests.ts';

import { assignOwn, setProperty } from '../utils/assign-in.js';
import callHandler from '../utils/call-handler.ts';
import MarionetteError from './error.ts';

export interface Channel extends EventsContract, RequestsContract {
  channelName: string;
  reset(): this;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- This declaration specializes fluent methods for their actual forwarded receiver.
declare const channelContract: Channel;

type ChannelMethods = {
  on: typeof channelContract.on<Channel>;
  once: typeof channelContract.once<Channel>;
  off: typeof channelContract.off<Channel>;
  listenTo: typeof channelContract.listenTo<Channel>;
  listenToOnce: typeof channelContract.listenToOnce<Channel>;
  stopListening: typeof channelContract.stopListening<Channel>;
  trigger: typeof channelContract.trigger<Channel>;
  triggerMethod: Channel['triggerMethod'];
  reply: typeof channelContract.reply<Channel>;
  replyOnce: typeof channelContract.replyOnce<Channel>;
  stopReplying: typeof channelContract.stopReplying<Channel>;
  request: Channel['request'];
};

// These methods have at most two overloads. Preserve both while prepending the
// channel name; a single-signature method supplies the same signature twice.
type Forward<Method> = Method extends {
  (...args: infer FirstArgs): infer FirstResult;
  (...args: infer LastArgs): infer LastResult;
} ? {
  (channelName: string, ...args: FirstArgs): FirstResult;
  (channelName: string, ...args: LastArgs): LastResult;
} : never;

type ForwardedMethods = { [Method in keyof ChannelMethods]: Forward<ChannelMethods[Method]> };

export interface RadioApi extends ForwardedMethods {
  setDebug: ReturnType<typeof createDebug>['setDebug'];
  channel(name: string): Channel;
  reset(): void;
  reset(name: string): void;
  tuneIn(name: string): RadioApi;
  tuneOut(name: string): RadioApi;
}

type ChannelState = Channel & { _tunedIn?: boolean };
type ChannelConstructor = { new(channelName: string): ChannelState };

export function createRadio(debug = createDebug()): RadioApi {
  const objectKeys = Object.keys;
  const _logs: Record<string, EventCallback> = Object.create(null);

  // This is to produce an identical function in both tuneIn and tuneOut,
  // so that Events unregisters it.
  function getChannelLog(channelName: string) {
    return _logs[channelName] || (_logs[channelName] = log.bind(Radio, channelName));
  }

  // Methods are installed below; callers receive only the completed object.
  const Radio = {} as RadioApi;

  assignOwn(Radio, {
    setDebug: debug.setDebug,

    // Logs all events on this channel to the console. It sets an
    // internal value on the channel telling it we're listening,
    // then sets a listener on the Events
    tuneIn(channelName: string) {
      const channel = Radio.channel(channelName) as ChannelState;
      channel._tunedIn = true;
      channel.on('all', getChannelLog(channelName));
      return Radio;
    },

    // Stop logging all of the activities on this channel to the console
    tuneOut(channelName: string) {
      const channel = Radio.channel(channelName) as ChannelState;
      channel._tunedIn = false;
      channel.off('all', getChannelLog(channelName));
      delete _logs[channelName];
      return Radio;
    }
  } satisfies Pick<RadioApi, 'setDebug' | 'tuneIn' | 'tuneOut'>);

  /*
 * Radio.channel
 * ----------------------
 * Get a reference to a channel by name.
 *
 */

  const _channels: Record<string, ChannelState> = Object.create(null);

  Radio.channel = function(channelName: string) {
    if (!channelName) {
      throw new MarionetteError({
        code: 'MN0017',
        message: 'You must provide a name for the channel.'
      });
    }

    if (_channels[channelName]) {
      return _channels[channelName];
    }

    return (_channels[channelName] = new (Channel as unknown as ChannelConstructor)(channelName));
  };

  /*
 * Channel
 * ----------------------
 * A Channel is an object that extends from Events,
 * and Requests.
 *
 */

  function Channel(this: ChannelState, channelName: string) {
    this.channelName = channelName;
  }

  assignOwn(Channel.prototype, Events, Requests, {

    // Remove all handlers from the messaging systems of this channel
    reset(this: ChannelState) {
      this.off();
      this.stopListening();
      this.stopReplying();
      return this;
    },
  } satisfies Pick<ChannelState, 'reset'>);
  Object.defineProperty(Channel.prototype, '_debugLog', {
    configurable: true,
    value: debug.debugLog,
    writable: true
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
    const methodNames = objectKeys(systems[systemIndex]) as Array<keyof ChannelMethods>;
    for (let index = 0, length = methodNames.length; index < length; index++) {
      const methodName = methodNames[index];
      setProperty(Radio, methodName, function(channelName: string, ...args: unknown[]) {
        const channel = Radio.channel(channelName);
        // The selected overload and argument tuple are known only to the caller.
        return callHandler(channel[methodName] as (...args: unknown[]) => unknown, channel, args);
      });
    }
  }

  Radio.reset = function(channelName?: string) {
    if (!arguments.length) {
      const channelNames = objectKeys(_channels);
      for (let index = 0, length = channelNames.length; index < length; index++) {
        _channels[channelNames[index]].reset();
      }
      return;
    }

    if (!channelName) {
      // A supplied undefined name reaches the same runtime validation as other falsy names.
      Radio.channel(channelName as string);
    }

    let channel;
    try {
      channel = _channels[channelName as string];
    } catch {
      // Use the channel-not-found diagnostic if key coercion throws.
    }

    if (!channel) {
      throw new MarionetteError({
        code: 'MN0021',
        message: 'Radio channel does not exist.'
      });
    }

    channel.reset();
  };

  return Radio;
}

export default createRadio({ debugLog, setDebug });
