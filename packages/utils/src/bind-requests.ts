// Bind/Unbind Radio Requests
// -----------------------------------------
//
// These methods bind/unbind requests on a Radio channel
// to methods on a target object.
//
// Call with the target as `this`; replies use it as their context.
// The first argument is the channel and the second is a bindings map
// such as { "request:name": "replyHandler" }. Each value can instead be
// a function. Omitting bindings when unbinding removes this target's replies.

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
