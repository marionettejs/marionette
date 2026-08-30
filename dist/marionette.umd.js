(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('underscore')) :
  typeof define === 'function' && define.amd ? define(['exports', 'underscore'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, (function () {
    var current = global.Marionette;
    var exports = global.Marionette = {};
    factory(exports, global._);
    exports.noConflict = function () { global.Marionette = current; return exports; };
  })());
})(this, (function (exports, underscore) { 'use strict';

  const proxy = function (method) {
    return function (context, ...args) {
      return method.apply(context, args);
    };
  };

  function setProperty(target, key, value) {
    if (key === '__proto__') {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        value,
        writable: true
      });
    } else {
      target[key] = value;
    }
  }
  function assign(target, sources, ownOnly) {
    for (const source of sources) {
      const type = typeof source;
      if (source == null || type !== 'object' && type !== 'function') {
        continue;
      }
      for (const key in source) {
        if (ownOnly && !Object.hasOwn(source, key)) {
          continue;
        }
        setProperty(target, key, source[key]);
      }
    }
    return target;
  }
  function assignOwn(target, ...sources) {
    return assign(target, sources, true);
  }
  function assignIn(target, ...sources) {
    return assign(target, sources, false);
  }

  function extend (protoProps, staticProps) {
    const parent = this;
    let child;
    if (protoProps && Object.hasOwn(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function () {
        return parent.apply(this, arguments);
      };
    }
    assignIn(child, parent);
    assignOwn(child, staticProps);
    child.prototype = Object.create(parent.prototype);
    assignOwn(child.prototype, protoProps);
    child.prototype.constructor = child;
    child.__super__ = parent.prototype;
    return child;
  }

  var version = "5.0.0-alpha.2";

  const errorProps = ['code', 'description', 'fileName', 'lineNumber', 'name', 'message', 'number', 'url'];
  const MarionetteError = extend.call(Error, {
    urlRoot: `http://marionettejs.com/docs/v${version}/`,
    url: '',
    constructor: function (options) {
      const error = Error.call(this, options.message);
      const nativeProperties = {};
      const optionProperties = {};
      for (const property of errorProps) {
        const value = error[property];
        if (property in error) {
          nativeProperties[property] = value;
        }
      }
      const optionSource = Object(options);
      for (const property of errorProps) {
        const value = optionSource[property];
        if (property in optionSource) {
          optionProperties[property] = value;
        }
      }
      if (this !== undefined && this !== null) {
        Object.assign(this, nativeProperties, optionProperties);
      }
      this.captureStackTrace(error);
      this.url = this.urlRoot + this.url;
    },
    captureStackTrace(fallbackError) {
      if (typeof Error.captureStackTrace !== 'function') {
        this.stack = fallbackError.stack;
        return;
      }
      Error.captureStackTrace(this, MarionetteError);
    },
    toString() {
      return `${this.name}: ${this.message} See: ${this.url}`;
    }
  });

  const getObjectTag = Function.call.bind(Object.prototype.toString);
  function isString(value) {
    return getObjectTag(value) === '[object String]';
  }

  const resolveMethod = function (context, method, name) {
    if (typeof method === 'function') {
      return method;
    }
    const methodName = method;
    const resolvedMethod = isString(methodName) ? context[methodName] : undefined;
    if (typeof resolvedMethod !== 'function') {
      let methodLabel = '<unprintable>';
      try {
        methodLabel = String(methodName);
      } catch {}
      throw new MarionetteError({
        code: 'MN0019',
        message: `The handler "${methodLabel}" for "${name}" must resolve to a function.`
      });
    }
    return resolvedMethod;
  };
  const normalizeMethods$1 = function (hash) {
    if (!hash) {
      return;
    }
    const normalizedHash = {};
    for (const name of Object.keys(hash)) {
      setProperty(normalizedHash, name, resolveMethod(this, hash[name], name));
    }
    return normalizedHash;
  };

  const propertyIsEnumerable$1 = Object.prototype.propertyIsEnumerable;
  function normalizeBindings$1(context, bindings) {
    const bindingsType = typeof bindings;
    if (bindings === null || bindingsType !== 'object' && bindingsType !== 'function') {
      throw new MarionetteError({
        code: 'MN0009',
        message: 'Bindings must be an object.',
        url: 'common.html#bindevents'
      });
    }
    if (propertyIsEnumerable$1.call(bindings, '__proto__')) {
      throw new MarionetteError({
        code: 'MN0026',
        message: 'Entity event maps cannot include an own "__proto__" event name.',
        url: 'common.html#bindevents'
      });
    }
    return normalizeMethods$1.call(context, bindings);
  }
  function bindEvents$1(entity, bindings) {
    if (!entity || !bindings) {
      return this;
    }
    this.listenTo(entity, normalizeBindings$1(this, bindings));
    return this;
  }
  function unbindEvents$1(entity, bindings) {
    if (!entity) {
      return this;
    }
    if (!bindings) {
      this.stopListening(entity);
      return this;
    }
    this.stopListening(entity, normalizeBindings$1(this, bindings));
    return this;
  }

  function normalizeBindings(context, bindings) {
    const bindingsType = typeof bindings;
    if (bindings === null || bindingsType !== 'object' && bindingsType !== 'function') {
      throw new MarionetteError({
        code: 'MN0010',
        message: 'Bindings must be an object.',
        url: 'common.html#bindrequests'
      });
    }
    return normalizeMethods$1.call(context, bindings);
  }
  function bindRequests$1(channel, bindings) {
    if (!channel || !bindings) {
      return this;
    }
    channel.reply(normalizeBindings(this, bindings), this);
    return this;
  }
  function unbindRequests$1(channel, bindings) {
    if (!channel) {
      return this;
    }
    if (!bindings) {
      channel.stopReplying(null, null, this);
      return this;
    }
    channel.stopReplying(normalizeBindings(this, bindings));
    return this;
  }

  const getOption$1 = function (optionName) {
    if (!optionName) {
      return;
    }
    if (this.options && this.options[optionName] !== undefined) {
      return this.options[optionName];
    } else {
      return this[optionName];
    }
  };

  const MAX_ARRAY_INDEX$1 = Number.MAX_SAFE_INTEGER;
  const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
  const eachRequestedKey = function (keys, iteratee) {
    if (keys == null) {
      return;
    }
    const candidateLength = keys.length;
    if (typeof candidateLength === 'number' && candidateLength >= 0 && candidateLength <= MAX_ARRAY_INDEX$1) {
      const length = keys.length;
      for (let index = 0; index < length; index++) {
        iteratee(keys[index]);
      }
      return;
    }
    const names = Object.keys(keys);
    for (const name of names) {
      iteratee(keys[name]);
    }
  };
  const mergeOptions$1 = function (options, keys) {
    if (!options) {
      return;
    }
    eachRequestedKey(keys, key => {
      if (typeof key !== 'string' || !propertyIsEnumerable.call(options, key)) {
        return;
      }
      const option = options[key];
      if (option !== undefined) {
        setProperty(this, key, option);
      }
    });
  };

  const MAX_ARRAY_INDEX = Number.MAX_SAFE_INTEGER;
  function eachChild(children, iteratee) {
    if (children == null) {
      return;
    }
    const candidateLength = children.length;
    if (typeof candidateLength === 'number' && candidateLength >= 0 && candidateLength <= MAX_ARRAY_INDEX) {
      const length = children.length;
      for (let index = 0; index < length; index++) {
        iteratee(children[index]);
      }
      return;
    }
    const names = Object.keys(children);
    for (let index = 0, length = names.length; index < length; index++) {
      const name = names[index];
      iteratee(children[name]);
    }
  }
  function triggerMethodChildren(view, event, shouldTrigger) {
    if (!view._getImmediateChildren) {
      return;
    }
    eachChild(view._getImmediateChildren(), child => {
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
  }
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

  const splitter = /(^|:)(\w)/gi;
  const methodCache = Object.create(null);
  function getEventName(match, prefix, eventName) {
    return eventName.toUpperCase();
  }
  const getOnMethodName = function (event) {
    if (!methodCache[event]) {
      methodCache[event] = 'on' + event.replace(splitter, getEventName);
    }
    return methodCache[event];
  };
  function triggerMethod$1(event, ...args) {
    const methodName = getOnMethodName(event);
    const method = getOption$1.call(this, methodName);
    let result;
    if (typeof method === 'function') {
      result = method.apply(this, args);
    }
    this.trigger.apply(this, arguments);
    return result;
  }

  const eventSplitter = /\s+/;
  function buildEventArgs(name, callback, context, listener) {
    if (name && typeof name === 'object') {
      const eventArgs = [];
      const names = Object.keys(name);
      for (let i = 0; i < names.length; i++) {
        const key = names[i];
        const args = buildEventArgs(key, name[key], context || callback, listener);
        for (let j = 0; j < args.length; j++) {
          eventArgs.push(args[j]);
        }
      }
      return eventArgs;
    }
    if (name && eventSplitter.test(name)) {
      const names = name.split(eventSplitter);
      const eventArgs = [];
      for (let i = 0; i < names.length; i++) {
        eventArgs.push({
          name: names[i],
          callback,
          context,
          listener
        });
      }
      return eventArgs;
    }
    return [{
      name,
      callback,
      context,
      listener
    }];
  }

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

  function onceWrap(callback, offCallback) {
    let called = false;
    let result;
    function onceCallback() {
      if (called) {
        return result;
      }
      called = true;
      offCallback(onceCallback);
      result = callback.apply(this, arguments);
      return result;
    }
    onceCallback._callback = callback;
    return onceCallback;
  }

  let idCounter = 0;
  function uniqueId(prefix) {
    const id = `${++idCounter}`;
    return prefix ? prefix + id : id;
  }

  const onApi = function ({
    events,
    name,
    callback,
    context,
    ctx,
    listener
  }) {
    let handlers = Object.hasOwn(events, name) ? events[name] : undefined;
    if (!handlers) {
      handlers = [];
      setProperty(events, name, handlers);
    }
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
  };
  const offReducer = function (events, {
    name,
    callback,
    context
  }) {
    const names = name ? [name] : underscore.keys(events);
    underscore.each(names, key => {
      const handlers = Object.hasOwn(events, key) ? events[key] : undefined;
      if (!handlers) {
        return;
      }
      events[key] = underscore.reduce(handlers, (remaining, handler) => {
        if (callback && callback !== handler.callback && callback !== handler.callback._callback || context && context !== handler.context) {
          remaining.push(handler);
          return remaining;
        }
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
    const listeneeId = obj._rdListenId || (obj._rdListenId = uniqueId('l'));
    obj._rdEvents = obj._rdEvents || {};
    const listeningTo = listenerObj._rdListeningTo || (listenerObj._rdListeningTo = {});
    const listener = listeningTo[listeneeId];
    if (!listener) {
      const listenerId = listenerObj._rdListenId || (listenerObj._rdListenId = uniqueId('l'));
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
    listener.count++;
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
  };
  const triggerApi = function ({
    events,
    name,
    args
  }) {
    const objEvents = Object.hasOwn(events, name) ? events[name] : undefined;
    const registeredAllEvents = Object.hasOwn(events, 'all') ? events.all : undefined;
    const allEvents = objEvents && registeredAllEvents ? registeredAllEvents.slice() : registeredAllEvents;
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
    on(name, callback, context, opts) {
      if (opts && opts._rdInternal) {
        return;
      }
      const eventArgs = buildEventArgs(name, callback, context);
      this._rdEvents = underscore.reduce(eventArgs, onReducer.bind(this), this._rdEvents || {});
      return this;
    },
    off(name, callback, context, opts) {
      if (!this._rdEvents) {
        return this;
      }
      if (opts && opts._rdInternal) {
        return;
      }
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
    once(name, callback, context) {
      const eventArgs = buildEventArgs(name, callback, context);
      this._rdEvents = underscore.reduce(eventArgs, onceReducer.bind(this), this._rdEvents || {});
      return this;
    },
    listenTo(obj, name, callback) {
      if (!obj) {
        return this;
      }
      const listener = getListener(obj, this);
      const eventArgs = buildEventArgs(name, callback, this, listener);
      underscore.each(eventArgs, listenToApi);
      return this;
    },
    listenToOnce(obj, name, callback) {
      if (!obj) {
        return this;
      }
      const listener = getListener(obj, this);
      const eventArgs = buildEventArgs(name, callback, this, listener);
      underscore.each(eventArgs, listenToOnceApi.bind(this));
      return this;
    },
    stopListening(obj, name, callback) {
      const listeningTo = this._rdListeningTo;
      if (!listeningTo) {
        return this;
      }
      const eventArgs = buildEventArgs(name, callback, this);
      const listenerIds = obj ? [obj._rdListenId] : underscore.keys(listeningTo);
      for (let i = 0; i < listenerIds.length; i++) {
        const listener = listeningTo[listenerIds[i]];
        if (!listener) {
          break;
        }
        underscore.each(eventArgs, args => {
          const listenToObj = listener.obj;
          const events = listenToObj._rdEvents;
          if (!events) {
            return;
          }
          listenToObj._rdEvents = offReducer(events, args);
          listenToObj.off(args.name, args.callback, this, {
            _rdInternal: true
          });
        });
      }
      return this;
    },
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
    triggerMethod: triggerMethod$1
  };

  let shouldDebug = false;
  function setDebug(setShouldDebug = true) {
    shouldDebug = setShouldDebug;
  }
  function debugText(warning, eventName, channelName) {
    return warning + (channelName ? ` on the ${channelName} channel` : '') + `: "${eventName}"`;
  }
  function debugLog(warning, eventName, channelName) {
    if (shouldDebug && console && console.warn) {
      console.warn(debugText(warning, eventName, channelName));
    }
  }
  function log(channelName, eventName, ...args) {
    if (typeof console === 'undefined') {
      return;
    }
    console.log(`[${channelName}] "${eventName}"`, args);
  }

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

  const objectKeys$1 = Object.keys;
  function getKeys(object) {
    const type = typeof object;
    return object != null && (type === 'object' || type === 'function') ? objectKeys$1(object) : [];
  }
  const replyReducer = function (isOnce, requests, {
    name,
    callback,
    context
  }) {
    if (Object.hasOwn(requests, name)) {
      debugLog('A request was overwritten', name, this.channelName);
    }
    setProperty(requests, name, {
      callback: isOnce ? onceWrap(makeCallback(callback), this.stopReplying.bind(this, name)) : makeCallback(callback),
      context: context || this
    });
    return requests;
  };
  const stopReducer = function (requests, {
    name,
    callback,
    context
  }) {
    const names = name ? [name] : getKeys(requests);
    for (let index = 0, length = names.length; index < length; index++) {
      const key = names[index];
      const handler = Object.hasOwn(requests, key) ? requests[key] : undefined;
      if (!handler || callback && callback !== handler.callback && callback !== handler.callback._callback || context && context !== handler.context) {
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
  var Requests = {
    reply(name, callback, context) {
      const eventArgs = buildEventArgs(name, callback, context);
      this._rdRequests = registerReplies(this, eventArgs, this._rdRequests || {}, false);
      return this;
    },
    replyOnce(name, callback, context) {
      const eventArgs = buildEventArgs(name, callback, context);
      this._rdRequests = registerReplies(this, eventArgs, this._rdRequests || {}, true);
      return this;
    },
    stopReplying(name, callback, context) {
      if (!this._rdRequests) {
        return this;
      }
      if (!name && !callback && !context) {
        delete this._rdRequests;
        return this;
      }
      const eventArgs = buildEventArgs(name, callback, context);
      this._rdRequests = removeReplies(this, eventArgs, this._rdRequests);
      return this;
    },
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
      if (channelName && this._tunedIn) {
        log.apply(this, [channelName, name].concat(args));
      }
      if (requests) {
        const hasRequest = Object.hasOwn(requests, name);
        const handler = hasRequest ? requests[name] : Object.hasOwn(requests, 'default') ? requests.default : undefined;
        if (handler) {
          args = hasRequest ? args : arguments;
          return callHandler(handler.callback, handler.context, args);
        }
      }
      debugLog('An unhandled request was fired', name, channelName);
    }
  };

  function getValue(object, property, fallback) {
    const value = object == null ? undefined : object[property];
    const resolvedValue = value === undefined ? fallback : value;
    return typeof resolvedValue === 'function' ? resolvedValue.call(object) : resolvedValue;
  }

  const CommonMixin = {
    initialize() {},
    normalizeMethods: normalizeMethods$1,
    _setOptions(options, classOptions) {
      this.options = assignOwn({}, getValue(this, 'options'), options);
      this.mergeOptions(options, classOptions);
    },
    mergeOptions: mergeOptions$1,
    getOption: getOption$1,
    bindEvents: bindEvents$1,
    unbindEvents: unbindEvents$1,
    bindRequests: bindRequests$1,
    unbindRequests: unbindRequests$1,
    triggerMethod: triggerMethod$1
  };
  assignOwn(CommonMixin, Events, Requests);

  var DestroyMixin = {
    _isDestroyed: false,
    isDestroyed() {
      return this._isDestroyed;
    },
    destroy(options) {
      if (this._isDestroyed || this._isDestroying) {
        return this;
      }
      this._isDestroying = true;
      try {
        this.triggerMethod('before:destroy', this, options);
      } catch (error) {
        delete this._isDestroying;
        throw error;
      }
      this._isDestroyed = true;
      this.triggerMethod('destroy', this, options);
      this.stopListening();
      return this;
    }
  };

  const _logs = Object.create(null);
  function _partial(channelName) {
    return _logs[channelName] || (_logs[channelName] = log.bind(Radio, channelName));
  }
  const Radio = {};
  underscore.extend(Radio, {
    setDebug,
    log,
    debugLog,
    tuneIn(channelName) {
      const channel = Radio.channel(channelName);
      channel._tunedIn = true;
      channel.on('all', _partial(channelName));
      return this;
    },
    tuneOut(channelName) {
      const channel = Radio.channel(channelName);
      channel._tunedIn = false;
      channel.off('all', _partial(channelName));
      delete _logs[channelName];
      return this;
    }
  });
  Radio._channels = Object.create(null);
  Radio.channel = function (channelName) {
    if (!channelName) {
      throw new MarionetteError({
        code: 'MN0017',
        message: 'You must provide a name for the channel.'
      });
    }
    if (Radio._channels[channelName]) {
      return Radio._channels[channelName];
    }
    return Radio._channels[channelName] = new Radio.Channel(channelName);
  };
  Radio.Channel = function (channelName) {
    this.channelName = channelName;
  };
  underscore.extend(Radio.Channel.prototype, Events, Requests, {
    reset() {
      this.off();
      this.stopListening();
      this.stopReplying();
      return this;
    }
  });
  underscore.each([Events, Requests], system => {
    underscore.each(underscore.keys(system), methodName => {
      Radio[methodName] = function (channelName, ...args) {
        const channel = this.channel(channelName);
        return callHandler(channel[methodName], channel, args);
      };
    });
  });
  Radio.reset = function (channelName) {
    if (!arguments.length) {
      underscore.each(this._channels, channel => {
        channel.reset();
      });
      return;
    }
    if (!channelName) {
      Radio.channel(channelName);
    }
    let channel;
    try {
      channel = this._channels[channelName];
    } catch {}
    if (!channel) {
      throw new MarionetteError({
        code: 'MN0021',
        message: 'Radio channel does not exist.'
      });
    }
    channel.reset();
  };

  var RadioMixin = {
    _initRadio() {
      const channelName = getValue(this, 'channelName');
      if (!channelName) {
        return;
      }
      const channel = this._channel = Radio.channel(channelName);
      const radioEvents = getValue(this, 'radioEvents');
      this.bindEvents(channel, radioEvents);
      const radioRequests = getValue(this, 'radioRequests');
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

  const ClassOptions$3 = ['channelName', 'radioEvents', 'radioRequests'];
  const MarionetteObject = function (options) {
    this._setOptions(options, ClassOptions$3);
    this.cid = uniqueId(this.cidPrefix);
    this._initRadio();
    this.initialize.apply(this, arguments);
  };
  MarionetteObject.extend = extend;
  assignOwn(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, {
    cidPrefix: 'mno'
  });

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
      view._disableDetachEvents = disableDetachEvents;
      view.destroy();
      return;
    }
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

  function getBehaviorClass(options) {
    if (options.behaviorClass) {
      return {
        BehaviorClass: options.behaviorClass,
        options
      };
    }
    if (underscore.isFunction(options)) {
      return {
        BehaviorClass: options,
        options: {}
      };
    }
    throw new MarionetteError({
      code: 'MN0016',
      message: 'Unable to get behavior class. A Behavior constructor should be passed directly or as behaviorClass property of options',
      url: 'marionette.behavior.html#defining-and-attaching-behaviors'
    });
  }
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
    _setBehaviorElements() {
      underscore.map(this._behaviors, behavior => behavior.setElement());
    },
    _delegateBehaviorEntityEvents() {
      underscore.map(this._behaviors, behavior => behavior.delegateEntityEvents());
    },
    _undelegateBehaviorEntityEvents() {
      underscore.map(this._behaviors, behavior => behavior.undelegateEntityEvents());
    },
    _destroyBehaviors(options) {
      underscore.map(this._behaviors, behavior => behavior.destroy(options));
    },
    _removeBehavior(behavior) {
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

  var DelegateEntityEventsMixin = {
    _delegateEntityEvents(model, collection) {
      if (model) {
        this._modelEvents = getValue(this, 'modelEvents');
        this.bindEvents(model, this._modelEvents);
      }
      if (collection) {
        this._collectionEvents = getValue(this, 'collectionEvents');
        this.bindEvents(collection, this._collectionEvents);
      }
    },
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
    _deleteEntityEventHandlers() {
      delete this._modelEvents;
      delete this._collectionEvents;
    }
  };

  var TemplateRenderMixin = {
    _renderTemplate(template) {
      const data = this.mixinTemplateContext(this.serializeData()) || {};
      const html = this._renderHtml(template, data);
      if (typeof html !== 'undefined') {
        this.attachElContent(html);
      }
    },
    getTemplate() {
      return this.template;
    },
    mixinTemplateContext(serializedData) {
      const templateContext = getValue(this, 'templateContext');
      if (!templateContext) {
        return serializedData;
      }
      if (!serializedData) {
        return templateContext;
      }
      return assignOwn({}, serializedData, templateContext);
    },
    serializeData() {
      if (this.model) {
        return this.serializeModel();
      }
      if (this.collection) {
        return {
          items: this.serializeCollection()
        };
      }
    },
    serializeModel() {
      return this.model.attributes;
    },
    serializeCollection() {
      return this.collection.models.map(model => model.attributes);
    },
    _renderHtml(template, data) {
      return template(data);
    },
    attachElContent(html) {
      this.Dom.setContents(this.el, html);
    }
  };

  function eachOwn(object, iteratee) {
    if (object == null) {
      return object;
    }
    const keys = Object.keys(object);
    for (const key of keys) {
      iteratee(object[key], key, object);
    }
    return object;
  }

  const normalizeUIKeys = function (hash, ui) {
    const normalizedHash = {};
    eachOwn(hash, (val, key) => {
      const normalizedKey = normalizeUIString(key, ui);
      setProperty(normalizedHash, normalizedKey, val);
    });
    return normalizedHash;
  };
  const uiRegEx = /@ui\.[a-zA-Z-_$0-9]*/g;
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const normalizeUIString = function (uiString, ui) {
    return uiString.replace(uiRegEx, r => {
      const name = r.slice(4);
      if (!name) {
        throw new MarionetteError({
          code: 'MN0018',
          message: 'The ui reference must include a key name.'
        });
      }
      const hasSelector = ui && hasOwnProperty.call(ui, name);
      const selector = hasSelector ? ui[name] : undefined;
      if (!hasSelector) {
        throw new MarionetteError({
          code: 'MN0018',
          message: `The ui reference "${name}" must be declared as an own ui key.`
        });
      }
      if (!isString(selector)) {
        throw new MarionetteError({
          code: 'MN0018',
          message: `The ui reference "${name}" must be a string selector.`
        });
      }
      return selector;
    });
  };
  const normalizeUIValues = function (hash, ui, property) {
    eachOwn(hash, (val, key) => {
      if (isString(val)) {
        hash[key] = normalizeUIString(val, ui);
      } else if (val) {
        const propertyVal = val[property];
        if (isString(propertyVal)) {
          val[property] = normalizeUIString(propertyVal, ui);
        }
      }
    });
    return hash;
  };
  var UIMixin = {
    normalizeUIKeys(hash, uiBindings = this._getUIBindings()) {
      return normalizeUIKeys(hash, uiBindings);
    },
    normalizeUIString(uiString, uiBindings = this._getUIBindings()) {
      return normalizeUIString(uiString, uiBindings);
    },
    normalizeUIValues(hash, property, uiBindings = this._getUIBindings()) {
      return normalizeUIValues(hash, uiBindings, property);
    },
    _getUIBindings() {
      const uiBindings = getValue(this, '_uiBindings');
      return uiBindings || getValue(this, 'ui');
    },
    _bindUIElements() {
      if (!this.ui) {
        return;
      }
      if (!this._uiBindings) {
        this._uiBindings = this.ui;
      }
      const bindings = getValue(this, '_uiBindings');
      this._ui = {};
      eachOwn(bindings, (selector, key) => {
        setProperty(this._ui, key, this.$(selector));
      });
      this.ui = this._ui;
    },
    _unbindUIElements() {
      if (!this.ui || !this._uiBindings) {
        return;
      }
      eachOwn(this.ui, ($el, name) => {
        delete this.ui[name];
      });
      this.ui = this._uiBindings;
      delete this._uiBindings;
      delete this._ui;
    },
    _getUI(name) {
      if (!this.ui) {
        throw new MarionetteError({
          code: 'MN0023',
          message: 'A ui map must be declared before calling getUI().'
        });
      }
      if (!this._ui) {
        throw new MarionetteError({
          code: 'MN0023',
          message: 'UI elements must be bound before calling getUI().'
        });
      }
      return this._ui[name];
    }
  };

  const FEATURES = {
    childViewEventPrefix: false,
    triggersStopPropagation: true,
    triggersPreventDefault: true
  };
  function isEnabled(name) {
    return !!FEATURES[name];
  }
  function setEnabled(name, state) {
    return FEATURES[name] = state;
  }

  function setEventDelegator$1(mixin) {
    this.prototype.EventDelegator = assignOwn({}, this.prototype.EventDelegator, mixin);
    return this;
  }
  var EventDelegator = {
    shouldCapture(eventName) {
      return ['focus', 'blur'].indexOf(eventName) !== -1;
    },
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
    undelegateAll({
      events,
      rootEl
    }) {
      if (!rootEl) {
        return;
      }
      for (let index = 0, length = events.length; index < length; index++) {
        const {
          eventName,
          handler
        } = events[index];
        const shouldCapture = this.shouldCapture(eventName);
        rootEl.removeEventListener(eventName, handler, shouldCapture);
      }
      events.length = 0;
    }
  };

  const delegateEventSplitter = /^(\S+)\s*(.*)$/;
  function buildViewTrigger(view, triggerDef) {
    if (isString(triggerDef)) {
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
      if (!this.events && !this.triggers) {
        return;
      }
      const uiBindings = this._getUIBindings();
      const delegates = [];
      this._delegateEvents(delegates, uiBindings);
      this._delegateTriggers(delegates, uiBindings, view);
      for (let index = 0; index < delegates.length; index += 2) {
        this._delegate(delegates[index], delegates[index + 1]);
      }
    },
    _delegateEvents(delegates, uiBindings) {
      if (!this.events) {
        return;
      }
      eachOwn(getValue(this, 'events'), (handler, key) => {
        handler = resolveMethod(this, handler, key);
        delegates.push(handler.bind(this), this.normalizeUIString(key, uiBindings));
      });
    },
    _delegateTriggers(delegates, uiBindings, view) {
      if (!this.triggers) {
        return;
      }
      eachOwn(getValue(this, 'triggers'), (value, key) => {
        delegates.push(buildViewTrigger(view, value), this.normalizeUIString(key, uiBindings));
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

  const objectKeys = Object.keys;
  function setDomApi$1(mixin) {
    this.prototype.Dom = assignOwn({}, this.prototype.Dom, mixin);
    return this;
  }
  var DomApi = {
    createElement(tagName) {
      return document.createElement(tagName);
    },
    createBuffer() {
      return document.createDocumentFragment();
    },
    getDocumentEl(el) {
      return el.ownerDocument.documentElement;
    },
    findEl(el, selector) {
      return el.querySelectorAll(selector);
    },
    hasEl(el, childEl) {
      return el.contains(childEl && childEl.parentNode);
    },
    detachEl(el) {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    },
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
    setContents(el, html) {
      el.innerHTML = html;
    },
    setAttributes(el, attrs) {
      const attrsType = typeof attrs;
      if (attrs == null || attrsType !== 'object' && attrsType !== 'function') {
        return;
      }
      const attrNames = objectKeys(attrs);
      for (let index = 0, length = attrNames.length; index < length; index++) {
        const attr = attrNames[index];
        if (attr in el) {
          setProperty(el, attr, attrs[attr]);
        } else {
          el.setAttribute(attr, attrs[attr]);
        }
      }
    },
    appendContents(el, contents) {
      el.appendChild(contents);
    },
    hasContents(el) {
      return !!el && el.hasChildNodes();
    },
    detachContents(el) {
      el.textContent = '';
    }
  };

  const classErrorName$3 = 'ViewError';
  const ViewMixin = {
    tagName: 'div',
    preinitialize() {},
    Dom: DomApi,
    _validateEl(el) {
      if (!underscore.isString(el)) {
        return el;
      }
      throw new MarionetteError({
        code: 'MN0001',
        name: classErrorName$3,
        message: `View "el" must be a DOM element. Resolve selector strings at the call site, e.g. \`document.querySelector('${el}')\`. (Region still accepts selector strings.)`,
        url: 'marionette.view.html#specifying-an-el'
      });
    },
    _getEl() {
      const elOption = underscore.result(this, 'el');
      if (!elOption) {
        const el = this.Dom.createElement(underscore.result(this, 'tagName'));
        const attrs = assignOwn({}, underscore.result(this, 'attributes'));
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
    delegateEntityEvents() {
      this._delegateEntityEvents(this.model, this.collection);
      this._delegateBehaviorEntityEvents();
      return this;
    },
    undelegateEntityEvents() {
      this._undelegateEntityEvents(this.model, this.collection);
      this._undelegateBehaviorEntityEvents();
      return this;
    },
    destroy(options) {
      if (this._isDestroyed || this._isDestroying) {
        return this;
      }
      this._isDestroying = true;
      const shouldTriggerDetach = this._isAttached && !this._disableDetachEvents;
      try {
        this.triggerMethod('before:destroy', this, options);
      } catch (error) {
        delete this._isDestroying;
        throw error;
      }
      if (shouldTriggerDetach) {
        this.triggerMethod('before:detach', this);
      }
      this.unbindUIElements();
      this._undelegateViewEvents();
      this.Dom.detachEl(this.el);
      if (shouldTriggerDetach) {
        this._isAttached = false;
        this.triggerMethod('detach', this);
      }
      this._removeChildren();
      this._isDestroyed = true;
      this._isRendered = false;
      this._destroyBehaviors(options);
      this._deleteEntityEventHandlers();
      this.triggerMethod('destroy', this, options);
      this._triggerEventOnBehaviors('destroy', this, options);
      this.stopListening();
      return this;
    },
    bindUIElements() {
      this._bindUIElements();
      this._bindBehaviorUIElements();
      return this;
    },
    unbindUIElements() {
      this._unbindUIElements();
      this._unbindBehaviorUIElements();
      return this;
    },
    getUI(name) {
      return this._getUI(name);
    },
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
      const childViewEvents = this._childViewEvents;
      if (childViewEvents && childViewEvents[eventName]) {
        childViewEvents[eventName].apply(this, args);
      }
      const childViewTriggers = this._childViewTriggers;
      if (childViewTriggers && childViewTriggers[eventName]) {
        this.triggerMethod(childViewTriggers[eventName], ...args);
      }
      if (this._eventPrefix) {
        this.triggerMethod(this._eventPrefix + eventName, ...args);
      }
    }
  };
  underscore.extend(ViewMixin, BehaviorsMixin, CommonMixin, DelegateEntityEventsMixin, TemplateRenderMixin, UIMixin, ViewEventsMixin);

  function setRenderer$1(renderer) {
    this.prototype._renderHtml = renderer;
    return this;
  }

  const classErrorName$2 = 'RegionError';
  function setRegion(regions, definition, name) {
    Object.defineProperty(regions, name, {
      configurable: true,
      enumerable: true,
      value: definition,
      writable: true
    });
    return regions;
  }
  function getOwnRegion(regions, name) {
    try {
      return Object.getOwnPropertyDescriptor(regions, name)?.value;
    } catch {}
  }
  function getRequiredRegion(region, name) {
    if (region) {
      return region;
    }
    const type = typeof name;
    const label = name === null || type !== 'object' && type !== 'function' ? ` "${String(name)}"` : '';
    throw new MarionetteError({
      code: 'MN0020',
      name: classErrorName$2,
      message: `Region${label} does not exist.`
    });
  }
  const RegionClassOptions = ['allowMissingEl', 'parentEl', 'replaceElement'];
  const Region = function (options) {
    this._setOptions(options, RegionClassOptions);
    this.cid = uniqueId(this.cidPrefix);
    this._initEl = this.el = this.getOption('el');
    this._validateEl(this.el);
    this.initialize.apply(this, arguments);
  };
  Region.extend = extend;
  Region.setDomApi = setDomApi$1;
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
        code: 'MN0002',
        name: classErrorName$2,
        message: 'Region "el" must be a selector string or DOM element.',
        url: 'marionette.region.html#additional-options'
      });
    },
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
          code: 'MN0003',
          name: classErrorName$2,
          message: 'View is already shown in a Region or CollectionView',
          url: 'marionette.region.html#showing-a-view'
        });
      }
      this._isSwappingView = !!this.currentView;
      this.triggerMethod('before:show', this, view, options);
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
          code: 'MN0004',
          name: classErrorName$2,
          message: 'An "el" must be specified for a region.',
          url: 'marionette.region.html#additional-options'
        });
      }
      this.el = this.getEl(el);
    },
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
      this._proxyChildViewEvents(view);
      view.on('destroy', this._empty, this);
    },
    _proxyChildViewEvents(view) {
      const parentView = this._parentView;
      if (!parentView) {
        return;
      }
      parentView._proxyChildViewEvents(view);
    },
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
      }
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
            code: 'MN0005',
            name: classErrorName$2,
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
          code: 'MN0006',
          name: classErrorName$2,
          message: 'The view passed is undefined and therefore invalid. You must pass a view instance to show.',
          url: 'marionette.region.html#showing-a-view'
        });
      }
      if (view._isDestroyed) {
        throw new MarionetteError({
          code: 'MN0007',
          name: classErrorName$2,
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
    getEl(el) {
      const context = underscore.result(this, 'parentEl');
      return this.Dom.findEl(context || document, el)[0];
    },
    _replaceEl(view) {
      this._restoreEl();
      view.on('before:destroy', this._restoreEl, this);
      this.Dom.replaceEl(view.el, this.el);
      this._isReplaced = true;
    },
    _restoreEl() {
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
    isReplaced() {
      return !!this._isReplaced;
    },
    isSwappingView() {
      return !!this._isSwappingView;
    },
    attachHtml(view) {
      this.Dom.appendContents(this.el, view.el);
    },
    empty(options = {
      allowMissingEl: true
    }) {
      const view = this.currentView;
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
    destroyView(view) {
      if (view._isDestroyed) {
        return view;
      }
      destroyView(view, this._shouldDisableMonitoring());
      return view;
    },
    removeView(view) {
      this.destroyView(view);
    },
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
    detachHtml() {
      this.Dom.detachContents(this.el);
    },
    hasView() {
      return !!this.currentView;
    },
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
    destroy(options) {
      if (this._isDestroyed || this._isDestroying) {
        return this;
      }
      this._isDestroying = true;
      try {
        this.triggerMethod('before:destroy', this, options);
      } catch (error) {
        delete this._isDestroying;
        throw error;
      }
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
  function buildRegion(definition, defaults) {
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
      code: 'MN0008',
      message: 'Improper region configuration type.',
      url: 'marionette.region.html#defining-regions'
    });
  }
  function buildRegionFromObject(defaults, definition) {
    const options = assignOwn({}, defaults, definition);
    const RegionClass = options.regionClass;
    delete options.regionClass;
    return new RegionClass(options);
  }
  const RegionsMixin = {
    regionClass: Region,
    _initRegions() {
      this.regions = this.regions || {};
      this._regions = Object.create(null);
      this.addRegions(underscore.result(this, 'regions'));
    },
    _reInitRegions() {
      underscore.each(this._regions, region => region.reset());
    },
    addRegion(name, definition) {
      const regions = setRegion({}, definition, name);
      return this.addRegions(regions)[name];
    },
    addRegions(regions) {
      if (underscore.isEmpty(regions)) {
        return;
      }
      regions = this.normalizeUIValues(regions, 'el');
      this.regions = underscore.reduce(regions, setRegion, underscore.reduce(this.regions, setRegion, {}));
      return this._addRegions(regions);
    },
    _addRegions(regionDefinitions) {
      const defaults = {
        regionClass: this.regionClass,
        parentEl: underscore.partial(underscore.result, this, 'el')
      };
      return underscore.reduce(regionDefinitions, (regions, definition, name) => {
        const region = buildRegion(definition, defaults);
        setRegion(regions, region, name);
        this._addRegion(region, name);
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
    removeRegion(name) {
      const region = getRequiredRegion(getOwnRegion(this._regions, name), name);
      this._removeRegion(region, name);
      return region;
    },
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
    _removeReferences(name) {
      delete this.regions[name];
      delete this._regions[name];
    },
    emptyRegions() {
      const regions = this.getRegions();
      underscore.each(regions, region => region.empty());
      return regions;
    },
    hasRegion(name) {
      return !!this.getRegion(name);
    },
    getRegion(name) {
      if (!this._isRendered) {
        this.render();
      }
      return getOwnRegion(this._regions, name);
    },
    _getRegions() {
      return underscore.reduce(this._regions, setRegion, {});
    },
    getRegions() {
      if (!this._isRendered) {
        this.render();
      }
      return this._getRegions();
    },
    showChildView(name, view, options) {
      const region = getRequiredRegion(this.getRegion(name), name);
      region.show(view, options);
      return view;
    },
    detachChildView(name) {
      return getRequiredRegion(this.getRegion(name), name).detachView();
    },
    getChildView(name) {
      return getRequiredRegion(this.getRegion(name), name).currentView;
    }
  };
  const ViewClassOptions = ['attributes', 'behaviors', 'childViewEventPrefix', 'childViewEvents', 'childViewTriggers', 'className', 'collection', 'collectionEvents', 'el', 'events', 'id', 'model', 'modelEvents', 'regionClass', 'regions', 'tagName', 'template', 'templateContext', 'triggers', 'ui'];
  function childReducer(children, region) {
    if (region.currentView) {
      children.push(region.currentView);
    }
    return children;
  }
  const View = function (options) {
    this.cid = uniqueId(this.cidPrefix);
    this._setOptions(options, ViewClassOptions);
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
    setRenderer: setRenderer$1,
    setDomApi: setDomApi$1,
    setEventDelegator: setEventDelegator$1
  });
  underscore.extend(View.prototype, ViewMixin, RegionsMixin, {
    cidPrefix: 'mnv',
    setElement(element) {
      this._undelegateViewEvents();
      this.el = this._validateEl(element);
      this._setBehaviorElements();
      this._isRendered = this.Dom.hasContents(this.el);
      this._isAttached = this._isElAttached();
      if (this._isRendered) {
        this.bindUIElements();
      }
      this._delegateViewEvents();
      return this;
    },
    render() {
      const template = this.getTemplate();
      if (template === false || this._isDestroyed) {
        return this;
      }
      this.triggerMethod('before:render', this);
      if (this._isRendered) {
        this._reInitRegions();
      }
      this._renderTemplate(template);
      this.bindUIElements();
      this._isRendered = true;
      this.triggerMethod('render', this);
      return this;
    },
    _removeChildren() {
      this.removeRegions();
    },
    _getImmediateChildren() {
      return underscore.reduce(this._regions, childReducer, []);
    }
  });

  const classErrorName$1 = 'CollectionViewError';
  const Container = function () {
    this._init();
  };
  function assertFunction(callback) {
    if (typeof callback !== 'function') {
      throw new MarionetteError({
        code: 'MN0024',
        name: classErrorName$1,
        message: 'ChildViewContainer callback must be a function.'
      });
    }
  }
  function assertCount(count) {
    if (!Number.isInteger(count) || count < 0) {
      throw new MarionetteError({
        code: 'MN0024',
        name: classErrorName$1,
        message: 'ChildViewContainer count must be a nonnegative integer.'
      });
    }
    return count;
  }
  function stringComparator(comparator, view) {
    return view.model && view.model.get(comparator);
  }
  function compareCriteria(left, right) {
    const leftCriteria = left.criteria;
    const rightCriteria = right.criteria;
    if (leftCriteria !== rightCriteria) {
      if (leftCriteria > rightCriteria || leftCriteria === undefined) {
        return 1;
      }
      if (leftCriteria < rightCriteria || rightCriteria === undefined) {
        return -1;
      }
    }
    return left.index - right.index;
  }
  function sortByCriteria(views, comparator, context) {
    const decoratedViews = views.map((view, index) => ({
      criteria: comparator.call(context, view),
      index,
      view
    }));
    decoratedViews.sort(compareCriteria);
    return decoratedViews.map(({
      view
    }) => view);
  }
  Object.assign(Container.prototype, {
    each(callback, context) {
      assertFunction(callback);
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        callback.call(context, this._views[index], index);
      }
      return this;
    },
    map(callback, context) {
      assertFunction(callback);
      const length = this._views.length;
      const results = Array(length);
      for (let index = 0; index < length; index++) {
        results[index] = callback.call(context, this._views[index], index);
      }
      return results;
    },
    reduce(callback, initialValue, context) {
      assertFunction(callback);
      const length = this._views.length;
      const hasInitialValue = arguments.length > 1;
      let index = 0;
      let accumulator = initialValue;
      if (!hasInitialValue) {
        if (!length) {
          throw new MarionetteError({
            code: 'MN0024',
            name: classErrorName$1,
            message: 'Reduce of empty ChildViewContainer with no initial value.'
          });
        }
        accumulator = this._views[index++];
      }
      for (; index < length; index++) {
        accumulator = callback.call(context, accumulator, this._views[index], index);
      }
      return accumulator;
    },
    find(predicate, context) {
      assertFunction(predicate);
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        const view = this._views[index];
        if (predicate.call(context, view, index)) {
          return view;
        }
      }
    },
    filter(predicate, context) {
      assertFunction(predicate);
      const results = [];
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        const view = this._views[index];
        if (predicate.call(context, view, index)) {
          results.push(view);
        }
      }
      return results;
    },
    reject(predicate, context) {
      assertFunction(predicate);
      const results = [];
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        const view = this._views[index];
        if (!predicate.call(context, view, index)) {
          results.push(view);
        }
      }
      return results;
    },
    every(predicate, context) {
      assertFunction(predicate);
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        if (!predicate.call(context, this._views[index], index)) {
          return false;
        }
      }
      return true;
    },
    some(predicate, context) {
      assertFunction(predicate);
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        if (predicate.call(context, this._views[index], index)) {
          return true;
        }
      }
      return false;
    },
    contains(view) {
      return this._views.indexOf(view) !== -1;
    },
    invoke(methodName, ...args) {
      if (typeof methodName !== 'string') {
        throw new MarionetteError({
          code: 'MN0024',
          name: classErrorName$1,
          message: 'ChildViewContainer method name must be a string.'
        });
      }
      const length = this._views.length;
      const results = Array(length);
      for (let index = 0; index < length; index++) {
        const view = this._views[index];
        const method = view[methodName];
        if (typeof method !== 'function') {
          throw new MarionetteError({
            code: 'MN0025',
            name: classErrorName$1,
            message: `Child view method "${methodName}" must be callable.`
          });
        }
        results[index] = method.apply(view, args);
      }
      return results;
    },
    toArray() {
      return this._views.slice();
    },
    first(count) {
      if (count === undefined) {
        return this._views[0];
      }
      return this._views.slice(0, assertCount(count));
    },
    initial(count = 1) {
      const end = Math.max(this._views.length - assertCount(count), 0);
      return this._views.slice(0, end);
    },
    rest(count = 1) {
      return this._views.slice(assertCount(count));
    },
    last(count) {
      if (count === undefined) {
        return this._views[this._views.length - 1];
      }
      const start = Math.max(this._views.length - assertCount(count), 0);
      return this._views.slice(start);
    },
    without(...excludedViews) {
      const results = [];
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        const view = this._views[index];
        if (excludedViews.indexOf(view) === -1) {
          results.push(view);
        }
      }
      return results;
    },
    isEmpty() {
      return this._views.length === 0;
    },
    pluck(key) {
      const length = this._views.length;
      const results = Array(length);
      for (let index = 0; index < length; index++) {
        results[index] = this._views[index][key];
      }
      return results;
    },
    partition(predicate, context) {
      assertFunction(predicate);
      const matching = [];
      const rejected = [];
      const length = this._views.length;
      for (let index = 0; index < length; index++) {
        const view = this._views[index];
        (predicate.call(context, view, index) ? matching : rejected).push(view);
      }
      return [matching, rejected];
    },
    _init() {
      this._views = [];
      this._viewsByCid = {};
      this._indexByModel = {};
      this._updateLength();
    },
    _add(view, index = this._views.length) {
      this._addViewIndexes(view);
      this._views.splice(index, 0, view);
      this._updateLength();
    },
    _addViewIndexes(view) {
      this._viewsByCid[view.cid] = view;
      if (view.model) {
        this._indexByModel[view.model.cid] = view;
      }
    },
    _sort(comparator, context) {
      if (typeof comparator === 'string') {
        return this._sortBy(view => stringComparator(comparator, view));
      }
      if (comparator.length === 1) {
        return this._sortBy(comparator, context);
      }
      return this._views.sort(comparator.bind(context));
    },
    _sortBy(comparator, context) {
      const sortedViews = sortByCriteria(this._views, comparator, context);
      this._set(sortedViews);
      return sortedViews;
    },
    _set(views, shouldReset) {
      this._views.length = 0;
      this._views.push.apply(this._views, views.slice(0));
      if (shouldReset) {
        this._viewsByCid = {};
        this._indexByModel = {};
        for (const view of views) {
          this._addViewIndexes(view);
        }
        this._updateLength();
      }
    },
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
    findByModel(model) {
      return this.findByModelCid(model.cid);
    },
    findByModelCid(modelCid) {
      return this._indexByModel[modelCid];
    },
    findByIndex(index) {
      return this._views[index];
    },
    findIndexByView(view) {
      return this._views.indexOf(view);
    },
    findByCid(cid) {
      return this._viewsByCid[cid];
    },
    hasView(view) {
      return !!this.findByCid(view.cid);
    },
    _remove(view) {
      if (!this._viewsByCid[view.cid]) {
        return;
      }
      if (view.model) {
        delete this._indexByModel[view.model.cid];
      }
      delete this._viewsByCid[view.cid];
      const index = this.findIndexByView(view);
      this._views.splice(index, 1);
      this._updateLength();
    },
    _updateLength() {
      this.length = this._views.length;
    }
  });
  Container.prototype[Symbol.iterator] = function () {
    return this._views[Symbol.iterator]();
  };

  const classErrorName = 'CollectionViewError';
  function isEmptyViewClass(view) {
    if (!underscore.isFunction(view) || !view.prototype) {
      return false;
    }
    const {
      render,
      destroy
    } = view.prototype;
    return underscore.isFunction(render) && (destroy ? underscore.isFunction(destroy) : underscore.isFunction(view.prototype.remove));
  }
  function isClassDefinition(view) {
    return /^class(?:\s|\/[/*])/.test(Function.prototype.toString.call(view));
  }
  const ClassOptions$2 = ['attributes', 'behaviors', 'childView', 'childViewContainer', 'childViewEventPrefix', 'childViewEvents', 'childViewOptions', 'childViewTriggers', 'className', 'collection', 'collectionEvents', 'el', 'emptyView', 'emptyViewOptions', 'events', 'id', 'model', 'modelEvents', 'sortWithCollection', 'tagName', 'template', 'templateContext', 'triggers', 'ui', 'viewComparator', 'viewFilter'];
  const CollectionView = function (options) {
    this.cid = uniqueId(this.cidPrefix);
    this._setOptions(options, ClassOptions$2);
    this.preinitialize.apply(this, arguments);
    this._initViewEvents();
    this.setElement(this._getEl());
    monitorViewEvents(this);
    this._initChildViewStorage();
    this._initBehaviors();
    this._buildEventProxies();
    this.getEmptyRegion();
    this.initialize.apply(this, arguments);
    this.delegateEntityEvents();
    this._triggerEventOnBehaviors('initialize', this, options);
  };
  underscore.extend(CollectionView, {
    extend,
    setRenderer: setRenderer$1,
    setDomApi: setDomApi$1,
    setEventDelegator: setEventDelegator$1
  });
  underscore.extend(CollectionView.prototype, ViewMixin, {
    cidPrefix: 'mncv',
    sortWithCollection: true,
    _initChildViewStorage() {
      this._children = new Container();
      this.children = new Container();
    },
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
    _onCollectionSort(collection, {
      add,
      merge,
      remove
    }) {
      if (!this.sortWithCollection || this.viewComparator === false) {
        return;
      }
      if (add || remove || merge) {
        return;
      }
      this.sort();
    },
    _onCollectionReset() {
      this._destroyChildren();
      this._addChildModels(this.collection.models);
      this.sort();
    },
    _onCollectionUpdate(collection, options) {
      const changes = options.changes;
      const removedViews = changes.removed.length && this._removeChildModels(changes.removed);
      this._addedViews = changes.added.length && this._addChildModels(changes.added);
      this._detachChildren(removedViews);
      this.sort();
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
    _getChildView(child) {
      let childView = this.childView;
      if (!childView) {
        throw new MarionetteError({
          code: 'MN0011',
          name: classErrorName,
          message: 'A "childView" must be specified',
          url: 'marionette.collectionview.html#collectionviews-childview'
        });
      }
      childView = this._getView(childView, child);
      if (!childView) {
        throw new MarionetteError({
          code: 'MN0012',
          name: classErrorName,
          message: '"childView" must be a view class or a function that returns a view class',
          url: 'marionette.collectionview.html#collectionviews-childview'
        });
      }
      return childView;
    },
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
    buildChildView(child, ChildViewClass, childViewOptions) {
      const options = assignOwn({
        model: child
      }, childViewOptions);
      return new ChildViewClass(options);
    },
    _setupChildView(view) {
      monitorViewEvents(view);
      view.on('destroy', this.removeChildView, this);
      this._proxyChildViewEvents(view);
    },
    _getImmediateChildren() {
      return this.children._views;
    },
    setElement(element) {
      this._undelegateViewEvents();
      this.el = this._validateEl(element);
      this._setBehaviorElements();
      this._isAttached = this._isElAttached();
      this._delegateViewEvents();
      return this;
    },
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
    _getChildViewContainer() {
      const childViewContainer = underscore.result(this, 'childViewContainer');
      this.container = childViewContainer ? this.$(childViewContainer)[0] : this.el;
      if (!this.container) {
        throw new MarionetteError({
          code: 'MN0013',
          name: classErrorName,
          message: `The specified "childViewContainer" was not found: ${childViewContainer}`,
          url: 'marionette.collectionview.html#defining-the-childviewcontainer'
        });
      }
    },
    sort() {
      this._sortChildren();
      this.filter();
      return this;
    },
    _sortChildren() {
      if (!this._children.length) {
        return;
      }
      let viewComparator = this.getComparator();
      if (!viewComparator) {
        return;
      }
      delete this._addedViews;
      this.triggerMethod('before:sort', this);
      this._children._sort(viewComparator, this);
      this.triggerMethod('sort', this);
    },
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
    removeComparator(options) {
      return this.setComparator(null, options);
    },
    getComparator() {
      if (this.viewComparator) {
        return this.viewComparator;
      }
      if (!this.sortWithCollection || this.viewComparator === false || !this.collection) {
        return false;
      }
      return this._viewComparator;
    },
    _viewComparator(view) {
      return this.collection.indexOf(view.model);
    },
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
      }
      delete this._addedViews;
      this.triggerMethod('before:filter', this);
      const attachViews = [];
      const detachViews = [];
      underscore.each(this._children._views, (view, key, children) => {
        (viewFilter.call(this, view, key, children) ? attachViews : detachViews).push(view);
      });
      this._detachChildren(detachViews);
      this.children._set(attachViews, true);
      this.triggerMethod('filter', this, attachViews, detachViews);
    },
    _getFilter() {
      const viewFilter = this.getFilter();
      if (!viewFilter) {
        return false;
      }
      if (underscore.isFunction(viewFilter)) {
        return viewFilter;
      }
      if (underscore.isObject(viewFilter)) {
        const matcher = underscore.matches(viewFilter);
        return function (view) {
          return matcher(view.model && view.model.attributes);
        };
      }
      if (underscore.isString(viewFilter)) {
        return function (view) {
          return view.model && view.model.get(viewFilter);
        };
      }
      throw new MarionetteError({
        code: 'MN0014',
        name: classErrorName,
        message: '"viewFilter" must be a function, predicate object literal, a string indicating a model attribute, or falsy',
        url: 'marionette.collectionview.html#defining-the-viewfilter'
      });
    },
    getFilter() {
      return this.viewFilter;
    },
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
    detachHtml(view) {
      this.Dom.detachEl(view.el);
    },
    _renderChildren() {
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
    _getBuffer(views) {
      const elBuffer = this.Dom.createBuffer();
      underscore.each(views, view => {
        renderView(view);
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
    _getEmptyView() {
      const emptyView = this.emptyView;
      if (emptyView == null || emptyView === false) {
        return;
      }
      if (isEmptyViewClass(emptyView)) {
        return emptyView;
      }
      const EmptyView = underscore.isFunction(emptyView) && !isClassDefinition(emptyView) ? emptyView.call(this) : undefined;
      if (isEmptyViewClass(EmptyView)) {
        return EmptyView;
      }
      throw new MarionetteError({
        code: 'MN0022',
        name: classErrorName,
        message: '"emptyView" must be a view class or a function that returns a view class',
        url: 'marionette.collectionview.html#collectionviews-emptyview'
      });
    },
    _destroyEmptyView() {
      const emptyRegion = this.getEmptyRegion();
      if (emptyRegion.hasView()) {
        emptyRegion.empty();
      }
    },
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
          code: 'MN0015',
          name: classErrorName,
          message: 'Both views must be children of the collection view to swap.',
          url: 'marionette.collectionview.html#swapping-child-views'
        });
      }
      this._children._swap(view1, view2);
      this.Dom.swapEl(view1.el, view2.el);
      if (this.children.hasView(view1) !== this.children.hasView(view2)) {
        this.filter();
      } else {
        this.children._swap(view1, view2);
      }
      return this;
    },
    addChildView(view, index, options = {}) {
      if (!view || view._isDestroyed) {
        return view;
      }
      if (view._isShown) {
        throw new MarionetteError({
          code: 'MN0003',
          name: classErrorName,
          message: 'View is already shown in a Region or CollectionView',
          url: 'marionette.region.html#showing-a-view'
        });
      }
      if (underscore.isObject(index)) {
        options = index;
      }
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
      const isAddedToEnd = !hasIndex || index >= this._children.length;
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
    detachChildView(view) {
      this.removeChildView(view, {
        shouldDetach: true
      });
      return view;
    },
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
    _removeChildren() {
      this._destroyChildren();
      const emptyRegion = this.getEmptyRegion();
      emptyRegion.destroy();
      delete this._addedViews;
    },
    _destroyChildren() {
      if (!this._children.length) {
        return;
      }
      this.triggerMethod('before:destroy:children', this);
      if (this.monitorViewEvents === false) {
        this.Dom.detachContents(this.el);
      }
      this._removeChildViews(this._children._views);
      this._children._init();
      this.children._init();
      this.triggerMethod('destroy:children', this);
    }
  });

  const ClassOptions$1 = ['collectionEvents', 'events', 'modelEvents', 'triggers', 'ui'];
  const Behavior = function (options, view) {
    this.view = view;
    this._setOptions(options, ClassOptions$1);
    this.cid = uniqueId(this.cidPrefix);
    this._initViewEvents();
    this.el = view.el;
    this.ui = assignOwn({}, getValue(this, 'ui'), getValue(view, 'ui'));
    this.setElement();
    this.listenTo(view, 'all', this.triggerMethod);
    this.initialize.apply(this, arguments);
  };
  assignOwn(Behavior, {
    extend,
    setEventDelegator: setEventDelegator$1
  });
  assignOwn(Behavior.prototype, CommonMixin, DelegateEntityEventsMixin, UIMixin, ViewEventsMixin, {
    cidPrefix: 'mnb',
    $() {
      return this.view.$.apply(this.view, arguments);
    },
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
    delegateEntityEvents() {
      this._delegateEntityEvents(this.view.model, this.view.collection);
      return this;
    },
    undelegateEntityEvents() {
      this._undelegateEntityEvents(this.view.model, this.view.collection);
      return this;
    }
  });

  const ClassOptions = ['channelName', 'radioEvents', 'radioRequests', 'region', 'regionClass'];
  const Application = function (options) {
    this._setOptions(options, ClassOptions);
    this.cid = uniqueId(this.cidPrefix);
    this._initRegion();
    this._initRadio();
    this.initialize.apply(this, arguments);
  };
  Application.extend = extend;
  assignOwn(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, {
    cidPrefix: 'mna',
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

  const bindEvents = proxy(bindEvents$1);
  const unbindEvents = proxy(unbindEvents$1);
  const bindRequests = proxy(bindRequests$1);
  const unbindRequests = proxy(unbindRequests$1);
  const mergeOptions = proxy(mergeOptions$1);
  const getOption = proxy(getOption$1);
  const normalizeMethods = proxy(normalizeMethods$1);
  const triggerMethod = proxy(triggerMethod$1);
  const setDomApi = function (mixin) {
    CollectionView.setDomApi(mixin);
    Region.setDomApi(mixin);
    View.setDomApi(mixin);
  };
  const setRenderer = function (renderer) {
    CollectionView.setRenderer(renderer);
    View.setRenderer(renderer);
  };
  const setEventDelegator = function (delegator) {
    Behavior.setEventDelegator(delegator);
    CollectionView.setEventDelegator(delegator);
    View.setEventDelegator(delegator);
  };

  exports.Application = Application;
  exports.Behavior = Behavior;
  exports.CollectionView = CollectionView;
  exports.DomApi = DomApi;
  exports.Events = Events;
  exports.MarionetteError = MarionetteError;
  exports.MnObject = MarionetteObject;
  exports.Radio = Radio;
  exports.Region = Region;
  exports.Requests = Requests;
  exports.VERSION = version;
  exports.View = View;
  exports.bindEvents = bindEvents;
  exports.bindRequests = bindRequests;
  exports.extend = extend;
  exports.getOption = getOption;
  exports.isEnabled = isEnabled;
  exports.mergeOptions = mergeOptions;
  exports.monitorViewEvents = monitorViewEvents;
  exports.normalizeMethods = normalizeMethods;
  exports.setDomApi = setDomApi;
  exports.setEnabled = setEnabled;
  exports.setEventDelegator = setEventDelegator;
  exports.setRenderer = setRenderer;
  exports.triggerMethod = triggerMethod;
  exports.unbindEvents = unbindEvents;
  exports.unbindRequests = unbindRequests;

}));
//# sourceMappingURL=marionette.umd.js.map
