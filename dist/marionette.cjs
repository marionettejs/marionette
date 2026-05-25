'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var underscore = require('underscore');

//Internal utility for creating context style global utils
const proxy = function (method) {
  return function (context, ...args) {
    return method.apply(context, args);
  };
};

// Marionette.extend

function extend (protoProps, staticProps) {
  const parent = this;
  let child; // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.

  if (protoProps && underscore.has(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function () {
      return parent.apply(this, arguments);
    };
  } // Add static properties to the constructor function, if supplied.


  underscore.extend(child, parent, staticProps); // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function and add the prototype properties.

  child.prototype = underscore.create(parent.prototype, protoProps);
  child.prototype.constructor = child; // Set a convenience property in case the parent's prototype is needed
  // later.

  child.__super__ = parent.prototype;
  return child;
}

var version = "5.0.0-alpha.2";

// ----------------------
// Pass in a mapping of events => functions or function names
// and return a mapping of events => functions

const normalizeMethods = function (hash) {
  if (!hash) {
    return;
  }

  return underscore.reduce(hash, (normalizedHash, method, name) => {
    if (!underscore.isFunction(method)) {
      method = this[method];
    }

    if (method) {
      normalizedHash[name] = method;
    }

    return normalizedHash;
  }, {});
};

// Error
const errorProps = ['description', 'fileName', 'lineNumber', 'name', 'message', 'number', 'url'];
const MarionetteError = extend.call(Error, {
  urlRoot: `http://marionettejs.com/docs/v${version}/`,
  url: '',
  // Long-form on purpose: method shorthand produces a non-constructor function,
  // which makes `new MarionetteError(...)` throw at runtime.
  // eslint-disable-next-line object-shorthand
  constructor: function (options) {
    const error = Error.call(this, options.message);

    underscore.extend(this, underscore.pick(error, errorProps), underscore.pick(options, errorProps));

    if (Error.captureStackTrace) {
      this.captureStackTrace();
    }

    this.url = this.urlRoot + this.url;
  },

  captureStackTrace() {
    Error.captureStackTrace(this, MarionetteError);
  },

  toString() {
    return `${this.name}: ${this.message} See: ${this.url}`;
  }

});

// Bind Entity Events & Unbind Entity Events

function normalizeBindings(context, bindings) {
  if (!underscore.isObject(bindings)) {
    throw new MarionetteError({
      message: 'Bindings must be an object.',
      url: 'common.html#bindevents'
    });
  }

  return normalizeMethods.call(context, bindings);
}

function bindEvents(entity, bindings) {
  if (!entity || !bindings) {
    return this;
  }

  this.listenTo(entity, normalizeBindings(this, bindings));
  return this;
}

function unbindEvents(entity, bindings) {
  if (!entity) {
    return this;
  }

  if (!bindings) {
    this.stopListening(entity);
    return this;
  }

  this.stopListening(entity, normalizeBindings(this, bindings));
  return this;
} // Export Public API

// Bind/Unbind Radio Requests

function normalizeBindings$1(context, bindings) {
  if (!underscore.isObject(bindings)) {
    throw new MarionetteError({
      message: 'Bindings must be an object.',
      url: 'common.html#bindrequests'
    });
  }

  return normalizeMethods.call(context, bindings);
}

function bindRequests(channel, bindings) {
  if (!channel || !bindings) {
    return this;
  }

  channel.reply(normalizeBindings$1(this, bindings), this);
  return this;
}

function unbindRequests(channel, bindings) {
  if (!channel) {
    return this;
  }

  if (!bindings) {
    channel.stopReplying(null, null, this);
    return this;
  }

  channel.stopReplying(normalizeBindings$1(this, bindings));
  return this;
}

// Marionette.getOption
// --------------------
// Retrieve an object, function or other value from the
// object or its `options`, with `options` taking precedence.
const getOption = function (optionName) {
  if (!optionName) {
    return;
  }

  if (this.options && this.options[optionName] !== undefined) {
    return this.options[optionName];
  } else {
    return this[optionName];
  }
};

const mergeOptions = function (options, keys) {
  if (!options) {
    return;
  }

  underscore.each(keys, key => {
    const option = options[key];

    if (option !== undefined) {
      this[key] = option;
    }
  });
};

// DOM Refresh

function triggerMethodChildren(view, event, shouldTrigger) {
  if (!view._getImmediateChildren) {
    return;
  }

  underscore.each(view._getImmediateChildren(), child => {
    if (!shouldTrigger(child)) {
      return;
    }

    child.triggerMethod(event, child);
  });
}

function shouldTriggerAttach(view) {
  return !view._isAttached;
}

function shouldAttach(view) {
  if (!shouldTriggerAttach(view)) {
    return false;
  }

  view._isAttached = true;
  return true;
}

function shouldTriggerDetach(view) {
  return view._isAttached;
}

function shouldDetach(view) {
  view._isAttached = false;
  return true;
}

function triggerDOMRefresh(view) {
  if (view._isAttached && view._isRendered) {
    view.triggerMethod('dom:refresh', view);
  }
}

function triggerDOMRemove(view) {
  if (view._isAttached && view._isRendered) {
    view.triggerMethod('dom:remove', view);
  }
}

function handleBeforeAttach() {
  triggerMethodChildren(this, 'before:attach', shouldTriggerAttach);
}

function handleAttach() {
  triggerMethodChildren(this, 'attach', shouldAttach);
  triggerDOMRefresh(this);
}

function handleBeforeDetach() {
  triggerMethodChildren(this, 'before:detach', shouldTriggerDetach);
  triggerDOMRemove(this);
}

function handleDetach() {
  triggerMethodChildren(this, 'detach', shouldDetach);
}

function handleBeforeRender() {
  triggerDOMRemove(this);
}

function handleRender() {
  triggerDOMRefresh(this);
} // Monitor a view's state, propagating attach/detach events to children and firing dom:refresh
// whenever a rendered view is attached or an attached view is rendered.


function monitorViewEvents(view) {
  if (view._areViewEventsMonitored || view.monitorViewEvents === false) {
    return;
  }

  view._areViewEventsMonitored = true;
  view.on({
    'before:attach': handleBeforeAttach,
    'attach': handleAttach,
    'before:detach': handleBeforeDetach,
    'detach': handleDetach,
    'before:render': handleBeforeRender,
    'render': handleRender
  });
}

// Trigger Method

const splitter = /(^|:)(\w)/gi; // Only calc getOnMethodName once

const methodCache = {}; // take the event section ("section1:section2:section3")
// and turn it in to uppercase name onSection1Section2Section3

function getEventName(match, prefix, eventName) {
  return eventName.toUpperCase();
}

const getOnMethodName = function (event) {
  if (!methodCache[event]) {
    methodCache[event] = 'on' + event.replace(splitter, getEventName);
  }

  return methodCache[event];
}; // Trigger an event and/or a corresponding method name. Examples:
//
// `this.triggerMethod("foo")` will trigger the "foo" event and
// call the "onFoo" method.
//
// `this.triggerMethod("foo:bar")` will trigger the "foo:bar" event and
// call the "onFooBar" method.


function triggerMethod(event, ...args) {
  // get the method name from the event name
  const methodName = getOnMethodName(event);
  const method = getOption.call(this, methodName);
  let result; // call the onMethodName if it exists

  if (underscore.isFunction(method)) {
    // pass all args, except the event name
    result = method.apply(this, args);
  } // trigger the event


  this.trigger.apply(this, arguments);
  return result;
}

const eventSplitter = /\s+/; // Iterates over the standard `event, callback` (as well as the fancy multiple
// space-separated events `"change blur", callback` and jQuery-style event
// maps `{event: callback}`).

function buildEventArgs(name, callback, context, listener) {
  if (name && typeof name === 'object') {
    return underscore.reduce(underscore.keys(name), (eventArgs, key) => {
      return eventArgs.concat(buildEventArgs(key, name[key], context || callback, listener));
    }, []);
  }

  if (name && eventSplitter.test(name)) {
    return underscore.reduce(name.split(eventSplitter), (eventArgs, n) => {
      eventArgs.push({
        name: n,
        callback,
        context,
        listener
      });
      return eventArgs;
    }, []);
  }

  return [{
    name,
    callback,
    context,
    listener
  }];
}

// An optimized way to execute callbacks.
function callHandler(callback, context, args = []) {
  switch (args.length) {
    case 0:
      return callback.call(context);

    case 1:
      return callback.call(context, args[0]);

    case 2:
      return callback.call(context, args[0], args[1]);

    case 3:
      return callback.call(context, args[0], args[1], args[2]);

    default:
      return callback.apply(context, args);
  }
}

// `offCallback` unbinds the `onceWrapper` after it has been called.

function onceWrap(callback, offCallback) {
  const onceCallback = underscore.once(function () {
    offCallback(onceCallback);
    return callback.apply(this, arguments);
  });
  onceCallback._callback = callback;
  return onceCallback;
}

// a custom event channel. You may bind a callback to an event with `on` or
// remove with `off`; `trigger`-ing an event fires all callbacks in
// succession.
//
//     var object = {};
//     _.extend(object, Events);
//     object.on('expand', function(){ alert('expanded'); });
//     object.trigger('expand');
//
// The reducing API that adds a callback to the `events` object.

const onApi = function ({
  events,
  name,
  callback,
  context,
  ctx,
  listener
}) {
  const handlers = events[name] || (events[name] = []);
  handlers.push({
    callback,
    context,
    ctx: context || ctx,
    listener
  });
  return events;
};

const onReducer = function (events, {
  name,
  callback,
  context
}) {
  if (!callback) {
    return events;
  }

  return onApi({
    events,
    name,
    callback,
    context,
    ctx: this
  });
};

const onceReducer = function (events, {
  name,
  callback,
  context
}) {
  if (!callback) {
    return events;
  }

  const onceCallback = onceWrap(callback, this.off.bind(this, name));
  return onApi({
    events,
    name,
    callback: onceCallback,
    context,
    ctx: this
  });
};

const cleanupListener = function ({
  obj,
  listeneeId,
  listenerId,
  listeningTo
}) {
  delete listeningTo[listeneeId];
  delete obj._rdListeners[listenerId];
}; // The reducing API that removes a callback from the `events` object.


const offReducer = function (events, {
  name,
  callback,
  context
}) {
  const names = name ? [name] : underscore.keys(events);
  underscore.each(names, key => {
    const handlers = events[key]; // Bail out if there are no events stored.

    if (!handlers) {
      return;
    } // Find any remaining events.


    events[key] = underscore.reduce(handlers, (remaining, handler) => {
      if (callback && callback !== handler.callback && callback !== handler.callback._callback || context && context !== handler.context) {
        remaining.push(handler);
        return remaining;
      } // If not including event, clean up any related listener


      if (handler.listener) {
        const listener = handler.listener;
        listener.count--;

        if (!listener.count) {
          cleanupListener(listener);
        }
      }

      return remaining;
    }, []);

    if (!events[key].length) {
      delete events[key];
    }
  });
  return events;
};

const getListener = function (obj, listenerObj) {
  const listeneeId = obj._rdListenId || (obj._rdListenId = underscore.uniqueId('l'));
  obj._rdEvents = obj._rdEvents || {};
  const listeningTo = listenerObj._rdListeningTo || (listenerObj._rdListeningTo = {});
  const listener = listeningTo[listeneeId]; // This listenerObj is not listening to any other events on `obj` yet.
  // Setup the necessary references to track the listening callbacks.

  if (!listener) {
    const listenerId = listenerObj._rdListenId || (listenerObj._rdListenId = underscore.uniqueId('l'));
    listeningTo[listeneeId] = {
      obj,
      listeneeId,
      listenerId,
      listeningTo,
      count: 0
    };
    return listeningTo[listeneeId];
  }

  return listener;
};

const listenToApi = function ({
  name,
  callback,
  context,
  listener
}) {
  if (!callback) {
    return;
  }

  const {
    obj,
    listenerId
  } = listener;
  const listeners = obj._rdListeners || (obj._rdListeners = {});
  obj._rdEvents = onApi({
    events: obj._rdEvents,
    name,
    callback,
    context,
    listener
  });
  listeners[listenerId] = listener;
  listener.count++; // Call `on` for interop

  obj.on(name, callback, context, {
    _rdInternal: true
  });
};

const listenToOnceApi = function ({
  name,
  callback,
  context,
  listener
}) {
  if (!callback) {
    return;
  }

  const offCallback = this.stopListening.bind(this, listener.obj, name);
  const onceCallback = onceWrap(callback, offCallback);
  listenToApi({
    name,
    callback: onceCallback,
    context,
    listener
  });
}; // Handles triggering the appropriate event callbacks.


const triggerApi = function ({
  events,
  name,
  args
}) {
  const objEvents = events[name];
  const allEvents = objEvents && events.all ? events.all.slice() : events.all;

  if (objEvents) {
    triggerEvents(objEvents, args);
  }

  if (allEvents) {
    triggerEvents(allEvents, [name].concat(args));
  }
};

const triggerEvents = function (events, args) {
  underscore.each(events, ({
    callback,
    ctx
  }) => {
    callHandler(callback, ctx, args);
  });
};

var Events = {
  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  on(name, callback, context, opts) {
    if (opts && opts._rdInternal) {
      return;
    }

    const eventArgs = buildEventArgs(name, callback, context);
    this._rdEvents = underscore.reduce(eventArgs, onReducer.bind(this), this._rdEvents || {});
    return this;
  },

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  off(name, callback, context, opts) {
    if (!this._rdEvents) {
      return this;
    }

    if (opts && opts._rdInternal) {
      return;
    } // Delete all event listeners and "drop" events.


    if (!name && !context && !callback) {
      this._rdEvents = void 0;
      const listeners = this._rdListeners;
      underscore.each(underscore.keys(listeners), listenerId => {
        cleanupListener(listeners[listenerId]);
      });
      return this;
    }

    const eventArgs = buildEventArgs(name, callback, context);
    this._rdEvents = underscore.reduce(eventArgs, offReducer, this._rdEvents);
    return this;
  },

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  once(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);
    this._rdEvents = underscore.reduce(eventArgs, onceReducer.bind(this), this._rdEvents || {});
    return this;
  },

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  listenTo(obj, name, callback) {
    if (!obj) {
      return this;
    }

    const listener = getListener(obj, this);
    const eventArgs = buildEventArgs(name, callback, this, listener);
    underscore.each(eventArgs, listenToApi);
    return this;
  },

  // Inversion-of-control versions of `once`.
  listenToOnce(obj, name, callback) {
    if (!obj) {
      return this;
    }

    const listener = getListener(obj, this);
    const eventArgs = buildEventArgs(name, callback, this, listener);
    underscore.each(eventArgs, listenToOnceApi.bind(this));
    return this;
  },

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  stopListening(obj, name, callback) {
    const listeningTo = this._rdListeningTo;

    if (!listeningTo) {
      return this;
    }

    const eventArgs = buildEventArgs(name, callback, this);
    const listenerIds = obj ? [obj._rdListenId] : underscore.keys(listeningTo);

    for (let i = 0; i < listenerIds.length; i++) {
      const listener = listeningTo[listenerIds[i]]; // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.

      if (!listener) {
        break;
      }

      underscore.each(eventArgs, args => {
        const listenToObj = listener.obj;
        const events = listenToObj._rdEvents;

        if (!events) {
          return;
        }

        listenToObj._rdEvents = offReducer(events, args); // Call `off` for interop

        listenToObj.off(args.name, args.callback, this, {
          _rdInternal: true
        });
      });
    }

    return this;
  },

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  trigger(name, ...args) {
    if (!this._rdEvents) {
      return this;
    }

    if (name && typeof name === 'object') {
      underscore.each(underscore.keys(name), key => {
        triggerApi({
          events: this._rdEvents,
          name: key,
          args: [name[key]]
        });
      });
      return this;
    }

    if (name && eventSplitter.test(name)) {
      underscore.each(name.split(eventSplitter), n => {
        triggerApi({
          events: this._rdEvents,
          name: n,
          args
        });
      });
      return this;
    }

    triggerApi({
      events: this._rdEvents,
      name,
      args
    });
    return this;
  },

  triggerMethod
};

// Whether or not we're in debug mode or not. debug mode helps you
// get around the issues of lack of warnings when events are mis-typed.
let shouldDebug = false;

function setDebug(setShouldDebug = true) {
  shouldDebug = setShouldDebug;
} // Format debug text.


function debugText(warning, eventName, channelName) {
  return warning + (channelName ? ` on the ${channelName} channel` : '') + `: "${eventName}"`;
} // This is the method that's called when an unregistered event was called.
// By default, it logs warning to the console. By overriding this you could
// make it throw an Error, for instance. This would make firing a nonexistent event
// have the same consequence as firing a nonexistent method on an Object.


function debugLog(warning, eventName, channelName) {
  if (shouldDebug && console && console.warn) {
    console.warn(debugText(warning, eventName, channelName));
  }
} // Log information about the channel and event


function log(channelName, eventName, ...args) {
  if (typeof console === 'undefined') {
    return;
  }

  console.log(`[${channelName}] "${eventName}"`, args);
}

// If callback is not a function return the callback and flag it for removal
function makeCallback(callback) {
  if (typeof callback === 'function') {
    return callback;
  }

  const result = function () {
    return callback;
  };

  result._callback = callback;
  return result;
}

/*
 * Requests
 * -----------------------
 * A messaging system for requesting data.
 *
 */

const replyReducer = function (isOnce, requests, {
  name,
  callback,
  context
}) {
  if (requests[name]) {
    debugLog('A request was overwritten', name, this.channelName);
  }

  requests[name] = {
    callback: isOnce ? onceWrap(makeCallback(callback), this.stopReplying.bind(this, name)) : makeCallback(callback),
    context: context || this
  };
  return requests;
};

const stopReducer = function (requests, {
  name,
  callback,
  context
}) {
  const names = name ? [name] : underscore.keys(requests);
  underscore.each(names, key => {
    const handler = requests[key]; // Bail out if there are no events stored.

    if (!handler || callback && callback !== handler.callback && callback !== handler.callback._callback || context && context !== handler.context) {
      // Radio.debugLog('Attempted to remove the unregistered request', name, this.channelName);
      return;
    }

    delete requests[key];
  });
  return requests;
};

var Requests = {
  // Set up a handler for a request
  reply(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);
    this._rdRequests = underscore.reduce(eventArgs, replyReducer.bind(this, false), this._rdRequests || {});
    return this;
  },

  // Set up a handler that can only be requested once
  replyOnce(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);
    this._rdRequests = underscore.reduce(eventArgs, replyReducer.bind(this, true), this._rdRequests || {});
    return this;
  },

  // Remove handler(s)
  stopReplying(name, callback, context) {
    if (!this._rdRequests) {
      return this;
    }

    if (!name && !callback && !context) {
      delete this._rdRequests;
      return this;
    }

    const eventArgs = buildEventArgs(name, callback, context);
    this._rdRequests = underscore.reduce(eventArgs, stopReducer.bind(this), this._rdRequests || {});
    return this;
  },

  // Make a request
  request(name, ...args) {
    if (name && typeof name === 'object') {
      return underscore.reduce(underscore.keys(name), (replies, key) => {
        const result = this.request(key, name[key]);
        eventSplitter.test(key) ? underscore.extend(replies, result) : replies[key] = result;
        return replies;
      }, {});
    }

    if (name && eventSplitter.test(name)) {
      return underscore.reduce(name.split(eventSplitter), (replies, n) => {
        replies[n] = this.request(n, ...args);
        return replies;
      }, {});
    }

    const channelName = this.channelName;
    const requests = this._rdRequests; // // Check if we should log the request, and if so, do it

    if (channelName && this._tunedIn) {
      log.apply(this, [channelName, name].concat(args));
    } // If the request isn't handled, log it in DEBUG mode and exit


    if (requests && (requests[name] || requests.default)) {
      const handler = requests[name] || requests.default;
      args = requests[name] ? args : arguments;
      return callHandler(handler.callback, handler.context, args);
    }

    debugLog('An unhandled request was fired', name, channelName);
  }

};

const CommonMixin = {
  // This is a noop method intended to be overridden
  initialize() {},

  // Imports the "normalizeMethods" to transform hashes of
  // events=>function references/names to a hash of events=>function references
  normalizeMethods,

  _setOptions(options, classOptions) {
    this.options = underscore.extend({}, underscore.result(this, 'options'), options);
    this.mergeOptions(options, classOptions);
  },

  // A handy way to merge passed-in options onto the instance
  mergeOptions,
  // Enable getting options from this or this.options by name.
  getOption,
  // Enable binding view's events from another entity.
  bindEvents,
  // Enable unbinding view's events from another entity.
  unbindEvents,
  // Enable binding view's requests.
  bindRequests,
  // Enable unbinding view's requests.
  unbindRequests,
  triggerMethod
};
underscore.extend(CommonMixin, Events, Requests);

var DestroyMixin = {
  _isDestroyed: false,

  isDestroyed() {
    return this._isDestroyed;
  },

  destroy(options) {
    if (this._isDestroyed) {
      return this;
    }

    this.triggerMethod('before:destroy', this, options);
    this._isDestroyed = true;
    this.triggerMethod('destroy', this, options);
    this.stopListening();
    return this;
  }

};

const _logs = {}; // This is to produce an identical function in both tuneIn and tuneOut,
// so that Events unregisters it.

function _partial(channelName) {
  return _logs[channelName] || (_logs[channelName] = log.bind(Radio, channelName));
}

const Radio = {};
underscore.extend(Radio, {
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

Radio._channels = {};

Radio.channel = function (channelName) {
  if (!channelName) {
    throw new Error('You must provide a name for the channel.');
  }

  if (Radio._channels[channelName]) {
    return Radio._channels[channelName];
  }

  return Radio._channels[channelName] = new Radio.Channel(channelName);
};
/*
 * Radio.Channel
 * ----------------------
 * A Channel is an object that extends from Events,
 * and Radio.Requests.
 *
 */


Radio.Channel = function (channelName) {
  this.channelName = channelName;
};

underscore.extend(Radio.Channel.prototype, Events, Requests, {
  // Remove all handlers from the messaging systems of this channel
  reset() {
    this.off();
    this.stopListening();
    this.stopReplying();
    return this;
  }

});
/*
 * Top-level API
 * -------------
 * Supplies the 'top-level API' for working with Channels directly
 * from Radio.
 *
 */

underscore.each([Events, Requests], system => {
  underscore.each(underscore.keys(system), methodName => {
    Radio[methodName] = function (channelName, ...args) {
      const channel = this.channel(channelName);
      return callHandler(channel[methodName], channel, args);
    };
  });
});

Radio.reset = function (channelName) {
  const channels = !channelName ? this._channels : [this._channels[channelName]];
  underscore.each(channels, channel => {
    channel.reset();
  });
};

// - channelName
// - radioEvents
// - radioRequests

var RadioMixin = {
  _initRadio() {
    const channelName = underscore.result(this, 'channelName');

    if (!channelName) {
      return;
    }

    const channel = this._channel = Radio.channel(channelName);
    const radioEvents = underscore.result(this, 'radioEvents');
    this.bindEvents(channel, radioEvents);
    const radioRequests = underscore.result(this, 'radioRequests');
    this.bindRequests(channel, radioRequests);
    this.on('destroy', this._destroyRadio);
  },

  _destroyRadio() {
    this._channel.stopReplying(null, null, this);
  },

  getChannel() {
    return this._channel;
  }

};

// Object
const ClassOptions = ['channelName', 'radioEvents', 'radioRequests']; // Object borrows many conventions and utilities from Backbone.

const MarionetteObject = function (options) {
  this._setOptions(options, ClassOptions);

  this.cid = underscore.uniqueId(this.cidPrefix);

  this._initRadio();

  this.initialize.apply(this, arguments);
};

MarionetteObject.extend = extend; // Object Methods
// --------------

underscore.extend(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, {
  cidPrefix: 'mno'
});

// - behaviors
// Takes care of getting the behavior class
// given options and a key.
// If a user passes in options.behaviorClass
// default to using that.
// If a user passes in a Behavior Class directly, use that
// Otherwise an error is thrown

function getBehaviorClass(options) {
  if (options.behaviorClass) {
    return {
      BehaviorClass: options.behaviorClass,
      options
    };
  } //treat functions as a Behavior constructor


  if (underscore.isFunction(options)) {
    return {
      BehaviorClass: options,
      options: {}
    };
  }

  throw new MarionetteError({
    message: 'Unable to get behavior class. A Behavior constructor should be passed directly or as behaviorClass property of options',
    url: 'marionette.behavior.html#defining-and-attaching-behaviors'
  });
} // Iterate over the behaviors object, for each behavior
// instantiate it and get its grouped behaviors.
// This accepts a list of behaviors in either an object or array form


function parseBehaviors(view, behaviors, allBehaviors) {
  return underscore.reduce(behaviors, (reducedBehaviors, behaviorDefiniton) => {
    const {
      BehaviorClass,
      options
    } = getBehaviorClass(behaviorDefiniton);
    const behavior = new BehaviorClass(options, view);
    reducedBehaviors.push(behavior);
    return parseBehaviors(view, underscore.result(behavior, 'behaviors'), reducedBehaviors);
  }, allBehaviors);
}

var BehaviorsMixin = {
  _initBehaviors() {
    this._behaviors = parseBehaviors(this, underscore.result(this, 'behaviors'), []);
  },

  _getBehaviorTriggers() {
    const triggers = underscore.map(this._behaviors, behavior => behavior._getTriggers());
    return underscore.reduce(triggers, function (memo, _triggers) {
      return underscore.extend(memo, _triggers);
    }, {});
  },

  _getBehaviorEvents() {
    const events = underscore.map(this._behaviors, behavior => behavior._getEvents());
    return underscore.reduce(events, function (memo, _events) {
      return underscore.extend(memo, _events);
    }, {});
  },

  // proxy behavior el to the view's el.
  _setBehaviorElements() {
    underscore.map(this._behaviors, behavior => behavior.setElement());
  },

  // delegate modelEvents and collectionEvents
  _delegateBehaviorEntityEvents() {
    underscore.map(this._behaviors, behavior => behavior.delegateEntityEvents());
  },

  // undelegate modelEvents and collectionEvents
  _undelegateBehaviorEntityEvents() {
    underscore.map(this._behaviors, behavior => behavior.undelegateEntityEvents());
  },

  _destroyBehaviors(options) {
    // Call destroy on each behavior after
    // destroying the view.
    // This unbinds event listeners
    // that behaviors have registered for.
    underscore.map(this._behaviors, behavior => behavior.destroy(options));
  },

  // Remove a behavior
  _removeBehavior(behavior) {
    // Don't worry about the clean up if the view is destroyed
    if (this._isDestroyed) {
      return;
    }

    this._behaviors = underscore.without(this._behaviors, behavior);
  },

  _bindBehaviorUIElements() {
    underscore.map(this._behaviors, behavior => behavior.bindUIElements());
  },

  _unbindBehaviorUIElements() {
    underscore.map(this._behaviors, behavior => behavior.unbindUIElements());
  },

  _triggerEventOnBehaviors(eventName, view, options) {
    underscore.map(this._behaviors, behavior => behavior.triggerMethod(eventName, view, options));
  }

};

// - collectionEvents
// - modelEvents

var DelegateEntityEventsMixin = {
  // Handle `modelEvents`, and `collectionEvents` configuration
  _delegateEntityEvents(model, collection) {
    if (model) {
      this._modelEvents = underscore.result(this, 'modelEvents');
      this.bindEvents(model, this._modelEvents);
    }

    if (collection) {
      this._collectionEvents = underscore.result(this, 'collectionEvents');
      this.bindEvents(collection, this._collectionEvents);
    }
  },

  // Remove any previously delegate entity events
  _undelegateEntityEvents(model, collection) {
    if (this._modelEvents) {
      this.unbindEvents(model, this._modelEvents);
      delete this._modelEvents;
    }

    if (this._collectionEvents) {
      this.unbindEvents(collection, this._collectionEvents);
      delete this._collectionEvents;
    }
  },

  // Remove cached event handlers
  _deleteEntityEventHandlers() {
    delete this._modelEvents;
    delete this._collectionEvents;
  }

};

// - template
// - templateContext

var TemplateRenderMixin = {
  // Internal method to render the template with the serialized data
  // and template context
  _renderTemplate(template) {
    // Add in entity data and template context
    const data = this.mixinTemplateContext(this.serializeData()) || {}; // Render and add to el

    const html = this._renderHtml(template, data);

    if (typeof html !== 'undefined') {
      this.attachElContent(html);
    }
  },

  // Get the template for this view instance.
  // You can set a `template` attribute in the view definition
  // or pass a `template: TemplateFunction` parameter in
  // to the constructor options.
  getTemplate() {
    return this.template;
  },

  // Mix in template context methods. Looks for a
  // `templateContext` attribute, which can either be an
  // object literal, or a function that returns an object
  // literal. All methods and attributes from this object
  // are copies to the object passed in.
  mixinTemplateContext(serializedData) {
    const templateContext = underscore.result(this, 'templateContext');

    if (!templateContext) {
      return serializedData;
    }

    if (!serializedData) {
      return templateContext;
    }

    return underscore.extend({}, serializedData, templateContext);
  },

  // Serialize the view's model *or* collection, if
  // it exists, for the template
  serializeData() {
    // If we have a model, we serialize that
    if (this.model) {
      return this.serializeModel();
    } // Otherwise, we serialize the collection,
    // making it available under the `items` property


    if (this.collection) {
      return {
        items: this.serializeCollection()
      };
    }
  },

  // Prepares the special `model` property of a view
  // for being displayed in the template. Override this if
  // you need a custom transformation for your view's model
  serializeModel() {
    return this.model.attributes;
  },

  // Serialize a collection
  serializeCollection() {
    return underscore.map(this.collection.models, model => model.attributes);
  },

  // Renders the data into the template
  _renderHtml(template, data) {
    return template(data);
  },

  // Attaches the content of a given view.
  // This method can be overridden to optimize rendering,
  // or to render in a non standard way.
  //
  // For example, using `innerHTML` instead of `$el.html`
  //
  // ```js
  // attachElContent(html) {
  //   this.el.innerHTML = html;
  // }
  // ```
  attachElContent(html) {
    this.Dom.setContents(this.el, html);
  }

};

// a given key for triggers and events
// swaps the @ui with the associated selector.
// Returns a new, non-mutated, parsed events hash.

const normalizeUIKeys = function (hash, ui) {
  return underscore.reduce(hash, (memo, val, key) => {
    const normalizedKey = normalizeUIString(key, ui);
    memo[normalizedKey] = val;
    return memo;
  }, {});
};

const uiRegEx = /@ui\.[a-zA-Z-_$0-9]*/g; // utility method for parsing @ui. syntax strings
// into associated selector

const normalizeUIString = function (uiString, ui) {
  return uiString.replace(uiRegEx, r => {
    return ui[r.slice(4)];
  });
}; // allows for the use of the @ui. syntax within
// a given value for regions
// swaps the @ui with the associated selector


const normalizeUIValues = function (hash, ui, property) {
  underscore.each(hash, (val, key) => {
    if (underscore.isString(val)) {
      hash[key] = normalizeUIString(val, ui);
    } else if (val) {
      const propertyVal = val[property];

      if (underscore.isString(propertyVal)) {
        val[property] = normalizeUIString(propertyVal, ui);
      }
    }
  });
  return hash;
};

var UIMixin = {
  // normalize the keys of passed hash with the views `ui` selectors.
  // `{"@ui.foo": "bar"}`
  normalizeUIKeys(hash, uiBindings = this._getUIBindings()) {
    return normalizeUIKeys(hash, uiBindings);
  },

  // normalize the passed string with the views `ui` selectors.
  // `"@ui.bar"`
  normalizeUIString(uiString, uiBindings = this._getUIBindings()) {
    return normalizeUIString(uiString, uiBindings);
  },

  // normalize the values of passed hash with the views `ui` selectors.
  // `{foo: "@ui.bar"}`
  normalizeUIValues(hash, property, uiBindings = this._getUIBindings()) {
    return normalizeUIValues(hash, uiBindings, property);
  },

  _getUIBindings() {
    const uiBindings = underscore.result(this, '_uiBindings');
    return uiBindings || underscore.result(this, 'ui');
  },

  // This method binds the elements specified in the "ui" hash inside the view's code with
  // the associated jQuery selectors.
  _bindUIElements() {
    if (!this.ui) {
      return;
    } // store the ui hash in _uiBindings so they can be reset later
    // and so re-rendering the view will be able to find the bindings


    if (!this._uiBindings) {
      this._uiBindings = this.ui;
    } // get the bindings result, as a function or otherwise


    const bindings = underscore.result(this, '_uiBindings'); // empty the ui so we don't have anything to start with

    this._ui = {}; // bind each of the selectors

    underscore.each(bindings, (selector, key) => {
      this._ui[key] = this.$(selector);
    });
    this.ui = this._ui;
  },

  _unbindUIElements() {
    if (!this.ui || !this._uiBindings) {
      return;
    } // delete all of the existing ui bindings


    underscore.each(this.ui, ($el, name) => {
      delete this.ui[name];
    }); // reset the ui element to the original bindings configuration

    this.ui = this._uiBindings;
    delete this._uiBindings;
    delete this._ui;
  },

  _getUI(name) {
    return this._ui[name];
  }

};

// Add Feature flags here
// e.g. 'class' => false
const FEATURES = {
  childViewEventPrefix: false,
  triggersStopPropagation: true,
  triggersPreventDefault: true,
  DEV_MODE: false
};

function isEnabled(name) {
  return !!FEATURES[name];
}

function setEnabled(name, state) {
  return FEATURES[name] = state;
}

// Event Delegator

function setEventDelegator(mixin) {
  this.prototype.EventDelegator = underscore.extend({}, this.prototype.EventDelegator, mixin);
  return this;
}
var EventDelegator = {
  shouldCapture(eventName) {
    return ['focus', 'blur'].indexOf(eventName) !== -1;
  },

  // this.$el.on(eventName + '.delegateEvents' + this.cid, selector, handler);
  delegate({
    eventName,
    selector,
    handler,
    events,
    rootEl
  }) {
    const shouldCapture = this.shouldCapture(eventName);

    if (selector) {
      const delegateHandler = function (evt) {
        let node = evt.target;

        for (; node && node !== rootEl; node = node.parentNode) {
          if (node.nodeType === 1 && node.matches(selector)) {
            evt.delegateTarget = node;
            handler(evt);
            break;
          }
        }
      };

      events.push({
        eventName,
        handler: delegateHandler
      });
      rootEl.addEventListener(eventName, delegateHandler, shouldCapture);
      return;
    }

    events.push({
      eventName,
      handler
    });
    rootEl.addEventListener(eventName, handler, shouldCapture);
  },

  // this.$el.off('.delegateEvents' + this.cid);
  undelegateAll({
    events,
    rootEl
  }) {
    if (!rootEl) {
      return;
    }

    underscore.each(events, ({
      eventName,
      handler
    }) => {
      const shouldCapture = this.shouldCapture(eventName);
      rootEl.removeEventListener(eventName, handler, shouldCapture);
    });
    events.length = 0;
  }

};

const delegateEventSplitter = /^(\S+)\s*(.*)$/; // Internal method to create an event handler for a given `triggerDef` like
// 'click:foo'

function buildViewTrigger(view, triggerDef) {
  if (underscore.isString(triggerDef)) {
    triggerDef = {
      event: triggerDef
    };
  }

  const eventName = triggerDef.event;
  let shouldPreventDefault = !!triggerDef.preventDefault;

  if (isEnabled('triggersPreventDefault')) {
    shouldPreventDefault = triggerDef.preventDefault !== false;
  }

  let shouldStopPropagation = !!triggerDef.stopPropagation;

  if (isEnabled('triggersStopPropagation')) {
    shouldStopPropagation = triggerDef.stopPropagation !== false;
  }

  return function (event, ...args) {
    if (shouldPreventDefault) {
      event.preventDefault();
    }

    if (shouldStopPropagation) {
      event.stopPropagation();
    }

    view.triggerMethod(eventName, view, event, ...args);
  };
}

var ViewEventsMixin = {
  EventDelegator,

  _initViewEvents() {
    this._domEvents = [];
  },

  _undelegateViewEvents() {
    this.EventDelegator.undelegateAll({
      events: this._domEvents,
      rootEl: this.el
    });
  },

  _delegateViewEvents(view = this) {
    const uiBindings = this._getUIBindings();

    this._delegateEvents(uiBindings);

    this._delegateTriggers(uiBindings, view);
  },

  _delegateEvents(uiBindings) {
    if (!this.events) {
      return;
    }

    underscore.each(underscore.result(this, 'events'), (handler, key) => {
      if (!underscore.isFunction(handler)) {
        handler = this[handler];
      }

      if (!handler) {
        return;
      }

      this._delegate(handler.bind(this), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegateTriggers(uiBindings, view) {
    if (!this.triggers) {
      return;
    }

    underscore.each(underscore.result(this, 'triggers'), (value, key) => {
      this._delegate(buildViewTrigger(view, value), this.normalizeUIString(key, uiBindings));
    });
  },

  _delegate(handler, key) {
    const match = key.match(delegateEventSplitter);
    this.EventDelegator.delegate({
      eventName: match[1],
      selector: match[2],
      handler,
      events: this._domEvents,
      rootEl: this.el
    });
  }

};

// DomApi

function setDomApi(mixin) {
  this.prototype.Dom = underscore.extend({}, this.prototype.Dom, mixin);
  return this;
}
var DomApi = {
  // Returns a new HTML DOM node of tagName
  createElement(tagName) {
    return document.createElement(tagName);
  },

  // Returns a new HTML DOM node instance
  createBuffer() {
    return document.createDocumentFragment();
  },

  // Returns the document element for a given DOM element
  getDocumentEl(el) {
    return el.ownerDocument.documentElement;
  },

  // Finds the `selector` string with the el
  // Returns an array-like object of nodes
  findEl(el, selector) {
    return el.querySelectorAll(selector);
  },

  // Returns true if the el contains the node childEl
  hasEl(el, childEl) {
    return el.contains(childEl && childEl.parentNode);
  },

  // Detach `el` from the DOM without removing listeners
  detachEl(el) {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  },

  // Remove `oldEl` from the DOM and put `newEl` in its place
  replaceEl(newEl, oldEl) {
    if (newEl === oldEl) {
      return;
    }

    const parent = oldEl.parentNode;

    if (!parent) {
      return;
    }

    parent.replaceChild(newEl, oldEl);
  },

  // Swaps the location of `el1` and `el2` in the DOM
  swapEl(el1, el2) {
    if (el1 === el2) {
      return;
    }

    const parent1 = el1.parentNode;
    const parent2 = el2.parentNode;

    if (!parent1 || !parent2) {
      return;
    }

    const next1 = el1.nextSibling;
    const next2 = el2.nextSibling;
    parent1.insertBefore(el2, next1);
    parent2.insertBefore(el1, next2);
  },

  // Replace the contents of `el` with the `html`
  setContents(el, html) {
    el.innerHTML = html;
  },

  // Sets attributes on a DOM node
  setAttributes(el, attrs) {
    underscore.each(underscore.keys(attrs), attr => {
      attr in el ? el[attr] = attrs[attr] : el.setAttribute(attr, attrs[attr]);
    });
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(el, contents) {
    el.appendChild(contents);
  },

  // Does the el have child nodes
  hasContents(el) {
    return !!el && el.hasChildNodes();
  },

  // Remove the inner contents of `el` from the DOM while leaving
  // `el` itself in the DOM.
  detachContents(el) {
    el.textContent = '';
  }

};

// ViewMixin
const classErrorName = 'ViewError'; // MixinOptions
// - attributes
// - behaviors
// - childViewEventPrefix
// - childViewEvents
// - childViewTriggers
// - className
// - collection
// - collectionEvents
// - el
// - events
// - id
// - model
// - modelEvents
// - tagName
// - triggers
// - ui

const ViewMixin = {
  tagName: 'div',

  // This is a noop method intended to be overridden
  preinitialize() {},

  Dom: DomApi,

  _validateEl(el) {
    if (!underscore.isString(el)) {
      return el;
    }

    throw new MarionetteError({
      name: classErrorName,
      message: `View "el" must be a DOM element. Resolve selector strings at the call site, e.g. \`document.querySelector('${el}')\`. (Region still accepts selector strings.)`,
      url: 'marionette.view.html#specifying-an-el'
    });
  },

  // Create an element from the `id`, `className` and `tagName` properties.
  _getEl() {
    const elOption = underscore.result(this, 'el');

    if (!elOption) {
      const el = this.Dom.createElement(underscore.result(this, 'tagName'));
      const attrs = underscore.extend({}, underscore.result(this, 'attributes'));

      if (this.id) {
        attrs.id = underscore.result(this, 'id');
      }

      if (this.className) {
        attrs.class = underscore.result(this, 'className');
      }

      this.Dom.setAttributes(el, attrs);
      return el;
    }

    return elOption;
  },

  $(selector) {
    return this.Dom.findEl(this.el, selector);
  },

  _isElAttached() {
    return !!this.el && this.Dom.hasEl(this.Dom.getDocumentEl(this.el), this.el);
  },

  supportsRenderLifecycle: true,
  supportsDestroyLifecycle: true,
  _isDestroyed: false,

  isDestroyed() {
    return !!this._isDestroyed;
  },

  _isRendered: false,

  isRendered() {
    return !!this._isRendered;
  },

  _isAttached: false,

  isAttached() {
    return !!this._isAttached;
  },

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents() {
    this._delegateEntityEvents(this.model, this.collection); // bind each behaviors model and collection events


    this._delegateBehaviorEntityEvents();

    return this;
  },

  // Handle unbinding `modelEvents`, and `collectionEvents` configuration
  undelegateEntityEvents() {
    this._undelegateEntityEvents(this.model, this.collection); // unbind each behaviors model and collection events


    this._undelegateBehaviorEntityEvents();

    return this;
  },

  // Handle destroying the view and its children.
  destroy(options) {
    if (this._isDestroyed || this._isDestroying) {
      return this;
    }

    this._isDestroying = true;
    const shouldTriggerDetach = this._isAttached && !this._disableDetachEvents;
    this.triggerMethod('before:destroy', this, options);

    if (shouldTriggerDetach) {
      this.triggerMethod('before:detach', this);
    } // unbind UI elements


    this.unbindUIElements();

    this._undelegateViewEvents(); // remove the view from the DOM


    this.Dom.detachEl(this.el);

    if (shouldTriggerDetach) {
      this._isAttached = false;
      this.triggerMethod('detach', this);
    } // remove children after the remove to prevent extra paints


    this._removeChildren();

    this._isDestroyed = true;
    this._isRendered = false; // Destroy behaviors after _isDestroyed flag

    this._destroyBehaviors(options);

    this._deleteEntityEventHandlers();

    this.triggerMethod('destroy', this, options);

    this._triggerEventOnBehaviors('destroy', this, options);

    this.stopListening();
    return this;
  },

  // This method binds the elements specified in the "ui" hash
  bindUIElements() {
    this._bindUIElements();

    this._bindBehaviorUIElements();

    return this;
  },

  // This method unbinds the elements specified in the "ui" hash
  unbindUIElements() {
    this._unbindUIElements();

    this._unbindBehaviorUIElements();

    return this;
  },

  getUI(name) {
    return this._getUI(name);
  },

  // Cache `childViewEvents` and `childViewTriggers`
  _buildEventProxies() {
    this._childViewEvents = this.normalizeMethods(underscore.result(this, 'childViewEvents'));
    this._childViewTriggers = underscore.result(this, 'childViewTriggers');
    this._eventPrefix = this._getEventPrefix();
  },

  _getEventPrefix() {
    const defaultPrefix = isEnabled('childViewEventPrefix') ? 'childview' : false;
    const prefix = underscore.result(this, 'childViewEventPrefix', defaultPrefix);
    return prefix === false ? prefix : prefix + ':';
  },

  _proxyChildViewEvents(view) {
    if (this._childViewEvents || this._childViewTriggers || this._eventPrefix) {
      this.listenTo(view, 'all', this._childViewEventHandler);
    }
  },

  _childViewEventHandler(eventName, ...args) {
    const childViewEvents = this._childViewEvents; // call collectionView childViewEvent if defined

    if (childViewEvents && childViewEvents[eventName]) {
      childViewEvents[eventName].apply(this, args);
    } // use the parent view's proxyEvent handlers


    const childViewTriggers = this._childViewTriggers; // Call the event with the proxy name on the parent layout

    if (childViewTriggers && childViewTriggers[eventName]) {
      this.triggerMethod(childViewTriggers[eventName], ...args);
    }

    if (this._eventPrefix) {
      this.triggerMethod(this._eventPrefix + eventName, ...args);
    }
  }

};
underscore.extend(ViewMixin, BehaviorsMixin, CommonMixin, DelegateEntityEventsMixin, TemplateRenderMixin, UIMixin, ViewEventsMixin);

function isView(view) {
  return view.render && (view.destroy || view.remove);
}
function isViewClass(ViewClass) {
  return ViewClass.prototype.render && (ViewClass.prototype.destroy || ViewClass.prototype.remove);
}
function renderView(view) {
  if (view._isRendered) {
    return;
  }

  if (!view.supportsRenderLifecycle) {
    view.triggerMethod('before:render', view);
  }

  view.render();
  view._isRendered = true;

  if (!view.supportsRenderLifecycle) {
    view.triggerMethod('render', view);
  }
}
function destroyView(view, disableDetachEvents) {
  if (view.destroy) {
    // Attach flag for public destroy function internal check
    view._disableDetachEvents = disableDetachEvents;
    view.destroy();
    return;
  } // Destroy for non-Marionette Views


  if (!view.supportsDestroyLifecycle) {
    view.triggerMethod('before:destroy', view);
  }

  const shouldTriggerDetach = view._isAttached && !disableDetachEvents;

  if (shouldTriggerDetach) {
    view.triggerMethod('before:detach', view);
  }

  view.remove();

  if (shouldTriggerDetach) {
    view._isAttached = false;
    view.triggerMethod('detach', view);
  }

  view._isDestroyed = true;

  if (!view.supportsDestroyLifecycle) {
    view.triggerMethod('destroy', view);
  }
}

// Region
const classErrorName$1 = 'RegionError';
const ClassOptions$1 = ['allowMissingEl', 'parentEl', 'replaceElement'];

const Region = function (options) {
  this._setOptions(options, ClassOptions$1);

  this.cid = underscore.uniqueId(this.cidPrefix); // getOption necessary because options.el may be passed as undefined

  this._initEl = this.el = this.getOption('el');

  this._validateEl(this.el);

  this.initialize.apply(this, arguments);
};

Region.extend = extend;
Region.setDomApi = setDomApi; // Region Methods
// --------------

underscore.extend(Region.prototype, CommonMixin, {
  Dom: DomApi,
  cidPrefix: 'mnr',
  replaceElement: false,
  _isReplaced: false,
  _isSwappingView: false,

  _validateEl(el) {
    if (!el || underscore.isString(el) || el.nodeType === 1) {
      return;
    }

    throw new MarionetteError({
      name: classErrorName$1,
      message: 'Region "el" must be a selector string or DOM element.',
      url: 'marionette.region.html#additional-options'
    });
  },

  // Displays a view instance inside of the region. If necessary handles calling the `render`
  // method for you. Reads content directly from the `el` attribute.
  show(view, options) {
    if (!this._ensureElement(options)) {
      return;
    }

    view = this._getView(view, options);

    if (view === this.currentView) {
      return this;
    }

    if (view._isShown) {
      throw new MarionetteError({
        name: classErrorName$1,
        message: 'View is already shown in a Region or CollectionView',
        url: 'marionette.region.html#showing-a-view'
      });
    }

    this._isSwappingView = !!this.currentView;
    this.triggerMethod('before:show', this, view, options); // Assume an attached view is already in the region for pre-existing DOM

    if (this.currentView || !view._isAttached) {
      this.empty(options);
    }

    this._setupChildView(view);

    this.currentView = view;
    renderView(view);

    this._attachView(view, options);

    this.triggerMethod('show', this, view, options);
    this._isSwappingView = false;
    return this;
  },

  _setEl(el) {
    this._validateEl(el);

    if (underscore.isObject(el)) {
      this.el = el;
      return;
    }

    if (!el) {
      throw new MarionetteError({
        name: classErrorName$1,
        message: 'An "el" must be specified for a region.',
        url: 'marionette.region.html#additional-options'
      });
    }

    this.el = this.getEl(el);
  },

  // Set the `el` of the region and move any current view to the new `el`.
  _setElement(el) {
    if (el === this.el) {
      return this;
    }

    const shouldReplace = this._isReplaced;

    this._restoreEl();

    this._setEl(el);

    if (this.currentView) {
      const view = this.currentView;

      if (shouldReplace) {
        this._replaceEl(view);
      } else {
        this.attachHtml(view);
      }
    }

    return this;
  },

  _setupChildView(view) {
    monitorViewEvents(view);

    this._proxyChildViewEvents(view); // We need to listen for if a view is destroyed in a way other than through the region.
    // If this happens we need to remove the reference to the currentView since once a view
    // has been destroyed we can not reuse it.


    view.on('destroy', this._empty, this);
  },

  _proxyChildViewEvents(view) {
    const parentView = this._parentView;

    if (!parentView) {
      return;
    }

    parentView._proxyChildViewEvents(view);
  },

  // If the regions parent view is not monitoring its attach/detach events
  _shouldDisableMonitoring() {
    return this._parentView && this._parentView.monitorViewEvents === false;
  },

  _isElAttached() {
    return this.Dom.hasEl(this.Dom.getDocumentEl(this.el), this.el);
  },

  _attachView(view, {
    replaceElement
  } = {}) {
    const shouldTriggerAttach = !view._isAttached && this._isElAttached() && !this._shouldDisableMonitoring();
    const shouldReplaceEl = typeof replaceElement === 'undefined' ? !!underscore.result(this, 'replaceElement') : !!replaceElement;

    if (shouldTriggerAttach) {
      view.triggerMethod('before:attach', view);
    }

    if (shouldReplaceEl) {
      this._replaceEl(view);
    } else {
      this.attachHtml(view);
    }

    if (shouldTriggerAttach) {
      view._isAttached = true;
      view.triggerMethod('attach', view);
    } // Corresponds that view is shown in a marionette Region or CollectionView


    view._isShown = true;
  },

  _ensureElement(options = {}) {
    this._setEl(this.el);

    if (!this.el) {
      const allowMissingEl = typeof options.allowMissingEl === 'undefined' ? !!underscore.result(this, 'allowMissingEl') : !!options.allowMissingEl;

      if (allowMissingEl) {
        return false;
      } else {
        throw new MarionetteError({
          name: classErrorName$1,
          message: `An "el" must exist in DOM for this region ${this.cid}`,
          url: 'marionette.region.html#additional-options'
        });
      }
    }

    return true;
  },

  _getView(view) {
    if (!view) {
      throw new MarionetteError({
        name: classErrorName$1,
        message: 'The view passed is undefined and therefore invalid. You must pass a view instance to show.',
        url: 'marionette.region.html#showing-a-view'
      });
    }

    if (view._isDestroyed) {
      throw new MarionetteError({
        name: classErrorName$1,
        message: `View (cid: "${view.cid}") has already been destroyed and cannot be used.`,
        url: 'marionette.region.html#showing-a-view'
      });
    }

    if (isView(view)) {
      return view;
    }

    const viewOptions = this._getViewOptions(view);

    return new View(viewOptions);
  },

  // This allows for a template or a static string to be
  // used as a template
  _getViewOptions(viewOptions) {
    if (underscore.isFunction(viewOptions)) {
      return {
        template: viewOptions
      };
    }

    if (underscore.isObject(viewOptions)) {
      return viewOptions;
    }

    const template = function () {
      return viewOptions;
    };

    return {
      template
    };
  },

  // Override this method to change how the region finds the DOM element that it manages. Return
  // a jQuery selector object scoped to a provided parent el or the document if none exists.
  getEl(el) {
    const context = underscore.result(this, 'parentEl');
    return this.Dom.findEl(context || document, el)[0];
  },

  _replaceEl(view) {
    // Always restore the el to ensure the regions el is present before replacing
    this._restoreEl();

    view.on('before:destroy', this._restoreEl, this);
    this.Dom.replaceEl(view.el, this.el);
    this._isReplaced = true;
  },

  // Restore the region's element in the DOM.
  _restoreEl() {
    // There is nothing to replace
    if (!this._isReplaced) {
      return;
    }

    const view = this.currentView;

    if (!view) {
      return;
    }

    this._detachView(view);

    this._isReplaced = false;
  },

  // Check to see if the region's el was replaced.
  isReplaced() {
    return !!this._isReplaced;
  },

  // Check to see if a view is being swapped by another
  isSwappingView() {
    return !!this._isSwappingView;
  },

  // Override this method to change how the new view is appended to the `$el` that the
  // region is managing
  attachHtml(view) {
    this.Dom.appendContents(this.el, view.el);
  },

  // Destroy the current view, if there is one. If there is no current view,
  // it will detach any html inside the region's `el`.
  empty(options = {
    allowMissingEl: true
  }) {
    const view = this.currentView; // If there is no view in the region we should only detach current html

    if (!view) {
      if (this._ensureElement(options)) {
        this.detachHtml();
      }

      return this;
    }

    this._empty(view, true);

    return this;
  },

  _empty(view, shouldDestroy) {
    view.off('destroy', this._empty, this);
    this.triggerMethod('before:empty', this, view);

    this._restoreEl();

    delete this.currentView;

    if (!view._isDestroyed) {
      if (shouldDestroy) {
        this.removeView(view);
      } else {
        this._detachView(view);
      }

      view._isShown = false;

      this._stopChildViewEvents(view);
    }

    this.triggerMethod('empty', this, view);
  },

  _stopChildViewEvents(view) {
    const parentView = this._parentView;

    if (!parentView) {
      return;
    }

    this._parentView.stopListening(view);
  },

  // Non-Marionette safe view.destroy
  destroyView(view) {
    if (view._isDestroyed) {
      return view;
    }

    destroyView(view, this._shouldDisableMonitoring());
    return view;
  },

  // Override this method to determine what happens when the view
  // is removed from the region when the view is not being detached
  removeView(view) {
    this.destroyView(view);
  },

  // Empties the Region without destroying the view
  // Returns the detached view
  detachView() {
    const view = this.currentView;

    if (!view) {
      return;
    }

    this._empty(view);

    return view;
  },

  _detachView(view) {
    const shouldTriggerDetach = view._isAttached && !this._shouldDisableMonitoring();
    const shouldRestoreEl = this._isReplaced;

    if (shouldTriggerDetach) {
      view.triggerMethod('before:detach', view);
    }

    if (shouldRestoreEl) {
      this.Dom.replaceEl(this.el, view.el);
    } else {
      this.detachHtml();
    }

    if (shouldTriggerDetach) {
      view._isAttached = false;
      view.triggerMethod('detach', view);
    }
  },

  // Override this method to change how the region detaches current content
  detachHtml() {
    this.Dom.detachContents(this.el);
  },

  // Checks whether a view is currently present within the region. Returns `true` if there is
  // and `false` if no view is present.
  hasView() {
    return !!this.currentView;
  },

  // Reset the region by destroying any existing view and clearing out the cached `$el`.
  // The next time a view is shown via this region, the region will re-query the DOM for
  // the region's `el`.
  reset(options) {
    this.empty(options);
    this.el = this._initEl;
    delete this.$el;
    return this;
  },

  _isDestroyed: false,

  isDestroyed() {
    return this._isDestroyed;
  },

  // Destroy the region, remove any child view
  // and remove the region from any associated view
  destroy(options) {
    if (this._isDestroyed) {
      return this;
    }

    this.triggerMethod('before:destroy', this, options);
    this._isDestroyed = true;
    this.reset(options);

    if (this._name) {
      this._parentView._removeReferences(this._name);
    }

    delete this._parentView;
    delete this._name;
    this.triggerMethod('destroy', this, options);
    this.stopListening();
    return this;
  }

});

function buildRegion (definition, defaults) {
  if (definition instanceof Region) {
    return definition;
  }

  if (underscore.isString(definition)) {
    return buildRegionFromObject(defaults, {
      el: definition
    });
  }

  if (underscore.isFunction(definition)) {
    return buildRegionFromObject(defaults, {
      regionClass: definition
    });
  }

  if (underscore.isObject(definition)) {
    return buildRegionFromObject(defaults, definition);
  }

  throw new MarionetteError({
    message: 'Improper region configuration type.',
    url: 'marionette.region.html#defining-regions'
  });
}

function buildRegionFromObject(defaults, definition) {
  const options = underscore.extend({}, defaults, definition);
  const RegionClass = options.regionClass;
  delete options.regionClass;
  return new RegionClass(options);
}

// - regions
// - regionClass

var RegionsMixin = {
  regionClass: Region,

  // Internal method to initialize the regions that have been defined in a
  // `regions` attribute on this View.
  _initRegions() {
    // init regions hash
    this.regions = this.regions || {};
    this._regions = {};
    this.addRegions(underscore.result(this, 'regions'));
  },

  // Internal method to re-initialize all of the regions by updating
  // the `el` that they point to
  _reInitRegions() {
    underscore.each(this._regions, region => region.reset());
  },

  // Add a single region, by name, to the View
  addRegion(name, definition) {
    const regions = {};
    regions[name] = definition;
    return this.addRegions(regions)[name];
  },

  // Add multiple regions as a {name: definition, name2: def2} object literal
  addRegions(regions) {
    // If there's nothing to add, stop here.
    if (underscore.isEmpty(regions)) {
      return;
    } // Normalize region selectors hash to allow
    // a user to use the @ui. syntax.


    regions = this.normalizeUIValues(regions, 'el'); // Add the regions definitions to the regions property

    this.regions = underscore.extend({}, this.regions, regions);
    return this._addRegions(regions);
  },

  // internal method to build and add regions
  _addRegions(regionDefinitions) {
    const defaults = {
      regionClass: this.regionClass,
      parentEl: underscore.partial(underscore.result, this, 'el')
    };
    return underscore.reduce(regionDefinitions, (regions, definition, name) => {
      regions[name] = buildRegion(definition, defaults);

      this._addRegion(regions[name], name);

      return regions;
    }, {});
  },

  _addRegion(region, name) {
    this.triggerMethod('before:add:region', this, name, region);
    region._parentView = this;
    region._name = name;
    this._regions[name] = region;
    this.triggerMethod('add:region', this, name, region);
  },

  // Remove a single region from the View, by name
  removeRegion(name) {
    const region = this._regions[name];

    this._removeRegion(region, name);

    return region;
  },

  // Remove all regions from the View
  removeRegions() {
    const regions = this._getRegions();

    underscore.each(this._regions, this._removeRegion.bind(this));
    return regions;
  },

  _removeRegion(region, name) {
    this.triggerMethod('before:remove:region', this, name, region);
    region.destroy();
    this.triggerMethod('remove:region', this, name, region);
  },

  // Called in a region's destroy
  _removeReferences(name) {
    delete this.regions[name];
    delete this._regions[name];
  },

  // Empty all regions in the region manager, but
  // leave them attached
  emptyRegions() {
    const regions = this.getRegions();
    underscore.each(regions, region => region.empty());
    return regions;
  },

  // Checks to see if view contains region
  // Accepts the region name
  // hasRegion('main')
  hasRegion(name) {
    return !!this.getRegion(name);
  },

  // Provides access to regions
  // Accepts the region name
  // getRegion('main')
  getRegion(name) {
    if (!this._isRendered) {
      this.render();
    }

    return this._regions[name];
  },

  _getRegions() {
    return underscore.clone(this._regions);
  },

  // Get all regions
  getRegions() {
    if (!this._isRendered) {
      this.render();
    }

    return this._getRegions();
  },

  showChildView(name, view, options) {
    const region = this.getRegion(name);
    region.show(view, options);
    return view;
  },

  detachChildView(name) {
    return this.getRegion(name).detachView();
  },

  getChildView(name) {
    return this.getRegion(name).currentView;
  }

};

// Static setter for the renderer
function setRenderer(renderer) {
  this.prototype._renderHtml = renderer;
  return this;
}

// View
const ClassOptions$2 = ['attributes', 'behaviors', 'childViewEventPrefix', 'childViewEvents', 'childViewTriggers', 'className', 'collection', 'collectionEvents', 'el', 'events', 'id', 'model', 'modelEvents', 'regionClass', 'regions', 'tagName', 'template', 'templateContext', 'triggers', 'ui']; // Used by _getImmediateChildren

function childReducer(children, region) {
  if (region.currentView) {
    children.push(region.currentView);
  }

  return children;
} // The standard view. Includes view events, automatic rendering
// templates, nested views, and more.


const View = function (options) {
  this.cid = underscore.uniqueId(this.cidPrefix);

  this._setOptions(options, ClassOptions$2);

  this.Dom = underscore.extend({}, this.Dom);
  this.preinitialize.apply(this, arguments);

  this._initViewEvents();

  this.setElement(this._getEl());
  monitorViewEvents(this);

  this._initBehaviors();

  this._initRegions();

  this._buildEventProxies();

  this.initialize.apply(this, arguments);
  this.delegateEntityEvents();

  this._triggerEventOnBehaviors('initialize', this, options);
};

underscore.extend(View, {
  extend,
  setRenderer,
  setDomApi,
  setEventDelegator
});

underscore.extend(View.prototype, ViewMixin, RegionsMixin, {
  cidPrefix: 'mnv',

  setElement(element) {
    this._undelegateViewEvents();

    const el = this._validateEl(element);

    const wrappedEl = this.Dom.wrapEl && this.Dom.wrapEl(el);
    this.el = el;

    if (this.Dom.wrapEl) {
      this.$el = wrappedEl;
    } else {
      delete this.$el;
    }

    this._setBehaviorElements();

    this._isRendered = this.Dom.hasContents(this.el);
    this._isAttached = this._isElAttached();

    if (this._isRendered) {
      this.bindUIElements();
    }

    this._delegateViewEvents();

    return this;
  },

  // If a template is available, renders it into the view's `el`
  // Re-inits regions and binds UI.
  render() {
    const template = this.getTemplate();

    if (template === false || this._isDestroyed) {
      return this;
    }

    this.triggerMethod('before:render', this); // If this is not the first render call, then we need to
    // re-initialize the `el` for each region

    if (this._isRendered) {
      this._reInitRegions();
    }

    this._renderTemplate(template);

    this.bindUIElements();
    this._isRendered = true;
    this.triggerMethod('render', this);
    return this;
  },

  // called by ViewMixin destroy
  _removeChildren() {
    this.removeRegions();
  },

  _getImmediateChildren() {
    return underscore.reduce(this._regions, childReducer, []);
  }

});

const _ = {
  forEach: underscore.forEach,
  each: underscore.each,
  map: underscore.map,
  find: underscore.find,
  detect: underscore.detect,
  filter: underscore.filter,
  select: underscore.select,
  reject: underscore.reject,
  every: underscore.every,
  all: underscore.all,
  some: underscore.some,
  any: underscore.any,
  include: underscore.include,
  contains: underscore.contains,
  invoke: underscore.invoke,
  toArray: underscore.toArray,
  first: underscore.first,
  initial: underscore.initial,
  rest: underscore.rest,
  last: underscore.last,
  without: underscore.without,
  isEmpty: underscore.isEmpty,
  pluck: underscore.pluck,
  reduce: underscore.reduce,
  partition: underscore.partition
}; // Provide a container to store, retrieve and
// shut down child views.

const Container = function () {
  this._init();
}; // Mix in methods from Underscore, for iteration, and other
// collection related features.
// Borrowing this code from Backbone.Collection:
// https://github.com/jashkenas/backbone/blob/1.1.2/backbone.js#L962


const methods = ['forEach', 'each', 'map', 'find', 'detect', 'filter', 'select', 'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke', 'toArray', 'first', 'initial', 'rest', 'last', 'without', 'isEmpty', 'pluck', 'reduce', 'partition'];
underscore.each(methods, function (method) {
  Container.prototype[method] = function (...args) {
    return _[method].apply(_, [this._views].concat(args));
  };
});

function stringComparator(comparator, view) {
  return view.model && view.model.get(comparator);
} // Container Methods
// -----------------


underscore.extend(Container.prototype, {
  // Initializes an empty container
  _init() {
    this._views = [];
    this._viewsByCid = {};
    this._indexByModel = {};

    this._updateLength();
  },

  // Add a view to this container. Stores the view
  // by `cid` and makes it searchable by the model
  // cid (and model itself). Additionally it stores
  // the view by index in the _views array
  _add(view, index = this._views.length) {
    this._addViewIndexes(view); // add to end by default


    this._views.splice(index, 0, view);

    this._updateLength();
  },

  _addViewIndexes(view) {
    // store the view
    this._viewsByCid[view.cid] = view; // index it by model

    if (view.model) {
      this._indexByModel[view.model.cid] = view;
    }
  },

  // Sort (mutate) and return the array of the child views.
  _sort(comparator, context) {
    if (typeof comparator === 'string') {
      comparator = underscore.partial(stringComparator, comparator);
      return this._sortBy(comparator);
    }

    if (comparator.length === 1) {
      return this._sortBy(comparator.bind(context));
    }

    return this._views.sort(comparator.bind(context));
  },

  // Makes `sortBy` mutate the array to match `this._views.sort`
  _sortBy(comparator) {
    const sortedViews = underscore.sortBy(this._views, comparator);

    this._set(sortedViews);

    return sortedViews;
  },

  // Replace array contents without overwriting the reference.
  // Should not add/remove views
  _set(views, shouldReset) {
    this._views.length = 0;

    this._views.push.apply(this._views, views.slice(0));

    if (shouldReset) {
      this._viewsByCid = {};
      this._indexByModel = {};
      underscore.each(views, this._addViewIndexes.bind(this));

      this._updateLength();
    }
  },

  // Swap views by index
  _swap(view1, view2) {
    const view1Index = this.findIndexByView(view1);
    const view2Index = this.findIndexByView(view2);

    if (view1Index === -1 || view2Index === -1) {
      return;
    }

    const swapView = this._views[view1Index];
    this._views[view1Index] = this._views[view2Index];
    this._views[view2Index] = swapView;
  },

  // Find a view by the model that was attached to it.
  // Uses the model's `cid` to find it.
  findByModel(model) {
    return this.findByModelCid(model.cid);
  },

  // Find a view by the `cid` of the model that was attached to it.
  findByModelCid(modelCid) {
    return this._indexByModel[modelCid];
  },

  // Find a view by index.
  findByIndex(index) {
    return this._views[index];
  },

  // Find the index of a view instance
  findIndexByView(view) {
    return this._views.indexOf(view);
  },

  // Retrieve a view by its `cid` directly
  findByCid(cid) {
    return this._viewsByCid[cid];
  },

  hasView(view) {
    return !!this.findByCid(view.cid);
  },

  // Remove a view and clean up index references.
  _remove(view) {
    if (!this._viewsByCid[view.cid]) {
      return;
    } // delete model index


    if (view.model) {
      delete this._indexByModel[view.model.cid];
    } // remove the view from the container


    delete this._viewsByCid[view.cid];
    const index = this.findIndexByView(view);

    this._views.splice(index, 1);

    this._updateLength();
  },

  // Update the `.length` attribute on this container
  _updateLength() {
    this.length = this._views.length;
  }

});

// Collection View
const classErrorName$2 = 'CollectionViewError';
const ClassOptions$3 = ['attributes', 'behaviors', 'childView', 'childViewContainer', 'childViewEventPrefix', 'childViewEvents', 'childViewOptions', 'childViewTriggers', 'className', 'collection', 'collectionEvents', 'el', 'emptyView', 'emptyViewOptions', 'events', 'id', 'model', 'modelEvents', 'sortWithCollection', 'tagName', 'template', 'templateContext', 'triggers', 'ui', 'viewComparator', 'viewFilter']; // A view that iterates over a Backbone.Collection
// and renders an individual child view for each model.

const CollectionView = function (options) {
  this.cid = underscore.uniqueId(this.cidPrefix);

  this._setOptions(options, ClassOptions$3);

  this.Dom = underscore.extend({}, this.Dom);
  this.preinitialize.apply(this, arguments);

  this._initViewEvents();

  this.setElement(this._getEl());
  monitorViewEvents(this);

  this._initChildViewStorage();

  this._initBehaviors();

  this._buildEventProxies(); // Init empty region


  this.getEmptyRegion();
  this.initialize.apply(this, arguments);
  this.delegateEntityEvents();

  this._triggerEventOnBehaviors('initialize', this, options);
};

underscore.extend(CollectionView, {
  extend,
  setRenderer,
  setDomApi,
  setEventDelegator
});

underscore.extend(CollectionView.prototype, ViewMixin, {
  cidPrefix: 'mncv',
  // flag for maintaining the sorted order of the collection
  sortWithCollection: true,

  // Internal method to set up the `children` object for storing all of the child views
  // `_children` represents all child views
  // `children` represents only views filtered to be shown
  _initChildViewStorage() {
    this._children = new Container();
    this.children = new Container();
  },

  // Create an region to show the emptyView
  getEmptyRegion() {
    const emptyEl = this.container || this.el;

    if (this._emptyRegion && !this._emptyRegion.isDestroyed()) {
      this._emptyRegion._setElement(emptyEl);

      return this._emptyRegion;
    }

    this._emptyRegion = new Region({
      el: emptyEl,
      replaceElement: false
    });
    this._emptyRegion._parentView = this;
    return this._emptyRegion;
  },

  // Configured the initial events that the collection view binds to.
  _initialEvents() {
    if (this._isRendered) {
      return;
    }

    this.listenTo(this.collection, {
      'sort': this._onCollectionSort,
      'reset': this._onCollectionReset,
      'update': this._onCollectionUpdate
    });
  },

  // Internal method. This checks for any changes in the order of the collection.
  // If the index of any view doesn't match, it will re-sort.
  _onCollectionSort(collection, {
    add,
    merge,
    remove
  }) {
    if (!this.sortWithCollection || this.viewComparator === false) {
      return;
    } // If the data is changing we will handle the sort later in `_onCollectionUpdate`


    if (add || remove || merge) {
      return;
    } // If the only thing happening here is sorting, sort.


    this.sort();
  },

  _onCollectionReset() {
    this._destroyChildren();

    this._addChildModels(this.collection.models);

    this.sort();
  },

  // Handle collection update model additions and  removals
  _onCollectionUpdate(collection, options) {
    const changes = options.changes; // Remove first since it'll be a shorter array lookup.

    const removedViews = changes.removed.length && this._removeChildModels(changes.removed);

    this._addedViews = changes.added.length && this._addChildModels(changes.added);

    this._detachChildren(removedViews);

    this.sort(); // Destroy removed child views after all of the render is complete

    this._removeChildViews(removedViews);
  },

  _removeChildModels(models) {
    return underscore.reduce(models, (views, model) => {
      const removeView = this._removeChildModel(model);

      if (removeView) {
        views.push(removeView);
      }

      return views;
    }, []);
  },

  _removeChildModel(model) {
    const view = this._children.findByModel(model);

    if (view) {
      this._removeChild(view);
    }

    return view;
  },

  _removeChild(view) {
    this.triggerMethod('before:remove:child', this, view);

    this.children._remove(view);

    this._children._remove(view);

    this.triggerMethod('remove:child', this, view);
  },

  // Added views are returned for consistency with _removeChildModels
  _addChildModels(models) {
    return underscore.map(models, this._addChildModel.bind(this));
  },

  _addChildModel(model) {
    const view = this._createChildView(model);

    this._addChild(view);

    return view;
  },

  _createChildView(model) {
    const ChildView = this._getChildView(model);

    const childViewOptions = this._getChildViewOptions(model);

    const view = this.buildChildView(model, ChildView, childViewOptions);
    return view;
  },

  _addChild(view, index) {
    this.triggerMethod('before:add:child', this, view);

    this._setupChildView(view);

    this._children._add(view, index);

    this.children._add(view, index);

    this.triggerMethod('add:child', this, view);
  },

  // Retrieve the `childView` class
  // The `childView` property can be either a view class or a function that
  // returns a view class. If it is a function, it will receive the model that
  // will be passed to the view instance (created from the returned view class)
  _getChildView(child) {
    let childView = this.childView;

    if (!childView) {
      throw new MarionetteError({
        name: classErrorName$2,
        message: 'A "childView" must be specified',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }

    childView = this._getView(childView, child);

    if (!childView) {
      throw new MarionetteError({
        name: classErrorName$2,
        message: '"childView" must be a view class or a function that returns a view class',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }

    return childView;
  },

  // First check if the `view` is a view class (the common case)
  // Then check if it's a function (which we assume that returns a view class)
  _getView(view, child) {
    if (isViewClass(view)) {
      return view;
    } else if (underscore.isFunction(view)) {
      return view.call(this, child);
    }
  },

  _getChildViewOptions(child) {
    if (underscore.isFunction(this.childViewOptions)) {
      return this.childViewOptions(child);
    }

    return this.childViewOptions;
  },

  // Build a `childView` for a model in the collection.
  // Override to customize the build
  buildChildView(child, ChildViewClass, childViewOptions) {
    const options = underscore.extend({
      model: child
    }, childViewOptions);

    return new ChildViewClass(options);
  },

  _setupChildView(view) {
    monitorViewEvents(view); // We need to listen for if a view is destroyed in a way other
    // than through the CollectionView.
    // If this happens we need to remove the reference to the view
    // since once a view has been destroyed we can not reuse it.

    view.on('destroy', this.removeChildView, this); // set up the child view event forwarding

    this._proxyChildViewEvents(view);
  },

  // used by ViewMixin's `_childViewEventHandler`
  _getImmediateChildren() {
    return this.children._views;
  },

  // Overriding Backbone.View's `setElement` to handle
  // if an el was previously defined. If so, the view might be
  // attached on setElement.
  setElement(element) {
    this._undelegateViewEvents();

    const el = this._validateEl(element);

    const wrappedEl = this.Dom.wrapEl && this.Dom.wrapEl(el);
    this.el = el;

    if (this.Dom.wrapEl) {
      this.$el = wrappedEl;
    } else {
      delete this.$el;
    }

    this._setBehaviorElements();

    this._isAttached = this._isElAttached();

    this._delegateViewEvents();

    return this;
  },

  // Render children views.
  render() {
    if (this._isDestroyed) {
      return this;
    }

    this.triggerMethod('before:render', this);

    this._destroyChildren();

    if (this.collection) {
      this._addChildModels(this.collection.models);

      this._initialEvents();
    }

    const template = this.getTemplate();

    if (template) {
      this._renderTemplate(template);

      this.bindUIElements();
    }

    this._getChildViewContainer();

    this.sort();
    this._isRendered = true;
    this.triggerMethod('render', this);
    return this;
  },

  // Get a container within the template to add the children within
  _getChildViewContainer() {
    const childViewContainer = underscore.result(this, 'childViewContainer');
    this.container = childViewContainer ? this.$(childViewContainer)[0] : this.el;

    if (!this.container) {
      throw new MarionetteError({
        name: classErrorName$2,
        message: `The specified "childViewContainer" was not found: ${childViewContainer}`,
        url: 'marionette.collectionview.html#defining-the-childviewcontainer'
      });
    }
  },

  // Sorts the children then filters and renders the results.
  sort() {
    this._sortChildren();

    this.filter();
    return this;
  },

  // Sorts views by viewComparator and sets the children to the new order
  _sortChildren() {
    if (!this._children.length) {
      return;
    }

    let viewComparator = this.getComparator();

    if (!viewComparator) {
      return;
    } // If children are sorted prevent added to end perf


    delete this._addedViews;
    this.triggerMethod('before:sort', this);

    this._children._sort(viewComparator, this);

    this.triggerMethod('sort', this);
  },

  // Sets the view's `viewComparator` and applies the sort if the view is ready.
  // To prevent the render pass `{ preventRender: true }` as the 2nd argument.
  setComparator(comparator, {
    preventRender
  } = {}) {
    const comparatorChanged = this.viewComparator !== comparator;
    const shouldSort = comparatorChanged && !preventRender;
    this.viewComparator = comparator;

    if (shouldSort) {
      this.sort();
    }

    return this;
  },

  // Clears the `viewComparator` and follows the same rules for rendering as `setComparator`.
  removeComparator(options) {
    return this.setComparator(null, options);
  },

  // If viewComparator is overridden it will be returned here.
  // Additionally override this function to provide custom
  // viewComparator logic
  getComparator() {
    if (this.viewComparator) {
      return this.viewComparator;
    }

    if (!this.sortWithCollection || this.viewComparator === false || !this.collection) {
      return false;
    }

    return this._viewComparator;
  },

  // Default internal view comparator that order the views by
  // the order of the collection
  _viewComparator(view) {
    return this.collection.indexOf(view.model);
  },

  // This method filters the children views and renders the results
  filter() {
    if (this._isDestroyed) {
      return this;
    }

    this._filterChildren();

    this._renderChildren();

    return this;
  },

  _filterChildren() {
    if (!this._children.length) {
      return;
    }

    const viewFilter = this._getFilter();

    if (!viewFilter) {
      const shouldReset = this.children.length !== this._children.length;

      this.children._set(this._children._views, shouldReset);

      return;
    } // If children are filtered prevent added to end perf


    delete this._addedViews;
    this.triggerMethod('before:filter', this);
    const attachViews = [];
    const detachViews = [];
    underscore.each(this._children._views, (view, key, children) => {
      (viewFilter.call(this, view, key, children) ? attachViews : detachViews).push(view);
    });

    this._detachChildren(detachViews); // reset children


    this.children._set(attachViews, true);

    this.triggerMethod('filter', this, attachViews, detachViews);
  },

  // This method returns a function for the viewFilter
  _getFilter() {
    const viewFilter = this.getFilter();

    if (!viewFilter) {
      return false;
    }

    if (underscore.isFunction(viewFilter)) {
      return viewFilter;
    } // Support filter predicates `{ fooFlag: true }`


    if (underscore.isObject(viewFilter)) {
      const matcher = underscore.matches(viewFilter);
      return function (view) {
        return matcher(view.model && view.model.attributes);
      };
    } // Filter by model attribute


    if (underscore.isString(viewFilter)) {
      return function (view) {
        return view.model && view.model.get(viewFilter);
      };
    }

    throw new MarionetteError({
      name: classErrorName$2,
      message: '"viewFilter" must be a function, predicate object literal, a string indicating a model attribute, or falsy',
      url: 'marionette.collectionview.html#defining-the-viewfilter'
    });
  },

  // Override this function to provide custom
  // viewFilter logic
  getFilter() {
    return this.viewFilter;
  },

  // Sets the view's `viewFilter` and applies the filter if the view is ready.
  // To prevent the render pass `{ preventRender: true }` as the 2nd argument.
  setFilter(filter, {
    preventRender
  } = {}) {
    const filterChanged = this.viewFilter !== filter;
    const shouldRender = filterChanged && !preventRender;
    this.viewFilter = filter;

    if (shouldRender) {
      this.filter();
    }

    return this;
  },

  // Clears the `viewFilter` and follows the same rules for rendering as `setFilter`.
  removeFilter(options) {
    return this.setFilter(null, options);
  },

  _detachChildren(detachingViews) {
    underscore.each(detachingViews, this._detachChildView.bind(this));
  },

  _detachChildView(view) {
    const shouldTriggerDetach = view._isAttached && this.monitorViewEvents !== false;

    if (shouldTriggerDetach) {
      view.triggerMethod('before:detach', view);
    }

    this.detachHtml(view);

    if (shouldTriggerDetach) {
      view._isAttached = false;
      view.triggerMethod('detach', view);
    }

    view._isShown = false;
  },

  // Override this method to change how the collectionView detaches a child view
  detachHtml(view) {
    this.Dom.detachEl(view.el);
  },

  _renderChildren() {
    // If there are unrendered views prevent add to end perf
    if (this._hasUnrenderedViews) {
      delete this._addedViews;
      delete this._hasUnrenderedViews;
    }

    const views = this._addedViews || this.children._views;
    this.triggerMethod('before:render:children', this, views);

    if (this.isEmpty()) {
      this._showEmptyView();
    } else {
      this._destroyEmptyView();

      const els = this._getBuffer(views);

      this._attachChildren(els, views);
    }

    delete this._addedViews;
    this.triggerMethod('render:children', this, views);
  },

  // Renders each view and creates a fragment buffer from them
  _getBuffer(views) {
    const elBuffer = this.Dom.createBuffer();
    underscore.each(views, view => {
      renderView(view); // corresponds that view is shown in a Region or CollectionView

      view._isShown = true;
      this.Dom.appendContents(elBuffer, view.el);
    });
    return elBuffer;
  },

  _attachChildren(els, views) {
    const shouldTriggerAttach = this._isAttached && this.monitorViewEvents !== false;
    views = shouldTriggerAttach ? views : [];
    underscore.each(views, view => {
      if (view._isAttached) {
        return;
      }

      view.triggerMethod('before:attach', view);
    });
    this.attachHtml(els, this.container);
    underscore.each(views, view => {
      if (view._isAttached) {
        return;
      }

      view._isAttached = true;
      view.triggerMethod('attach', view);
    });
  },

  // Override this method to do something other than `.append`.
  // You can attach any HTML at this point including the els.
  attachHtml(els, container) {
    this.Dom.appendContents(container, els);
  },

  isEmpty() {
    return !this.children.length;
  },

  _showEmptyView() {
    const EmptyView = this._getEmptyView();

    if (!EmptyView) {
      return;
    }

    const options = this._getEmptyViewOptions();

    const emptyRegion = this.getEmptyRegion();
    emptyRegion.show(new EmptyView(options));
  },

  // Retrieve the empty view class
  _getEmptyView() {
    const emptyView = this.emptyView;

    if (!emptyView) {
      return;
    }

    return this._getView(emptyView);
  },

  // Remove the emptyView
  _destroyEmptyView() {
    const emptyRegion = this.getEmptyRegion(); // Only empty if a view is show so the region
    // doesn't detach any other unrelated HTML

    if (emptyRegion.hasView()) {
      emptyRegion.empty();
    }
  },

  //
  _getEmptyViewOptions() {
    const emptyViewOptions = this.emptyViewOptions || this.childViewOptions;

    if (underscore.isFunction(emptyViewOptions)) {
      return emptyViewOptions.call(this);
    }

    return emptyViewOptions;
  },

  swapChildViews(view1, view2) {
    if (!this._children.hasView(view1) || !this._children.hasView(view2)) {
      throw new MarionetteError({
        name: classErrorName$2,
        message: 'Both views must be children of the collection view to swap.',
        url: 'marionette.collectionview.html#swapping-child-views'
      });
    }

    this._children._swap(view1, view2);

    this.Dom.swapEl(view1.el, view2.el); // If the views are not filtered the same, refilter

    if (this.children.hasView(view1) !== this.children.hasView(view2)) {
      this.filter();
    } else {
      this.children._swap(view1, view2);
    }

    return this;
  },

  // Render the child's view and add it to the HTML for the collection view at a given index, based on the current sort
  addChildView(view, index, options = {}) {
    if (!view || view._isDestroyed) {
      return view;
    }

    if (view._isShown) {
      throw new MarionetteError({
        name: classErrorName$2,
        message: 'View is already shown in a Region or CollectionView',
        url: 'marionette.region.html#showing-a-view'
      });
    }

    if (underscore.isObject(index)) {
      options = index;
    } // If options has defined index we should use it


    if (options.index != null) {
      index = options.index;
    }

    if (!this._isRendered) {
      this.render();
    }

    this._addChild(view, index);

    if (options.preventRender) {
      this._hasUnrenderedViews = true;
      return view;
    }

    const hasIndex = typeof index !== 'undefined';
    const isAddedToEnd = !hasIndex || index >= this._children.length; // Only cache views if added to the end and there is no unrendered views

    if (isAddedToEnd && !this._hasUnrenderedViews) {
      this._addedViews = [view];
    }

    if (hasIndex) {
      this._renderChildren();
    } else {
      this.sort();
    }

    return view;
  },

  // Detach a view from the children.  Best used when adding a
  // childView from `addChildView`
  detachChildView(view) {
    this.removeChildView(view, {
      shouldDetach: true
    });
    return view;
  },

  // Remove the child view and destroy it.  Best used when adding a
  // childView from `addChildView`
  // The options argument is for internal use only
  removeChildView(view, options) {
    if (!view) {
      return view;
    }

    this._removeChildView(view, options);

    this._removeChild(view);

    if (this.isEmpty()) {
      this._showEmptyView();
    }

    return view;
  },

  _removeChildViews(views) {
    underscore.each(views, this._removeChildView.bind(this));
  },

  _removeChildView(view, {
    shouldDetach
  } = {}) {
    view.off('destroy', this.removeChildView, this);

    if (shouldDetach) {
      this._detachChildView(view);
    } else {
      this._destroyChildView(view);
    }

    this.stopListening(view);
  },

  _destroyChildView(view) {
    if (view._isDestroyed) {
      return;
    }

    const shouldDisableEvents = this.monitorViewEvents === false;
    destroyView(view, shouldDisableEvents);
  },

  // called by ViewMixin destroy
  _removeChildren() {
    this._destroyChildren();

    const emptyRegion = this.getEmptyRegion();
    emptyRegion.destroy();
    delete this._addedViews;
  },

  // Destroy the child views that this collection view is holding on to, if any
  _destroyChildren() {
    if (!this._children.length) {
      return;
    }

    this.triggerMethod('before:destroy:children', this);

    if (this.monitorViewEvents === false) {
      this.Dom.detachContents(this.el);
    }

    this._removeChildViews(this._children._views); // After all children have been destroyed re-init the container


    this._children._init();

    this.children._init();

    this.triggerMethod('destroy:children', this);
  }

});

// Behavior
const ClassOptions$4 = ['collectionEvents', 'events', 'modelEvents', 'triggers', 'ui'];

const Behavior = function (options, view) {
  // Setup reference to the view.
  // this comes in handle when a behavior
  // wants to directly talk up the chain
  // to the view.
  this.view = view;

  this._setOptions(options, ClassOptions$4);

  this.cid = underscore.uniqueId(this.cidPrefix);

  this._initViewEvents();

  this.setElement(); // Construct an internal UI hash using the behaviors UI
  // hash combined and overridden by the view UI hash.
  // This allows the user to use UI hash elements defined
  // in the parent view as well as those defined in the behavior.
  // This order will help the reuse and share of a behavior
  // between multiple views, while letting a view override
  // a selector under an UI key.

  this.ui = underscore.extend({}, underscore.result(this, 'ui'), underscore.result(view, 'ui')); // Proxy view triggers

  this.listenTo(view, 'all', this.triggerMethod);
  this.initialize.apply(this, arguments);
};

Behavior.extend = extend; // Behavior Methods
// --------------

underscore.extend(Behavior.prototype, CommonMixin, DelegateEntityEventsMixin, UIMixin, ViewEventsMixin, {
  cidPrefix: 'mnb',

  // proxy behavior $ method to the view
  // this is useful for doing jquery DOM lookups
  // scoped to behaviors view.
  $() {
    return this.view.$.apply(this.view, arguments);
  },

  // Stops the behavior from listening to events.
  destroy() {
    this._undelegateViewEvents();

    this.stopListening();

    this.view._removeBehavior(this);

    this._deleteEntityEventHandlers();

    return this;
  },

  setElement() {
    this._undelegateViewEvents();

    this.el = this.view.el;

    if (this.view.$el) {
      this.$el = this.view.$el;
    } else {
      delete this.$el;
    }

    this._delegateViewEvents(this.view);

    return this;
  },

  bindUIElements() {
    this._bindUIElements();

    return this;
  },

  unbindUIElements() {
    this._unbindUIElements();

    return this;
  },

  getUI(name) {
    return this._getUI(name);
  },

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents() {
    this._delegateEntityEvents(this.view.model, this.view.collection);

    return this;
  },

  undelegateEntityEvents() {
    this._undelegateEntityEvents(this.view.model, this.view.collection);

    return this;
  }

});

// Application
const ClassOptions$5 = ['channelName', 'radioEvents', 'radioRequests', 'region', 'regionClass'];

const Application = function (options) {
  this._setOptions(options, ClassOptions$5);

  this.cid = underscore.uniqueId(this.cidPrefix);

  this._initRegion();

  this._initRadio();

  this.initialize.apply(this, arguments);
};

Application.extend = extend; // Application Methods
// --------------

underscore.extend(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, {
  cidPrefix: 'mna',

  // Kick off all of the application's processes.
  start(options) {
    this.triggerMethod('before:start', this, options);
    this.triggerMethod('start', this, options);
    return this;
  },

  regionClass: Region,

  _initRegion() {
    const region = this.region;

    if (!region) {
      return;
    }

    const defaults = {
      regionClass: this.regionClass
    };
    this._region = buildRegion(region, defaults);
  },

  getRegion() {
    return this._region;
  },

  showView(view, ...args) {
    const region = this.getRegion();
    region.show(view, ...args);
    return view;
  },

  getView() {
    return this.getRegion().currentView;
  }

});

const bindEvents$1 = proxy(bindEvents);
const unbindEvents$1 = proxy(unbindEvents);
const bindRequests$1 = proxy(bindRequests);
const unbindRequests$1 = proxy(unbindRequests);
const mergeOptions$1 = proxy(mergeOptions);
const getOption$1 = proxy(getOption);
const normalizeMethods$1 = proxy(normalizeMethods);
const triggerMethod$1 = proxy(triggerMethod); // Configuration

const setDomApi$1 = function (mixin) {
  CollectionView.setDomApi(mixin);
  Region.setDomApi(mixin);
  View.setDomApi(mixin);
};
const setRenderer$1 = function (renderer) {
  CollectionView.setRenderer(renderer);
  View.setRenderer(renderer);
};
const setEventDelegator$1 = function (delegator) {
  CollectionView.setEventDelegator(delegator);
  View.setEventDelegator(delegator);
};

exports.Application = Application;
exports.Behavior = Behavior;
exports.CollectionView = CollectionView;
exports.DomApi = DomApi;
exports.Events = Events;
exports.MnObject = MarionetteObject;
exports.Radio = Radio;
exports.Region = Region;
exports.Requests = Requests;
exports.VERSION = version;
exports.View = View;
exports.bindEvents = bindEvents$1;
exports.bindRequests = bindRequests$1;
exports.extend = extend;
exports.getOption = getOption$1;
exports.isEnabled = isEnabled;
exports.mergeOptions = mergeOptions$1;
exports.monitorViewEvents = monitorViewEvents;
exports.normalizeMethods = normalizeMethods$1;
exports.setDomApi = setDomApi$1;
exports.setEnabled = setEnabled;
exports.setEventDelegator = setEventDelegator$1;
exports.setRenderer = setRenderer$1;
exports.triggerMethod = triggerMethod$1;
exports.unbindEvents = unbindEvents$1;
exports.unbindRequests = unbindRequests$1;
