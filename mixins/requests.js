import { debugLog, log } from '../modules/common/radio.js';
import { assignOwn, setProperty } from '../utils/assign-in.js';
import { eventSplitter } from '../utils/build-event-args.js';
import callHandler from '../utils/call-handler.js';
import makeCallback from '../utils/make-callback.js';
import onceWrap from '../utils/once-wrap.js';

/*
 * Requests
 * -----------------------
 * A messaging system for requesting data.
 *
 */

const objectKeys = Object.keys;

function getDebugLog(channel) {
  return channel._debugLog || debugLog;
}

function getKeys(object) {
  const type = typeof object;
  return object != null && (type === 'object' || type === 'function') ? objectKeys(object) : [];
}

const registerReply = function(requests, name, callback, context) {
  if (Object.hasOwn(requests, name)) {
    getDebugLog(this)('A request was overwritten', name, this.channelName);
  }

  setProperty(requests, name, {
    callback: makeCallback(callback),
    context: context || this,
  });

  return requests;
};

const stopReducer = function(requests, { name, callback, context }) {
  const names = name ? [name] : getKeys(requests);

  for (let index = 0, length = names.length; index < length; index++) {
    const key = names[index];
    const handler = Object.hasOwn(requests, key) ? requests[key] : undefined;

    // Bail out if there are no events stored.
    if (
      !handler ||
        callback && callback !== handler.callback &&
          callback !== handler.callback._callback ||
            context && context !== handler.context
    ) {
      continue;
    }

    delete requests[key];
  }

  return requests;
};

function dispatchOverload(receiver, method, name, callback, context) {
  if (name && typeof name === 'object') {
    const names = getKeys(name);
    const mapContext = context || callback;
    for (let index = 0, length = names.length; index < length; index++) {
      const key = names[index];
      receiver[method](key, name[key], mapContext);
    }
    return true;
  }

  if (name && eventSplitter.test(name)) {
    const names = name.split(eventSplitter);
    for (let index = 0, length = names.length; index < length; index++) {
      receiver[method](names[index], callback, context);
    }
    return true;
  }

  return false;
}

export default {

  // Set up a handler for a request
  reply(name, callback, context) {
    if (dispatchOverload(this, 'reply', name, callback, context)) { return this; }

    this._rdRequests = registerReply.call(this, this._rdRequests || {}, name, callback, context);

    return this;
  },

  // Set up a handler that can only be requested once
  replyOnce(name, callback, context) {
    if (dispatchOverload(this, 'replyOnce', name, callback, context)) { return this; }

    const onceCallback = onceWrap(makeCallback(callback), callbackToRemove => {
      this.stopReplying(name, callbackToRemove);
    });

    return this.reply(name, onceCallback, context);
  },

  // Remove handler(s)
  stopReplying(name, callback, context) {
    if (dispatchOverload(this, 'stopReplying', name, callback, context)) { return this; }
    if (!this._rdRequests) { return this; }

    if (!name && !callback && !context) {
      delete this._rdRequests;
      return this;
    }

    this._rdRequests = stopReducer.call(this, this._rdRequests, { name, callback, context });

    return this;
  },

  // Make a request
  request(name, ...args) {
    if (name && typeof name === 'object') {
      const replies = {};
      const names = getKeys(name);
      for (let index = 0, length = names.length; index < length; index++) {
        const key = names[index];
        const result = this.request(key, name[key], ...args);
        if (eventSplitter.test(key)) {
          assignOwn(replies, result);
        } else {
          setProperty(replies, key, result);
        }
      }
      return replies;
    }

    if (name && eventSplitter.test(name)) {
      const replies = {};
      const names = name.split(eventSplitter);
      for (let index = 0, length = names.length; index < length; index++) {
        const n = names[index];
        setProperty(replies, n, this.request(n, ...args));
      }
      return replies;
    }

    const channelName = this.channelName;
    const requests = this._rdRequests;

    // // Check if we should log the request, and if so, do it
    if (channelName && this._tunedIn) {
      log.apply(this, [channelName, name].concat(args));
    }

    // If the request isn't handled, log it in DEBUG mode and exit
    if (requests) {
      const hasRequest = Object.hasOwn(requests, name);
      const handler = hasRequest ? requests[name] :
        Object.hasOwn(requests, 'default') ? requests.default : undefined;

      if (handler) {
        args = hasRequest ? args : arguments;
        return callHandler(handler.callback, handler.context, args);
      }
    }

    getDebugLog(this)('An unhandled request was fired', name, channelName);
  },
};
