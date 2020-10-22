// Bind/Unbind Radio Requests
// -----------------------------------------
//
// These methods are used to bind/unbind a backbone.radio request
// to methods on a target object.
//
// The first parameter, `target`, will set the context of the reply method
//
// The second parameter is the `Radio.channel` to bind the reply to.
//
// The third parameter is a hash of { "request:name": "replyHandler" }
// configuration. A function can be supplied instead of a string handler name.

import { isObject } from 'underscore';
import normalizeMethods from './normalize-methods';
import MarionetteError from '../../utils/error';

function normalizeBindings(context, bindings) {
  if (!isObject(bindings)) {
    throw new MarionetteError({
      message: 'Bindings must be an object.',
      url: 'common.html#bindrequests'
    });
  }

  return normalizeMethods.call(context, bindings);
}

function bindRequests(channel, bindings) {
  if (!channel || !bindings) { return this; }

  channel.reply(normalizeBindings(this, bindings), this);

  return this;
}

function unbindRequests(channel, bindings) {
  if (!channel) { return this; }

  if (!bindings) {
    channel.stopReplying(null, null, this);
    return this;
  }

  channel.stopReplying(normalizeBindings(this, bindings));

  return this;
}

export {
  bindRequests,
  unbindRequests
};
