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
import type { EventMap } from './events.ts';
import type { Bindings } from './normalize-methods.ts';

interface ReplyChannel {
  reply(bindings: EventMap, context: unknown): unknown;
}

interface ReplyOwner {
  stopReplying(bindings: EventMap | null, context: unknown, owner?: unknown): unknown;
}

function bindRequests<Receiver>(
  this: Receiver, channel?: ReplyChannel | null | false | 0 | 0n | '', bindings?: Bindings | null | false | 0 | 0n | ''
) {
  if (!channel || !bindings) { return this; }

  channel.reply(normalizeMethods.call(this, bindings) as EventMap, this);

  return this;
}

function unbindRequests<Receiver>(
  this: Receiver, channel?: ReplyOwner | null | false | 0 | 0n | '', bindings?: Bindings | null | false | 0 | 0n | ''
) {
  if (!channel) { return this; }

  if (!bindings) {
    channel.stopReplying(null, null, this);
    return this;
  }

  channel.stopReplying(normalizeMethods.call(this, bindings) as EventMap, this);

  return this;
}

export {
  bindRequests,
  unbindRequests
};
