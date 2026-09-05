// Bind/Unbind Radio Requests
// -----------------------------------------
//
// These methods bind/unbind requests on a Radio channel
// to methods on a target object.
//
// The first parameter, `target`, will set the context of the reply method
//
// The second parameter is the `Radio.channel` to bind the reply to.
//
// The third parameter is a hash of { "request:name": "replyHandler" }
// configuration. A function can be supplied instead of a string handler name.

import normalizeMethods from './normalize-methods.ts';
import MarionetteError from '../error.js';
import type { EventMap } from '../../mixins/events.ts';
import type { Bindings } from './normalize-methods.ts';

interface ReplyChannel {
  reply(bindings: EventMap, context: unknown): unknown;
}

interface ReplyOwner {
  stopReplying(bindings: EventMap | null, context: unknown, owner?: unknown): unknown;
}

function normalizeBindings(context: unknown, bindings: unknown) {
  const bindingsType = typeof bindings;
  if (bindings === null || (bindingsType !== 'object' && bindingsType !== 'function')) {
    throw new (MarionetteError as unknown as new (options: object) => Error)({
      code: 'MN0010',
      message: 'Bindings must be an object.',
      url: 'common.html#bindrequests'
    });
  }

  // The object/function check above excludes every no-map return.
  return normalizeMethods.call(context, bindings as Bindings) as EventMap;
}

function bindRequests<Receiver>(
  this: Receiver, channel?: ReplyChannel | null, bindings?: Bindings | null | false | 0 | ''
) {
  if (!channel || !bindings) { return this; }

  channel.reply(normalizeBindings(this, bindings), this);

  return this;
}

function unbindRequests<Receiver>(
  this: Receiver, channel?: ReplyOwner | null, bindings?: Bindings | null | false | 0 | ''
) {
  if (!channel) { return this; }

  if (!bindings) {
    channel.stopReplying(null, null, this);
    return this;
  }

  channel.stopReplying(normalizeBindings(this, bindings), this);

  return this;
}

export {
  bindRequests,
  unbindRequests
};
