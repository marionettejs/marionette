import { each, extend, keys, reduce } from 'underscore';

import buildEventArgs, { eventSplitter } from '../utils/build-event-args';
import callHandler from '../utils/call-handler';
import makeCallback from '../utils/make-callback';
import onceWrap from '../utils/once-wrap';

/*
 * Requests
 * -----------------------
 * A messaging system for requesting data.
 *
 */

const replyReducer = function(isOnce, requests, { name, callback, context }) {
  // if (requests[name]) {
  //   Radio.debugLog('A request was overwritten', name, this.channelName);
  // }

  requests[name] = {
    callback: isOnce ? onceWrap(makeCallback(callback), this.stopReplying.bind(this, name)) : makeCallback(callback),
    context: context || this,
  };

  return requests;
};

const stopReducer = function(requests, { name, callback, context }) {
  const names = name ? [name] : keys(requests);

  each(names, key => {
    const handler = requests[key];

    // Bail out if there are no events stored.
    if (
      !handler ||
        callback && callback !== handler.callback &&
          callback !== handler.callback._callback ||
            context && context !== handler.context
    ) {
      // Radio.debugLog('Attempted to remove the unregistered request', name, this.channelName);
      return;
    }

    delete requests[key];
  });

  return requests;
};

export default {

  // Set up a handler for a request
  reply(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);

    this._rdRequests = reduce(eventArgs, replyReducer.bind(this, false), this._rdRequests || {});

    return this;
  },

  // Set up a handler that can only be requested once
  replyOnce(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);

    this._rdRequests = reduce(eventArgs, replyReducer.bind(this, true), this._rdRequests || {});

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
    this._rdRequests = reduce(eventArgs, stopReducer.bind(this), this._rdRequests || {});

    return this;
  },

  // Make a request
  request(name, ...args) {
    if (name && typeof name === 'object') {
      return reduce(keys(name), (replies, key) => {
        const result = this.request(key, name[key]);
        eventSplitter.test(key) ? extend(replies, result) : replies[key] = result;
        return replies;
      }, {});
    }

    if (name && eventSplitter.test(name)) {
      return reduce(name.split(eventSplitter), (replies, n) => {
        replies[n] = this.request(n, ...args);
        return replies;
      }, {});
    }

    // const channelName = this.channelName;
    const requests = this._rdRequests;

    // // Check if we should log the request, and if so, do it
    // if (channelName && this._tunedIn) {
    //   Radio.log.apply(this, [channelName, name].concat(args));
    // }

    // If the request isn't handled, log it in DEBUG mode and exit
    if (requests && (requests[name] || requests.default)) {
      const handler = requests[name] || requests.default;
      args = requests[name] ? args : arguments;
      return callHandler(handler.callback, handler.context, args);
    }

    // Radio.debugLog('An unhandled request was fired', name, channelName);
  },
};
