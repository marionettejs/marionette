import { debugLog, log } from '../modules/common/radio.js';
import { assignOwn, setProperty } from '../utils/assign-in.js';
import buildEventArgs, { eventSplitter } from '../utils/build-event-args.js';
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

function getKeys(object) {
  const type = typeof object;
  return object != null && (type === 'object' || type === 'function') ? objectKeys(object) : [];
}

const replyReducer = function(isOnce, requests, { name, callback, context }) {
  if (Object.hasOwn(requests, name)) {
    debugLog('A request was overwritten', name, this.channelName);
  }

  setProperty(requests, name, {
    callback: isOnce ? onceWrap(makeCallback(callback), this.stopReplying.bind(this, name)) : makeCallback(callback),
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
      // Radio.debugLog('Attempted to remove the unregistered request', name, this.channelName);
      continue;
    }

    delete requests[key];
  }

  return requests;
};

function registerReplies(context, eventArgs, requests, isOnce) {
  for (let index = 0, length = eventArgs.length; index < length; index++) {
    requests = replyReducer.call(context, isOnce, requests, eventArgs[index]);
  }

  return requests;
}

function removeReplies(context, eventArgs, requests) {
  for (let index = 0, length = eventArgs.length; index < length; index++) {
    requests = stopReducer.call(context, requests, eventArgs[index]);
  }

  return requests;
}

export default {

  // Set up a handler for a request
  reply(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);

    this._rdRequests = registerReplies(this, eventArgs, this._rdRequests || {}, false);

    return this;
  },

  // Set up a handler that can only be requested once
  replyOnce(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);

    this._rdRequests = registerReplies(this, eventArgs, this._rdRequests || {}, true);

    return this;
  },

  // Remove handler(s)
  stopReplying(name, callback, context) {
    if (!this._rdRequests) {return this;}

    if (!name && !callback && !context) {
      delete this._rdRequests;
      return this;
    }

    const eventArgs = buildEventArgs(name, callback, context);
    this._rdRequests = removeReplies(this, eventArgs, this._rdRequests);

    return this;
  },

  // Make a request
  request(name, ...args) {
    if (name && typeof name === 'object') {
      const replies = {};
      const names = getKeys(name);
      for (let index = 0, length = names.length; index < length; index++) {
        const key = names[index];
        const result = this.request(key, name[key]);
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

    debugLog('An unhandled request was fired', name, channelName);
  },
};
