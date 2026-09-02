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

function defineOwnDataProperties(target, source) {
  const type = typeof source;
  if (source == null || type !== 'object' && type !== 'function') {
    return target;
  }
  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(source, key)) {
      continue;
    }
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value: source[key],
      writable: true
    });
  }
  return target;
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
  defineOwnDataProperties(child.prototype, protoProps);
  Object.defineProperty(child.prototype, 'constructor', {
    configurable: true,
    enumerable: true,
    value: child,
    writable: true
  });
  child.__super__ = parent.prototype;
  return child;
}

var version = "5.0.0-alpha.2";

function eachChild(children, iteratee) {
  if (!Array.isArray(children)) {
    return;
  }
  const length = children.length;
  for (let index = 0; index < length; index++) {
    iteratee(children[index]);
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

const eventSplitter = /\s+/;
function buildEventArgs(name, callback, context, listener) {
  if (name && typeof name === 'object') {
    const eventContext = context === undefined ? callback : context;
    const eventArgs = [];
    const names = Object.keys(name);
    for (let i = 0; i < names.length; i++) {
      const key = names[i];
      const args = buildEventArgs(key, name[key], eventContext, listener);
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
function triggerMethod(event, ...args) {
  const methodName = getOnMethodName(event);
  const method = getOption.call(this, methodName);
  let result;
  if (typeof method === 'function') {
    result = method.apply(this, args);
  }
  this.trigger.apply(this, arguments);
  return result;
}

const objectKeys$4 = Object.keys;
let listening;
function getKeys$1(object) {
  return object == null ? [] : objectKeys$4(object);
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
  const listener = listening;
  events = onApi({
    events,
    name,
    callback,
    context,
    ctx: this,
    listener
  });
  if (listener) {
    const listeners = this._rdListeners || (this._rdListeners = {});
    listeners[listener.listenerId] = listener;
    listener.count++;
    listener.interop = false;
  }
  return events;
};
const cleanupListener = function ({
  obj,
  listeneeId,
  listenerId,
  listeningTo
}) {
  delete listeningTo[listeneeId];
  if (obj._rdListeners) {
    delete obj._rdListeners[listenerId];
  }
};
const offReducer = function (events, {
  name,
  callback,
  context
}) {
  const names = name ? [name] : getKeys$1(events);
  for (let nameIndex = 0, namesLength = names.length; nameIndex < namesLength; nameIndex++) {
    const key = names[nameIndex];
    const handlers = Object.hasOwn(events, key) ? events[key] : undefined;
    if (!handlers) {
      continue;
    }
    const remaining = [];
    for (let index = 0, length = handlers.length; index < length; index++) {
      const handler = handlers[index];
      if (callback && callback !== handler.callback && callback !== handler.callback._callback || context && context !== handler.context) {
        remaining.push(handler);
        continue;
      }
      if (handler.listener) {
        const listener = handler.listener;
        listener.count--;
        if (!listener.count) {
          cleanupListener(listener);
        }
      }
    }
    events[key] = remaining;
    if (!events[key].length) {
      delete events[key];
    }
  }
  return events;
};
const getListener = function (obj, listenerObj) {
  const listeneeId = obj._rdListenId || (obj._rdListenId = uniqueId('l'));
  const listeningTo = listenerObj._rdListeningTo || (listenerObj._rdListeningTo = {});
  const listener = listeningTo[listeneeId];
  if (!listener) {
    const listenerId = listenerObj._rdListenId || (listenerObj._rdListenId = uniqueId('l'));
    listeningTo[listeneeId] = {
      obj,
      listeneeId,
      listenerId,
      listeningTo,
      count: 0,
      interop: true,
      _rdEvents: {}
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
  const previousListening = listening;
  listening = listener;
  try {
    listener.obj.on(name, callback, context);
  } finally {
    listening = previousListening;
  }
  if (listener.interop) {
    listener._rdEvents = onApi({
      events: listener._rdEvents,
      name,
      callback,
      context,
      ctx: context
    });
  }
};
function buildOnceMap(eventArgs, offer) {
  const events = {};
  for (let index = 0, length = eventArgs.length; index < length; index++) {
    const {
      name,
      callback
    } = eventArgs[index];
    if (!callback) {
      continue;
    }
    const onceCallback = onceWrap(callback, callbackToRemove => {
      offer(name, callbackToRemove);
    });
    setProperty(events, name, onceCallback);
  }
  return events;
}
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
  for (let index = 0, length = events.length; index < length; index++) {
    const {
      callback,
      ctx
    } = events[index];
    callHandler(callback, ctx, args);
  }
};
function reduceEventArgs(context, eventArgs, events, reducer) {
  for (let index = 0, length = eventArgs.length; index < length; index++) {
    events = reducer.call(context, events, eventArgs[index]);
  }
  return events;
}
const Events = {
  on(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);
    this._rdEvents = reduceEventArgs(this, eventArgs, this._rdEvents || {}, onReducer);
    return this;
  },
  off(name, callback, context) {
    if (!this._rdEvents) {
      return this;
    }
    if (!name && !context && !callback) {
      this._rdEvents = void 0;
      const listeners = this._rdListeners;
      const listenerIds = getKeys$1(listeners);
      for (let index = 0, length = listenerIds.length; index < length; index++) {
        const listenerId = listenerIds[index];
        cleanupListener(listeners[listenerId]);
      }
      return this;
    }
    const eventArgs = buildEventArgs(name, callback, context);
    this._rdEvents = reduceEventArgs(undefined, eventArgs, this._rdEvents, offReducer);
    return this;
  },
  once(name, callback, context) {
    const eventArgs = buildEventArgs(name, callback, context);
    const events = buildOnceMap(eventArgs, this.off.bind(this));
    if (typeof name === 'string' && context == null) {
      callback = undefined;
    }
    return this.on(events, callback, context);
  },
  listenTo(obj, name, callback) {
    if (!obj) {
      return this;
    }
    const listener = getListener(obj, this);
    const eventArgs = buildEventArgs(name, callback, this, listener);
    for (let index = 0, length = eventArgs.length; index < length; index++) {
      listenToApi(eventArgs[index]);
    }
    return this;
  },
  listenToOnce(obj, name, callback) {
    const eventArgs = buildEventArgs(name, callback, this);
    const events = buildOnceMap(eventArgs, this.stopListening.bind(this, obj));
    return this.listenTo(obj, events);
  },
  stopListening(obj, name, callback) {
    const listeningTo = this._rdListeningTo;
    if (!listeningTo) {
      return this;
    }
    const eventArgs = buildEventArgs(name, callback, this);
    const listenerIds = obj ? [obj._rdListenId] : getKeys$1(listeningTo);
    for (let i = 0, listenerIdsLength = listenerIds.length; i < listenerIdsLength; i++) {
      const listener = listeningTo[listenerIds[i]];
      if (!listener) {
        break;
      }
      for (let index = 0, length = eventArgs.length; index < length; index++) {
        const args = eventArgs[index];
        listener.obj.off(args.name, args.callback, this);
        if (listener.interop) {
          listener._rdEvents = offReducer(listener._rdEvents, args);
          if (!getKeys$1(listener._rdEvents).length) {
            cleanupListener(listener);
          }
        }
      }
    }
    return this;
  },
  trigger(name, ...args) {
    if (!this._rdEvents) {
      return this;
    }
    if (name && typeof name === 'object') {
      const names = getKeys$1(name);
      for (let index = 0, length = names.length; index < length; index++) {
        const key = names[index];
        triggerApi({
          events: this._rdEvents,
          name: key,
          args: [name[key]]
        });
      }
      return this;
    }
    if (name && eventSplitter.test(name)) {
      const names = name.split(eventSplitter);
      for (let index = 0, length = names.length; index < length; index++) {
        const n = names[index];
        triggerApi({
          events: this._rdEvents,
          name: n,
          args
        });
      }
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

function getValue(object, property, fallback) {
  const value = object == null ? undefined : object[property];
  const resolvedValue = value === undefined ? fallback : value;
  return typeof resolvedValue === 'function' ? resolvedValue.call(object) : resolvedValue;
}

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

const objectKeys$3 = Object.keys;
function getKeys(object) {
  const type = typeof object;
  return object != null && (type === 'object' || type === 'function') ? objectKeys$3(object) : [];
}
const registerReply = function (requests, name, callback, context) {
  if (Object.hasOwn(requests, name)) {
    debugLog('A request was overwritten', name, this.channelName);
  }
  setProperty(requests, name, {
    callback: makeCallback(callback),
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
var Requests = {
  reply(name, callback, context) {
    if (dispatchOverload(this, 'reply', name, callback, context)) {
      return this;
    }
    this._rdRequests = registerReply.call(this, this._rdRequests || {}, name, callback, context);
    return this;
  },
  replyOnce(name, callback, context) {
    if (dispatchOverload(this, 'replyOnce', name, callback, context)) {
      return this;
    }
    const onceCallback = onceWrap(makeCallback(callback), callbackToRemove => {
      this.stopReplying(name, callbackToRemove);
    });
    return this.reply(name, onceCallback, context);
  },
  stopReplying(name, callback, context) {
    if (dispatchOverload(this, 'stopReplying', name, callback, context)) {
      return this;
    }
    if (!this._rdRequests) {
      return this;
    }
    if (!name && !callback && !context) {
      delete this._rdRequests;
      return this;
    }
    this._rdRequests = stopReducer.call(this, this._rdRequests, {
      name,
      callback,
      context
    });
    return this;
  },
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

const propertyIsEnumerable$1 = Object.prototype.propertyIsEnumerable;
const mergeOptions = function (options, keys) {
  if (options == null) {
    return;
  }
  if (!Array.isArray(keys)) {
    throw new MarionetteError({
      code: 'MN0033',
      message: 'The mergeOptions keys argument must be an array.',
      url: 'common.html#mergeoptions'
    });
  }
  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const key = keys[index];
    if (typeof key !== 'string' || !propertyIsEnumerable$1.call(options, key)) {
      continue;
    }
    const option = options[key];
    if (option !== undefined) {
      setProperty(this, key, option);
    }
  }
};

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
const normalizeMethods = function (hash) {
  if (!hash) {
    return;
  }
  const normalizedHash = {};
  for (const name of Object.keys(hash)) {
    setProperty(normalizedHash, name, resolveMethod(this, hash[name], name));
  }
  return normalizedHash;
};

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
function normalizeBindings$1(context, bindings) {
  const bindingsType = typeof bindings;
  if (bindings === null || bindingsType !== 'object' && bindingsType !== 'function') {
    throw new MarionetteError({
      code: 'MN0009',
      message: 'Bindings must be an object.',
      url: 'common.html#bindevents'
    });
  }
  if (propertyIsEnumerable.call(bindings, '__proto__')) {
    throw new MarionetteError({
      code: 'MN0026',
      message: 'Entity event maps cannot include an own "__proto__" event name.',
      url: 'common.html#bindevents'
    });
  }
  return normalizeMethods.call(context, bindings);
}
function bindEvents(entity, bindings) {
  if (!entity || !bindings) {
    return this;
  }
  this.listenTo(entity, normalizeBindings$1(this, bindings));
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
  return normalizeMethods.call(context, bindings);
}
function bindRequests(channel, bindings) {
  if (!channel || !bindings) {
    return this;
  }
  channel.reply(normalizeBindings(this, bindings), this);
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
  channel.stopReplying(normalizeBindings(this, bindings), this);
  return this;
}

const CommonMixin = {
  initialize() {},
  normalizeMethods,
  _setOptions(options, classOptions) {
    this.options = assignOwn({}, getValue(this, 'options'), options);
    this.mergeOptions(options, classOptions);
  },
  mergeOptions,
  getOption,
  bindEvents,
  unbindEvents,
  bindRequests,
  unbindRequests,
  triggerMethod
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

const objectKeys$2 = Object.keys;
const _logs = Object.create(null);
function _partial(channelName) {
  return _logs[channelName] || (_logs[channelName] = log.bind(Radio, channelName));
}
const Radio = {};
assignOwn(Radio, {
  setDebug,
  tuneIn(channelName) {
    const channel = Radio.channel(channelName);
    channel._tunedIn = true;
    channel.on('all', _partial(channelName));
    return Radio;
  },
  tuneOut(channelName) {
    const channel = Radio.channel(channelName);
    channel._tunedIn = false;
    channel.off('all', _partial(channelName));
    delete _logs[channelName];
    return Radio;
  }
});
const _channels = Object.create(null);
Radio.channel = function (channelName) {
  if (!channelName) {
    throw new MarionetteError({
      code: 'MN0017',
      message: 'You must provide a name for the channel.'
    });
  }
  if (_channels[channelName]) {
    return _channels[channelName];
  }
  return _channels[channelName] = new Channel(channelName);
};
function Channel(channelName) {
  this.channelName = channelName;
}
assignOwn(Channel.prototype, Events, Requests, {
  reset() {
    this.off();
    this.stopListening();
    this.stopReplying();
    return this;
  }
});
const systems = [Events, Requests];
for (let systemIndex = 0, systemsLength = systems.length; systemIndex < systemsLength; systemIndex++) {
  const methodNames = objectKeys$2(systems[systemIndex]);
  for (let index = 0, length = methodNames.length; index < length; index++) {
    const methodName = methodNames[index];
    setProperty(Radio, methodName, function (channelName, ...args) {
      const channel = Radio.channel(channelName);
      return callHandler(channel[methodName], channel, args);
    });
  }
}
Radio.reset = function (channelName) {
  if (!arguments.length) {
    const channelNames = objectKeys$2(_channels);
    for (let index = 0, length = channelNames.length; index < length; index++) {
      _channels[channelNames[index]].reset();
    }
    return;
  }
  if (!channelName) {
    Radio.channel(channelName);
  }
  let channel;
  try {
    channel = _channels[channelName];
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

const objectKeys$1 = Object.keys;
function addChange(changedKeys, changed, previous, name, previousValue, value) {
  changedKeys.push(name);
  setProperty(changed, name, value);
  setProperty(previous, name, previousValue);
}
function validateKeys(keys) {
  for (let index = 0, length = keys.length; index < length; index++) {
    const key = keys[index];
    if (typeof key !== 'string' || !eventSplitter.test(key)) {
      continue;
    }
    throw new MarionetteError({
      code: 'MN0034',
      message: 'State keys cannot contain whitespace.',
      url: 'marionette.state.html#state-keys'
    });
  }
}
function updateState(state, attributes, options, removedKeys = []) {
  if (state._isDestroyed) {
    return state;
  }
  const current = state._attributes;
  const changed = {};
  const previous = {};
  const changedKeys = [];
  const attributeKeys = objectKeys$1(attributes);
  validateKeys(removedKeys);
  validateKeys(attributeKeys);
  for (let index = 0, length = removedKeys.length; index < length; index++) {
    const name = removedKeys[index];
    if (!Object.hasOwn(current, name)) {
      continue;
    }
    addChange(changedKeys, changed, previous, name, current[name], undefined);
  }
  for (let index = 0, length = attributeKeys.length; index < length; index++) {
    const name = attributeKeys[index];
    const value = attributes[name];
    if (Object.hasOwn(current, name) && Object.is(current[name], value)) {
      continue;
    }
    addChange(changedKeys, changed, previous, name, current[name], value);
  }
  if (!changedKeys.length) {
    return state;
  }
  for (let index = 0, length = removedKeys.length; index < length; index++) {
    delete current[removedKeys[index]];
  }
  assignOwn(current, attributes);
  if (options?.silent) {
    return state;
  }
  const change = assignOwn({}, options, {
    changed,
    previous
  });
  for (let index = 0, length = changedKeys.length; index < length; index++) {
    const name = changedKeys[index];
    state.trigger(`change:${name}`, state, changed[name], change);
  }
  state.trigger('change', state, change);
  return state;
}
const State = function (attributes) {
  this.cid = uniqueId(this.cidPrefix);
  const stateAttributes = assignOwn({}, getValue(this, 'defaults'), attributes);
  validateKeys(objectKeys$1(stateAttributes));
  this._attributes = stateAttributes;
  this.initialize.apply(this, arguments);
};
State.extend = extend;
assignOwn(State.prototype, Events, {
  cidPrefix: 'mns',
  _isDestroyed: false,
  initialize() {},
  get(key) {
    return Object.hasOwn(this._attributes, key) ? this._attributes[key] : undefined;
  },
  has(key) {
    return Object.hasOwn(this._attributes, key);
  },
  set(key, value, options) {
    if (key == null) {
      return this;
    }
    let attributes;
    if (typeof key === 'object') {
      attributes = key;
      options = value;
    } else {
      attributes = {
        [key]: value
      };
    }
    return updateState(this, attributes, options);
  },
  unset(key, options) {
    if (key == null) {
      return this;
    }
    return updateState(this, {}, options, [key]);
  },
  reset(attributes = {}, options) {
    if (this._isDestroyed) {
      return this;
    }
    const nextAttributes = assignOwn({}, getValue(this, 'defaults'), attributes);
    const removedKeys = objectKeys$1(this._attributes).filter(key => !Object.hasOwn(nextAttributes, key));
    return updateState(this, nextAttributes, options, removedKeys);
  },
  toJSON() {
    return assignOwn({}, this._attributes);
  },
  isDestroyed() {
    return this._isDestroyed;
  },
  destroy() {
    if (this._isDestroyed) {
      return this;
    }
    this._isDestroyed = true;
    this.stopListening();
    this.off();
    return this;
  }
});

function throwStateOwnershipConflict() {
  throw new MarionetteError({
    code: 'MN0035',
    name: 'StateError',
    message: 'A State instance must be live and unowned before composition.',
    url: 'marionette.state.html#owned-state'
  });
}
var StateMixin = {
  _initState(options = {}) {
    const hasStateOption = options != null && Object.hasOwn(options, 'state');
    const state = hasStateOption ? options.state : this.state;
    if (hasStateOption || state !== undefined) {
      this._stateDefinition = state;
      this.getState();
    }
  },
  _initStateEvents() {
    if (this._isDestroyed) {
      return this;
    }
    const stateEvents = getValue(this, 'stateEvents');
    if (stateEvents) {
      this.bindEvents(this.getState(), stateEvents);
    }
    return this;
  },
  getState() {
    if (this._state) {
      return this._state;
    }
    const hasStateDefinition = Object.hasOwn(this, '_stateDefinition');
    const definition = getValue(this, hasStateDefinition ? '_stateDefinition' : 'state');
    delete this._stateDefinition;
    const state = definition instanceof State ? definition : new State(definition);
    if (state._owner !== undefined || state.isDestroyed()) {
      throwStateOwnershipConflict();
    }
    state._owner = this;
    this._state = state;
    if (this._isDestroyed) {
      this._destroyState();
    } else {
      this.on('destroy', this._destroyState);
    }
    return state;
  },
  _destroyState() {
    if (!this._state) {
      return this;
    }
    this.unbindEvents(this._state);
    delete this._state._owner;
    if (!this._state.isDestroyed()) {
      this._state.destroy();
    }
    this.off('destroy', this._destroyState);
    return this;
  }
};

const ClassOptions$3 = ['channelName', 'radioEvents', 'radioRequests', 'stateEvents'];
const MarionetteObject = function (options) {
  this._setOptions(options, ClassOptions$3);
  this.cid = uniqueId(this.cidPrefix);
  this._initRadio();
  this._initState(options);
  try {
    this.initialize.apply(this, arguments);
    this._initStateEvents();
  } catch (error) {
    this._destroyState();
    throw error;
  }
};
MarionetteObject.extend = extend;
assignOwn(MarionetteObject.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, {
  cidPrefix: 'mno'
});

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

function disposeAll(disposers, error) {
  let hasError = arguments.length > 1;
  for (let index = disposers.length - 1; index >= 0; index--) {
    const disposer = disposers[index];
    if (!disposer) {
      continue;
    }
    try {
      disposer();
    } catch (disposalError) {
      if (!hasError) {
        error = disposalError;
        hasError = true;
      }
    }
  }
  if (hasError) {
    throw error;
  }
}

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
  if (typeof options === 'function') {
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
function addBehavior(view, behaviorDefinition, allBehaviors) {
  const {
    BehaviorClass,
    options
  } = getBehaviorClass(behaviorDefinition);
  const behavior = new BehaviorClass(options, view);
  allBehaviors.push(behavior);
  parseBehaviors(view, getValue(behavior, 'behaviors'), allBehaviors);
}
function parseBehaviors(view, behaviors, allBehaviors) {
  if (Array.isArray(behaviors)) {
    for (let index = 0, length = behaviors.length; index < length; index++) {
      addBehavior(view, behaviors[index], allBehaviors);
    }
  } else {
    eachOwn(behaviors, behaviorDefinition => {
      addBehavior(view, behaviorDefinition, allBehaviors);
    });
  }
  return allBehaviors;
}
function mergeBehaviorMaps(behaviors, getMap) {
  if (behaviors == null) {
    return {};
  }
  const length = behaviors.length;
  const maps = Array(length);
  for (let index = 0; index < length; index++) {
    maps[index] = getMap(behaviors[index]);
  }
  const merged = {};
  for (let index = 0; index < length; index++) {
    assignOwn(merged, maps[index]);
  }
  return merged;
}
function eachBehavior(behaviors, iteratee) {
  if (behaviors == null) {
    return;
  }
  for (let index = 0, length = behaviors.length; index < length; index++) {
    iteratee(behaviors[index]);
  }
}
function disposeBehaviors(behaviors, method, options) {
  if (behaviors == null) {
    return;
  }
  disposeAll(behaviors.map(behavior => () => behavior[method](options)).reverse());
}
function rollbackBehaviors(behaviors) {
  for (let index = 0, length = behaviors.length; index < length; index++) {
    try {
      behaviors[index].destroy();
    } catch {}
  }
}
var BehaviorsMixin = {
  _initBehaviors() {
    this._behaviors = [];
    try {
      parseBehaviors(this, getValue(this, 'behaviors'), this._behaviors);
    } catch (error) {
      this._rollbackBehaviors();
      throw error;
    }
  },
  _rollbackBehaviors() {
    rollbackBehaviors(this._behaviors || []);
    this._behaviors = [];
  },
  _getBehaviorTriggers() {
    return mergeBehaviorMaps(this._behaviors, behavior => behavior._getTriggers());
  },
  _getBehaviorEvents() {
    return mergeBehaviorMaps(this._behaviors, behavior => behavior._getEvents());
  },
  _setBehaviorElements() {
    eachBehavior(this._behaviors, behavior => behavior._syncElement());
  },
  _undelegateBehaviorViewEvents() {
    disposeBehaviors(this._behaviors, '_undelegateViewEvents');
  },
  _delegateBehaviorEntityEvents() {
    eachBehavior(this._behaviors, behavior => behavior.delegateEntityEvents());
  },
  _undelegateBehaviorEntityEvents() {
    disposeBehaviors(this._behaviors, 'undelegateEntityEvents');
  },
  _destroyBehaviors(options) {
    disposeBehaviors(this._behaviors, 'destroy', options);
  },
  _removeBehavior(behavior) {
    if (this._isDestroyed) {
      return;
    }
    const remainingBehaviors = [];
    for (let index = 0, length = this._behaviors.length; index < length; index++) {
      const currentBehavior = this._behaviors[index];
      if (currentBehavior !== behavior) {
        remainingBehaviors.push(currentBehavior);
      }
    }
    this._behaviors = remainingBehaviors;
  },
  _bindBehaviorUIElements() {
    eachBehavior(this._behaviors, behavior => behavior.bindUIElements());
  },
  _unbindBehaviorUIElements() {
    eachBehavior(this._behaviors, behavior => behavior.unbindUIElements());
  },
  _triggerEventOnBehaviors(eventName, view, options) {
    eachBehavior(this._behaviors, behavior => behavior.triggerMethod(eventName, view, options));
  }
};

function subscribeBindings(context, Data, entity, bindings) {
  const eventArgs = buildEventArgs(normalizeBindings$1(context, bindings), context);
  const subscriptions = [];
  try {
    for (let index = 0; index < eventArgs.length; index++) {
      const {
        name,
        callback,
        context: eventContext
      } = eventArgs[index];
      subscriptions.push(Data.subscribe(entity, name, callback, eventContext));
    }
  } catch (error) {
    disposeAll(subscriptions, error);
  }
  return function () {
    disposeAll(subscriptions);
  };
}
var DelegateEntityEventsMixin = {
  _delegateEntityEvents(model, collection, Data) {
    try {
      if (model) {
        this._modelEvents = getValue(this, 'modelEvents');
        if (this._modelEvents) {
          this._modelEventUnsubscribe = subscribeBindings(this, Data, model, this._modelEvents);
        }
      }
      if (collection) {
        this._collectionEvents = getValue(this, 'collectionEvents');
        if (this._collectionEvents) {
          this._collectionEventUnsubscribe = subscribeBindings(this, Data, collection, this._collectionEvents);
        }
      }
    } catch (error) {
      this._deleteEntityEventHandlers(error);
    }
  },
  _undelegateEntityEvents() {
    this._deleteEntityEventHandlers();
  },
  _deleteEntityEventHandlers(error) {
    const subscriptions = [this._modelEventUnsubscribe, this._collectionEventUnsubscribe];
    delete this._modelEventUnsubscribe;
    delete this._collectionEventUnsubscribe;
    delete this._modelEvents;
    delete this._collectionEvents;
    if (arguments.length) {
      disposeAll(subscriptions, error);
    } else {
      disposeAll(subscriptions);
    }
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
    return this.Data.serialize(this.model);
  },
  serializeCollection() {
    return this.Data.items(this.collection).map(model => this.Data.serialize(model));
  },
  _renderHtml(template, data) {
    return template(data);
  },
  attachElContent(html) {
    this.Dom.setContents(this.el, html);
  }
};

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

function setEventDelegator$1(delegator) {
  if (!delegator || typeof delegator.delegate !== 'function') {
    throw new MarionetteError({
      code: 'MN0036',
      name: 'EventDelegatorError',
      message: 'EventDelegator must provide a delegate method.',
      url: 'dom.interactions.html#eventdelegator-adapter'
    });
  }
  Object.defineProperty(this.prototype, 'EventDelegator', {
    configurable: true,
    enumerable: true,
    value: delegator,
    writable: false
  });
  return this;
}
var EventDelegator = {
  delegate({
    eventName,
    selector,
    handler,
    rootEl
  }) {
    const capture = eventName === 'focus' || eventName === 'blur';
    let eventHandler = handler;
    if (selector) {
      eventHandler = function (evt) {
        let node = evt.target;
        for (; node && node !== rootEl; node = node.parentNode) {
          if (node.nodeType === 1 && node.matches(selector)) {
            evt.delegateTarget = node;
            handler(evt);
            break;
          }
        }
      };
    }
    rootEl.addEventListener(eventName, eventHandler, capture);
    let isRemoved;
    return () => {
      if (isRemoved) {
        return;
      }
      isRemoved = true;
      rootEl.removeEventListener(eventName, eventHandler, capture);
    };
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
  const shouldPreventDefault = triggerDef.preventDefault !== false;
  const shouldStopPropagation = triggerDef.stopPropagation !== false;
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
    disposeAll(this._domEvents.splice(0));
  },
  _delegateViewEvents(view = this, events) {
    if (!events && !this.events && !this.triggers) {
      return;
    }
    const uiBindings = this._getUIBindings();
    const delegates = [];
    this._delegateEvents(delegates, uiBindings, events);
    this._delegateTriggers(delegates, uiBindings, view);
    try {
      for (let index = 0; index < delegates.length; index += 2) {
        this._delegate(delegates[index], delegates[index + 1]);
      }
    } catch (error) {
      disposeAll(this._domEvents.splice(0), error);
    }
  },
  _delegateEvents(delegates, uiBindings, events) {
    const eventMap = events || getValue(this, 'events');
    if (!eventMap) {
      return;
    }
    eachOwn(eventMap, (handler, key) => {
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
    const cleanup = this.EventDelegator.delegate({
      eventName: match[1],
      selector: match[2],
      handler,
      rootEl: this.el
    });
    if (typeof cleanup !== 'function') {
      throw new MarionetteError({
        code: 'MN0036',
        name: 'EventDelegatorError',
        message: 'EventDelegator.delegate must return a cleanup function.',
        url: 'dom.interactions.html#eventdelegator-adapter'
      });
    }
    this._domEvents.push(cleanup);
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

const noop = function () {};
function setDataApi$1(mixin) {
  this.prototype.Data = assignOwn({}, this.prototype.Data, mixin);
  return this;
}
var DataApi = {
  key(model) {
    return model;
  },
  get(model, attribute) {
    return Object.hasOwn(model, attribute) ? model[attribute] : undefined;
  },
  has(model, attribute) {
    return Object.hasOwn(Object(model), attribute);
  },
  serialize(model) {
    return model;
  },
  items(collection) {
    return collection;
  },
  subscribe(entity, eventName, callback, context) {
    let isSubscribed = true;
    entity.on(eventName, callback, context);
    return function () {
      if (!isSubscribed) {
        return;
      }
      isSubscribed = false;
      entity.off(eventName, callback, context);
    };
  },
  observeCollection() {
    return noop;
  }
};

const classErrorName$4 = 'ViewError';
function isJQueryCollection(el) {
  return el != null && typeof el === 'object' && typeof el.jquery === 'string' && typeof el.get === 'function';
}
const ViewOptions = ['attributes', 'className', 'collection', 'el', 'events', 'id', 'model', 'tagName'];
const ViewMixin = {
  tagName: 'div',
  preinitialize() {},
  Dom: DomApi,
  Data: DataApi,
  _validateEl(el) {
    const stringEl = isString(el);
    if (!stringEl && !isJQueryCollection(el)) {
      return el;
    }
    const migration = stringEl ? `Resolve selector strings at the call site, e.g. \`document.querySelector('${el}')\`.` : 'Unwrap jQuery collections at the call site, e.g. `wrappedEl[0]`.';
    throw new MarionetteError({
      code: 'MN0001',
      name: classErrorName$4,
      message: `View "el" must be a DOM element. ${migration} (Region still accepts selector strings.)`,
      url: 'marionette.view.html#specifying-an-el'
    });
  },
  _getEl() {
    const elOption = getValue(this, 'el');
    if (!elOption) {
      const el = this.Dom.createElement(getValue(this, 'tagName'));
      const attrs = assignOwn({}, getValue(this, 'attributes'));
      if (this.id) {
        attrs.id = getValue(this, 'id');
      }
      if (this.className) {
        attrs.class = getValue(this, 'className');
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
    const documentEl = this.el && this.Dom.getDocumentEl(this.el);
    return !!documentEl && this.Dom.hasEl(documentEl, this.el);
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
  _rollbackView(error) {
    const dataObserverUnsubscribe = this._dataObserverUnsubscribe;
    delete this._dataObserverUnsubscribe;
    disposeAll([() => this.stopListening(), () => this._destroyState(), () => this._rollbackBehaviors(), () => this.undelegateEntityEvents(), () => this._undelegateViewEvents(), () => this._removeChildren(), dataObserverUnsubscribe], error);
  },
  delegateEvents(events) {
    if (this._isDestroying || this._isDestroyed) {
      return this;
    }
    this.undelegateEvents();
    this._buildEventProxies();
    try {
      this._delegateViewEvents(this, events);
      this._setBehaviorElements();
    } catch (error) {
      disposeAll([() => this._undelegateBehaviorViewEvents(), () => this._undelegateViewEvents()], error);
    }
    return this;
  },
  undelegateEvents() {
    if (this._isDestroyed || this._isDestroying) {
      return this;
    }
    disposeAll([() => this._undelegateBehaviorViewEvents(), () => this._undelegateViewEvents()]);
    return this;
  },
  delegateEntityEvents() {
    if (this._isDestroyed || this._isDestroying) {
      return this;
    }
    try {
      this._delegateEntityEvents(this.model, this.collection, this.Data);
      this._delegateBehaviorEntityEvents();
    } catch (error) {
      try {
        this.undelegateEntityEvents();
      } catch {}
      throw error;
    }
    return this;
  },
  undelegateEntityEvents() {
    disposeAll([() => this._undelegateBehaviorEntityEvents(), () => this._undelegateEntityEvents()]);
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
    disposeAll([() => {
      this.Dom.detachEl(this.el);
      if (shouldTriggerDetach) {
        this._isAttached = false;
        this.triggerMethod('detach', this);
      }
      this._removeChildren();
      this._isDestroyed = true;
      this._isRendered = false;
      const dataObserverUnsubscribe = this._dataObserverUnsubscribe;
      delete this._dataObserverUnsubscribe;
      let dataDisposalError;
      let hasDataDisposalError = false;
      try {
        disposeAll([dataObserverUnsubscribe, () => this._deleteEntityEventHandlers(), () => this._destroyBehaviors(options)]);
      } catch (error) {
        dataDisposalError = error;
        hasDataDisposalError = true;
      }
      this.triggerMethod('destroy', this, options);
      this._triggerEventOnBehaviors('destroy', this, options);
      this.stopListening();
      if (hasDataDisposalError) {
        throw dataDisposalError;
      }
    }, () => this._undelegateViewEvents()]);
    return this;
  },
  bindUIElements() {
    if (this._isDestroyed || this._isDestroying) {
      return this;
    }
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
    this._childViewEvents = this.normalizeMethods(getValue(this, 'childViewEvents'));
    this._childViewTriggers = getValue(this, 'childViewTriggers');
    this._eventPrefix = this._getEventPrefix();
  },
  _getEventPrefix() {
    const prefix = getValue(this, 'childViewEventPrefix', false);
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
assignOwn(ViewMixin, BehaviorsMixin, CommonMixin, DelegateEntityEventsMixin, StateMixin, TemplateRenderMixin, UIMixin, ViewEventsMixin);

function setRenderer$1(renderer) {
  this.prototype._renderHtml = renderer;
  return this;
}

const classErrorName$3 = 'RegionError';
const destroyTeardown = new WeakMap();
function consumeDestroyTeardown(region, operation) {
  if (destroyTeardown.get(region) !== operation) {
    return false;
  }
  destroyTeardown.delete(region);
  return true;
}
function canMutateRegion(region, authorized) {
  return authorized || !region._isDestroying && !region._isDestroyed;
}
function emptyRegion(region, options = {
  allowMissingEl: true
}) {
  const view = region.currentView;
  if (!view) {
    if (region._ensureElement(options)) {
      region.detachHtml();
    }
    return region;
  }
  region._empty(view, true);
  return region;
}
function assertRegionName(name) {
  if (typeof name === 'string' && name.length > 0) {
    return;
  }
  throw new MarionetteError({
    code: 'MN0032',
    name: classErrorName$3,
    message: 'A Region name must be a non-empty string.'
  });
}
function setRegion(regions, definition, name) {
  assertRegionName(name);
  Object.defineProperty(regions, name, {
    configurable: true,
    enumerable: true,
    value: definition,
    writable: true
  });
  return regions;
}
function getOwnRegion(regions, name) {
  assertRegionName(name);
  return Object.getOwnPropertyDescriptor(regions, name)?.value;
}
function getRequiredRegion(region, name) {
  if (region) {
    return region;
  }
  throw new MarionetteError({
    code: 'MN0020',
    name: classErrorName$3,
    message: `Region "${name}" does not exist.`
  });
}
function getRegionForChild(view, name) {
  assertRegionName(name);
  if (!view._isRendered) {
    view.render();
  }
  return getRequiredRegion(view.getRegion(name), name);
}
function throwRegionRegistrationConflict(message) {
  throw new MarionetteError({
    code: 'MN0030',
    name: classErrorName$3,
    message
  });
}
function isSameRegionRegistration(view, region, name) {
  return region._parentView === view && region._name === name && getOwnRegion(view._regions, name) === region;
}
function assertRegionCanRegister(view, region, name) {
  if (isSameRegionRegistration(view, region, name)) {
    return;
  }
  if (region._parentView !== undefined) {
    throwRegionRegistrationConflict('A Region instance cannot be registered with more than one owner or name.');
  }
  if (region._isDestroying || region._isDestroyed) {
    throwRegionRegistrationConflict('A destroying or destroyed Region cannot be registered.');
  }
  if (getOwnRegion(view._regions, name)) {
    throwRegionRegistrationConflict(`Region name "${name}" is already registered.`);
  }
}
function assertRegionDefinitionsCanRegister(view, definitions) {
  const seenRegions = new Set();
  eachOwn(definitions, (definition, name) => {
    if (!(definition instanceof Region)) {
      if (getOwnRegion(view._regions, name)) {
        throwRegionRegistrationConflict(`Region name "${name}" is already registered.`);
      }
      return;
    }
    if (seenRegions.has(definition)) {
      throwRegionRegistrationConflict('A Region instance cannot be registered under more than one name.');
    }
    seenRegions.add(definition);
    assertRegionCanRegister(view, definition, name);
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
assignOwn(Region.prototype, CommonMixin, {
  Dom: DomApi,
  cidPrefix: 'mnr',
  replaceElement: false,
  _isReplaced: false,
  _isSwappingView: false,
  _validateEl(el) {
    if (!el || isString(el) || el.nodeType === 1) {
      return;
    }
    throw new MarionetteError({
      code: 'MN0002',
      name: classErrorName$3,
      message: 'Region "el" must be a selector string or DOM element.',
      url: 'marionette.region.html#additional-options'
    });
  },
  show(view, options) {
    if (!canMutateRegion(this)) {
      return this;
    }
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
        name: classErrorName$3,
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
    if (el !== null && typeof el === 'object') {
      this.el = el;
      return;
    }
    if (!el) {
      throw new MarionetteError({
        code: 'MN0004',
        name: classErrorName$3,
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
    const documentEl = this.Dom.getDocumentEl(this.el);
    return !!documentEl && this.Dom.hasEl(documentEl, this.el);
  },
  _attachView(view, {
    replaceElement
  } = {}) {
    const shouldTriggerAttach = !view._isAttached && this._isElAttached() && !this._shouldDisableMonitoring();
    const shouldReplaceEl = typeof replaceElement === 'undefined' ? !!getValue(this, 'replaceElement') : !!replaceElement;
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
      const allowMissingEl = typeof options.allowMissingEl === 'undefined' ? !!getValue(this, 'allowMissingEl') : !!options.allowMissingEl;
      if (allowMissingEl) {
        return false;
      } else {
        throw new MarionetteError({
          code: 'MN0005',
          name: classErrorName$3,
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
        name: classErrorName$3,
        message: 'The view passed is undefined and therefore invalid. You must pass a view instance to show.',
        url: 'marionette.region.html#showing-a-view'
      });
    }
    if (view._isDestroyed) {
      throw new MarionetteError({
        code: 'MN0007',
        name: classErrorName$3,
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
    if (typeof viewOptions === 'function') {
      return {
        template: viewOptions
      };
    }
    if (viewOptions !== null && typeof viewOptions === 'object') {
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
    const context = getValue(this, 'parentEl');
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
    const authorized = consumeDestroyTeardown(this, 'empty');
    if (!canMutateRegion(this, authorized)) {
      return this;
    }
    return emptyRegion(this, options);
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
    if (!canMutateRegion(this)) {
      return;
    }
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
  getOwner() {
    return this._parentView;
  },
  getName() {
    return this._name;
  },
  reset(options) {
    const authorized = consumeDestroyTeardown(this, 'reset');
    if (!canMutateRegion(this, authorized)) {
      return this;
    }
    if (authorized) {
      destroyTeardown.set(this, 'empty');
    }
    try {
      this.empty(options);
    } finally {
      if (authorized && destroyTeardown.get(this) === 'empty') {
        destroyTeardown.delete(this);
      }
    }
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
    const currentView = this.currentView;
    let isReset = false;
    destroyTeardown.set(this, 'reset');
    try {
      this.reset(options);
      isReset = true;
    } finally {
      destroyTeardown.delete(this);
      if (isReset || currentView && this.currentView !== currentView) {
        if (this._parentView && this._name !== undefined) {
          this._parentView._removeReferences(this._name);
        }
        delete this._parentView;
        delete this._name;
      }
    }
    this.triggerMethod('destroy', this, options);
    this.stopListening();
    return this;
  }
});
function buildRegion(definition, defaults) {
  if (definition instanceof Region) {
    return definition;
  }
  if (isString(definition)) {
    return buildRegionFromObject(defaults, {
      el: definition
    });
  }
  if (typeof definition === 'function') {
    return buildRegionFromObject(defaults, {
      regionClass: definition
    });
  }
  if (definition !== null && typeof definition === 'object') {
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
    this.addRegions(getValue(this, 'regions'));
  },
  _reInitRegions() {
    eachOwn(this._regions, region => region.reset());
  },
  addRegion(name, definition) {
    const regions = setRegion({}, definition, name);
    return this.addRegions(regions)[name];
  },
  addRegions(regions) {
    if (regions == null || Object.keys(regions).length === 0) {
      return;
    }
    eachOwn(regions, (_, name) => assertRegionName(name));
    regions = this.normalizeUIValues(regions, 'el');
    assertRegionDefinitionsCanRegister(this, regions);
    const allRegions = {};
    eachOwn(this.regions, (definition, name) => setRegion(allRegions, definition, name));
    eachOwn(regions, (definition, name) => setRegion(allRegions, definition, name));
    this.regions = allRegions;
    return this._addRegions(regions);
  },
  _addRegions(regionDefinitions) {
    const defaults = {
      regionClass: this.regionClass,
      parentEl: () => getValue(this, 'el')
    };
    const regions = {};
    try {
      eachOwn(regionDefinitions, (definition, name) => {
        const region = buildRegion(definition, defaults);
        this._addRegion(region, name);
        setRegion(regions, region, name);
      });
    } catch (error) {
      eachOwn(regionDefinitions, (definition, name) => {
        if (!getOwnRegion(this._regions, name)) {
          delete this.regions[name];
        }
      });
      throw error;
    }
    return regions;
  },
  _addRegion(region, name) {
    if (isSameRegionRegistration(this, region, name)) {
      return;
    }
    assertRegionCanRegister(this, region, name);
    this.triggerMethod('before:add:region', this, name, region);
    if (isSameRegionRegistration(this, region, name)) {
      return;
    }
    try {
      assertRegionCanRegister(this, region, name);
    } catch (error) {
      if (!getOwnRegion(this._regions, name)) {
        delete this.regions[name];
      }
      throw error;
    }
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
    const disposers = [];
    eachOwn(regions, (region, name) => {
      disposers.push(() => this._removeRegion(region, name));
    });
    disposeAll(disposers.reverse());
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
    if (!this._isRendered) {
      this.render();
    }
    const regions = this.getRegions();
    eachOwn(regions, region => region.empty());
    return regions;
  },
  hasRegion(name) {
    return !!getOwnRegion(this._regions, name);
  },
  getRegion(name) {
    return getOwnRegion(this._regions, name);
  },
  _getRegions() {
    const regions = {};
    eachOwn(this._regions, (region, name) => setRegion(regions, region, name));
    return regions;
  },
  getRegions() {
    return this._getRegions();
  },
  showChildView(name, view, options) {
    const region = getRegionForChild(this, name);
    region.show(view, options);
    return view;
  },
  detachChildView(name) {
    return getRegionForChild(this, name).detachView();
  },
  getChildView(name) {
    return getRegionForChild(this, name).currentView;
  }
};
const ViewClassOptions = ['attributes', 'behaviors', 'childViewEventPrefix', 'childViewEvents', 'childViewTriggers', 'className', 'collection', 'collectionEvents', 'el', 'events', 'id', 'model', 'modelEvents', 'regionClass', 'regions', 'stateEvents', 'tagName', 'template', 'templateContext', 'triggers', 'ui'];
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
  this.mergeOptions(options, ViewOptions);
  this._initViewEvents();
  try {
    this.setElement(this._getEl());
    monitorViewEvents(this);
    this._initState(options);
    this._initBehaviors();
    this._initRegions();
    this._buildEventProxies();
    this.initialize.apply(this, arguments);
    if (this._isDestroyed || this._isDestroying) {
      return;
    }
    this._initStateEvents();
    this.delegateEntityEvents();
    this._triggerEventOnBehaviors('initialize', this, options);
  } catch (error) {
    this._rollbackView(error);
  }
};
assignOwn(View, {
  extend,
  setRenderer: setRenderer$1,
  setDomApi: setDomApi$1,
  setEventDelegator: setEventDelegator$1,
  setDataApi: setDataApi$1
});
assignOwn(View.prototype, ViewMixin, RegionsMixin, {
  cidPrefix: 'mnv',
  setElement(element) {
    if (this._isDestroying || this._isDestroyed) {
      return this;
    }
    const el = this._validateEl(element);
    const wrappedEl = this.Dom.wrapEl && this.Dom.wrapEl(el);
    this.undelegateEvents();
    this.el = el;
    if (this.Dom.wrapEl) {
      this.$el = wrappedEl;
    } else {
      delete this.$el;
    }
    this._isRendered = this.Dom.hasContents(this.el);
    this._isAttached = this._isElAttached();
    if (this._isRendered) {
      this.bindUIElements();
    }
    this.delegateEvents();
    return this;
  },
  render() {
    if (this._isDestroyed) {
      return this;
    }
    const template = this.getTemplate();
    if (template === false) {
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
    const children = [];
    eachOwn(this._regions, region => childReducer(children, region));
    return children;
  }
});

const classErrorName$2 = 'CollectionViewError';
function createIndex() {
  return Object.create(null);
}
const Container = function (dataApi = DataApi) {
  this.Data = dataApi;
  this._init();
};
function assertFunction(callback) {
  if (typeof callback !== 'function') {
    throw new MarionetteError({
      code: 'MN0024',
      name: classErrorName$2,
      message: 'ChildViewContainer callback must be a function.'
    });
  }
}
function assertCount(count) {
  if (!Number.isInteger(count) || count < 0) {
    throw new MarionetteError({
      code: 'MN0024',
      name: classErrorName$2,
      message: 'ChildViewContainer count must be a nonnegative integer.'
    });
  }
  return count;
}
function stringComparator(Data, comparator, view) {
  return view.model && Data.has(view.model, comparator) ? Data.get(view.model, comparator) : undefined;
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
          name: classErrorName$2,
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
        name: classErrorName$2,
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
          name: classErrorName$2,
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
    this._viewsByCid = createIndex();
    this._indexByModel = new Map();
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
      this._indexByModel.set(this.Data.key(view.model), view);
    }
  },
  _sort(comparator, context) {
    if (typeof comparator === 'string') {
      return this._sortBy(view => stringComparator(this.Data, comparator, view));
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
      this._viewsByCid = createIndex();
      this._indexByModel = new Map();
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
    return this._indexByModel.get(this.Data.key(model));
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
    return this.findByCid(view.cid) === view;
  },
  _remove(view) {
    if (!this.hasView(view)) {
      return;
    }
    if (view.model) {
      const modelKey = this.Data.key(view.model);
      if (this._indexByModel.get(modelKey) === view) {
        this._indexByModel.delete(modelKey);
      }
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

const classErrorName$1 = 'CollectionViewError';
function isEmptyViewClass(view) {
  if (typeof view !== 'function' || !view.prototype) {
    return false;
  }
  const {
    render,
    destroy
  } = view.prototype;
  return typeof render === 'function' && (destroy ? typeof destroy === 'function' : typeof view.prototype.remove === 'function');
}
function modelAttributesMatcher(Data, predicate) {
  const keys = Object.keys(predicate);
  const length = keys.length;
  const values = Array(length);
  for (let index = 0; index < length; index++) {
    values[index] = predicate[keys[index]];
  }
  return function (view) {
    const model = view.model;
    if (model == null) {
      return length === 0;
    }
    for (let index = 0; index < length; index++) {
      const key = keys[index];
      if (!Data.has(model, key) || values[index] !== Data.get(model, key)) {
        return false;
      }
    }
    return true;
  };
}
function isClassDefinition(view) {
  return /^class(?:\s|\/[/*])/.test(Function.prototype.toString.call(view));
}
const ClassOptions$2 = ['attributes', 'behaviors', 'childView', 'childViewContainer', 'childViewEventPrefix', 'childViewEvents', 'childViewOptions', 'childViewTriggers', 'className', 'collection', 'collectionEvents', 'el', 'emptyView', 'emptyViewOptions', 'events', 'id', 'model', 'modelEvents', 'stateEvents', 'sortWithCollection', 'tagName', 'template', 'templateContext', 'triggers', 'ui', 'viewComparator', 'viewFilter'];
const CollectionView = function (options) {
  this.cid = uniqueId(this.cidPrefix);
  this._setOptions(options, ClassOptions$2);
  this.preinitialize.apply(this, arguments);
  this.mergeOptions(options, ViewOptions);
  this._initViewEvents();
  try {
    this.setElement(this._getEl());
    monitorViewEvents(this);
    this._initState(options);
    this._initChildViewStorage();
    this._initBehaviors();
    this._buildEventProxies();
    this.initialize.apply(this, arguments);
    if (this._isDestroyed || this._isDestroying) {
      return;
    }
    this._initStateEvents();
    this.getEmptyRegion();
    this.delegateEntityEvents();
    this._triggerEventOnBehaviors('initialize', this, options);
  } catch (error) {
    this._rollbackView(error);
  }
};
assignOwn(CollectionView, {
  extend,
  setRenderer: setRenderer$1,
  setDomApi: setDomApi$1,
  setEventDelegator: setEventDelegator$1,
  setDataApi: setDataApi$1
});
assignOwn(CollectionView.prototype, ViewMixin, {
  cidPrefix: 'mncv',
  sortWithCollection: true,
  _initChildViewStorage() {
    this._children = new Container(this.Data);
    this.children = new Container(this.Data);
  },
  getEmptyRegion() {
    if (this._isDestroyed && this._emptyRegion) {
      return this._emptyRegion;
    }
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
    if (this._isRendered || this._dataObserverUnsubscribe) {
      return;
    }
    this._dataObserverUnsubscribe = this.Data.observeCollection(this.collection, this._onCollectionChange, this);
  },
  _onCollectionChange(change) {
    if (change.type === 'reorder') {
      this._onCollectionReorder();
    } else if (change.type === 'reset') {
      this._onCollectionReset();
    } else if (change.type === 'update') {
      this._onCollectionUpdate(change);
    }
  },
  _onCollectionReorder() {
    if (this._isDestroying || this._isDestroyed) {
      return;
    }
    if (!this.sortWithCollection || this.viewComparator === false) {
      return;
    }
    this.sort();
  },
  _onCollectionReset() {
    if (this._isDestroying || this._isDestroyed) {
      return;
    }
    this._destroyChildren();
    this._addChildModels(this.Data.items(this.collection));
    this.sort();
  },
  _onCollectionUpdate(changes) {
    if (this._isDestroying || this._isDestroyed) {
      return;
    }
    const removedViews = changes.removed.length && this._removeChildModels(changes.removed);
    this._addedViews = changes.added.length && this._addChildModels(changes.added);
    this._detachChildren(removedViews);
    const isDefaultComparator = this.getComparator === CollectionView.prototype.getComparator;
    const isDefaultFilterQuery = this.getFilter === CollectionView.prototype.getFilter;
    const isDefaultSort = this.sort === CollectionView.prototype.sort;
    const isDefaultFilter = this.filter === CollectionView.prototype.filter;
    const canRemoveWithoutRender = this._isRendered && changes.removed.length > 0 && changes.added.length === 0 && changes.updated.length === 0 && isDefaultComparator && isDefaultFilterQuery && isDefaultSort && isDefaultFilter && !this.viewComparator && !this.viewFilter && this.children.length === this._children.length && this._children.length > 0 && !this._hasUnrenderedViews && !this._emptyRegion.hasView();
    if (!canRemoveWithoutRender) {
      this.sort();
    }
    this._removeChildViews(removedViews);
  },
  _removeChildModels(models) {
    const views = [];
    const length = models.length;
    for (let index = 0; index < length; index++) {
      const removeView = this._removeChildModel(models[index]);
      if (removeView) {
        views.push(removeView);
      }
    }
    return views;
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
    const length = models.length;
    const views = Array(length);
    for (let index = 0; index < length; index++) {
      views[index] = this._addChildModel(models[index]);
    }
    return views;
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
        name: classErrorName$1,
        message: 'A "childView" must be specified',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }
    childView = this._getView(childView, child);
    if (!childView) {
      throw new MarionetteError({
        code: 'MN0012',
        name: classErrorName$1,
        message: '"childView" must be a view class or a function that returns a view class',
        url: 'marionette.collectionview.html#collectionviews-childview'
      });
    }
    return childView;
  },
  _getView(view, child) {
    if (isViewClass(view)) {
      return view;
    } else if (typeof view === 'function') {
      return view.call(this, child);
    }
  },
  _getChildViewOptions(child) {
    if (typeof this.childViewOptions === 'function') {
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
    if (this._isDestroying || this._isDestroyed) {
      return this;
    }
    const el = this._validateEl(element);
    const wrappedEl = this.Dom.wrapEl && this.Dom.wrapEl(el);
    this.undelegateEvents();
    this.el = el;
    if (this.Dom.wrapEl) {
      this.$el = wrappedEl;
    } else {
      delete this.$el;
    }
    this._isAttached = this._isElAttached();
    this.delegateEvents();
    return this;
  },
  render() {
    if (this._isDestroyed) {
      return this;
    }
    this.triggerMethod('before:render', this);
    this._destroyChildren();
    if (this.collection) {
      this._addChildModels(this.Data.items(this.collection));
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
    const childViewContainer = getValue(this, 'childViewContainer');
    this.container = childViewContainer ? this.$(childViewContainer)[0] : this.el;
    if (!this.container) {
      throw new MarionetteError({
        code: 'MN0013',
        name: classErrorName$1,
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
    return this.Data.items(this.collection).indexOf(view.model);
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
    const children = this._children._views;
    const length = children.length;
    for (let index = 0; index < length; index++) {
      const view = children[index];
      (viewFilter.call(this, view, index, children) ? attachViews : detachViews).push(view);
    }
    this._detachChildren(detachViews);
    this.children._set(attachViews, true);
    this.triggerMethod('filter', this, attachViews, detachViews);
  },
  _getFilter() {
    const viewFilter = this.getFilter();
    if (!viewFilter) {
      return false;
    }
    if (typeof viewFilter === 'function') {
      return viewFilter;
    }
    if (typeof viewFilter === 'object' && !Array.isArray(viewFilter)) {
      return modelAttributesMatcher(this.Data, viewFilter);
    }
    if (isString(viewFilter)) {
      return view => view.model && this.Data.has(view.model, viewFilter) && this.Data.get(view.model, viewFilter);
    }
    throw new MarionetteError({
      code: 'MN0014',
      name: classErrorName$1,
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
    if (!detachingViews) {
      return;
    }
    const length = detachingViews.length;
    for (let index = 0; index < length; index++) {
      this._detachChildView(detachingViews[index]);
    }
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
    const length = views.length;
    for (let index = 0; index < length; index++) {
      const view = views[index];
      renderView(view);
      view._isShown = true;
      this.Dom.appendContents(elBuffer, view.el);
    }
    return elBuffer;
  },
  _attachChildren(els, views) {
    const shouldTriggerAttach = this._isAttached && this.monitorViewEvents !== false;
    views = shouldTriggerAttach ? views : [];
    const beforeAttachLength = views.length;
    for (let index = 0; index < beforeAttachLength; index++) {
      const view = views[index];
      if (view._isAttached) {
        continue;
      }
      view.triggerMethod('before:attach', view);
    }
    this.attachHtml(els, this.container);
    const attachLength = views.length;
    for (let index = 0; index < attachLength; index++) {
      const view = views[index];
      if (view._isAttached) {
        continue;
      }
      view._isAttached = true;
      view.triggerMethod('attach', view);
    }
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
    const isResolver = typeof emptyView === 'function' && !isClassDefinition(emptyView);
    const EmptyView = isResolver ? emptyView.call(this) : undefined;
    if (isResolver && (EmptyView == null || EmptyView === false)) {
      return;
    }
    if (isEmptyViewClass(EmptyView)) {
      return EmptyView;
    }
    throw new MarionetteError({
      code: 'MN0022',
      name: classErrorName$1,
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
    if (typeof emptyViewOptions === 'function') {
      return emptyViewOptions.call(this);
    }
    return emptyViewOptions;
  },
  swapChildViews(view1, view2) {
    if (!this._children.hasView(view1) || !this._children.hasView(view2)) {
      throw new MarionetteError({
        code: 'MN0015',
        name: classErrorName$1,
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
    if (this._isDestroying || this._isDestroyed) {
      return view;
    }
    if (!view || view._isDestroyed) {
      return view;
    }
    if (view._isShown) {
      throw new MarionetteError({
        code: 'MN0003',
        name: classErrorName$1,
        message: 'View is already shown in a Region or CollectionView',
        url: 'marionette.region.html#showing-a-view'
      });
    }
    const indexType = typeof index;
    if (index !== null && (indexType === 'object' || indexType === 'function')) {
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
    if (!view || !this._children.hasView(view)) {
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
    if (!views) {
      return;
    }
    const disposers = [];
    for (let index = views.length - 1; index >= 0; index--) {
      const view = views[index];
      disposers.push(() => this._removeChildView(view));
    }
    disposeAll(disposers);
  },
  _removeChildView(view, {
    shouldDetach
  } = {}) {
    view.off('destroy', this.removeChildView, this);
    disposeAll([() => this.stopListening(view), () => shouldDetach ? this._detachChildView(view) : this._destroyChildView(view)]);
  },
  _destroyChildView(view) {
    if (view._isDestroyed) {
      return;
    }
    const shouldDisableEvents = this.monitorViewEvents === false;
    destroyView(view, shouldDisableEvents);
  },
  _removeChildren() {
    const emptyRegion = this.getEmptyRegion();
    disposeAll([() => {
      delete this._addedViews;
    }, () => emptyRegion.destroy(), () => this._destroyChildren()]);
  },
  _destroyChildren() {
    if (!this._children.length) {
      return;
    }
    this.triggerMethod('before:destroy:children', this);
    if (this.monitorViewEvents === false) {
      this.Dom.detachContents(this.el);
    }
    try {
      this._removeChildViews(this._children._views);
    } finally {
      this._children._init();
      this.children._init();
    }
    this.triggerMethod('destroy:children', this);
  }
});

const ClassOptions$1 = ['collectionEvents', 'events', 'modelEvents', 'stateEvents', 'triggers', 'ui'];
const Behavior = function (options, view) {
  this.view = view;
  this._setOptions(options, ClassOptions$1);
  this.cid = uniqueId(this.cidPrefix);
  this._initViewEvents();
  this.el = view.el;
  if (view.$el) {
    this.$el = view.$el;
  }
  this._initState(options);
  try {
    this.ui = assignOwn({}, getValue(this, 'ui'), getValue(view, 'ui'));
    this.listenTo(view, 'all', this.triggerMethod);
    this.initialize.apply(this, arguments);
    this._initStateEvents();
    this._syncElement();
  } catch (error) {
    try {
      this.destroy();
    } catch {}
    throw error;
  }
};
assignOwn(Behavior, {
  extend,
  setEventDelegator: setEventDelegator$1
});
assignOwn(Behavior.prototype, CommonMixin, DelegateEntityEventsMixin, StateMixin, UIMixin, ViewEventsMixin, {
  cidPrefix: 'mnb',
  $() {
    return this.view.$.apply(this.view, arguments);
  },
  destroy() {
    this._isDestroyed = true;
    disposeAll([() => this._deleteEntityEventHandlers(), () => this.view._removeBehavior(this), () => this.stopListening(), () => this._destroyState(), () => this._undelegateViewEvents()]);
    return this;
  },
  _syncElement() {
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
    if (this.view._isDestroying || this.view._isDestroyed) {
      return this;
    }
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
    if (this.view._isDestroying || this.view._isDestroyed) {
      return this;
    }
    this._delegateEntityEvents(this.view.model, this.view.collection, this.view.Data);
    return this;
  },
  undelegateEntityEvents() {
    this._undelegateEntityEvents(this.view.model, this.view.collection);
    return this;
  }
});

const ClassOptions = ['channelName', 'radioEvents', 'radioRequests', 'region', 'regionClass', 'stateEvents'];
const DESTROYED = 'destroyed';
const DESTROYING = 'destroying';
const RESTARTING = 'restarting';
const RUNNING = 'running';
const STARTING = 'starting';
const STOPPED = 'stopped';
const STOPPING = 'stopping';
const classErrorName = 'ApplicationError';
const Application = function (options) {
  this._setOptions(options, ClassOptions);
  this.cid = uniqueId(this.cidPrefix);
  this._initRegion();
  try {
    this._initRadio();
    this._initState(options);
    this.initialize.apply(this, arguments);
    this._initStateEvents();
  } catch (error) {
    this._destroyState();
    this._ownedRegion?.destroy();
    throw error;
  }
};
function isCurrentOperation(application, operation) {
  return application._lifecycleOperation === operation;
}
function throwApplicationOwnershipConflict(message) {
  throw new MarionetteError({
    code: 'MN0031',
    name: classErrorName,
    message
  });
}
function isTerminal(application) {
  return application._lifecycleState === DESTROYING || application._lifecycleState === DESTROYED;
}
function hasTerminalOwner(application) {
  let owner = application._parentApp;
  while (owner) {
    if (isTerminal(owner)) {
      return true;
    }
    owner = owner._parentApp;
  }
  return false;
}
function isSameChildApp(owner, name, application) {
  return application._parentApp === owner && application._name === name && owner._childApps?.get(name) === application;
}
function assertChildAppCanRegister(owner, name, application) {
  if (typeof name !== 'string' || name.length === 0) {
    throwApplicationOwnershipConflict('A child Application name must be a non-empty string.');
  }
  if (!(application instanceof Application)) {
    throwApplicationOwnershipConflict('A child Application must be an Application instance.');
  }
  if (isSameChildApp(owner, name, application)) {
    return;
  }
  if (application === owner) {
    throwApplicationOwnershipConflict('An Application cannot own itself.');
  }
  if (application._parentApp !== undefined) {
    throwApplicationOwnershipConflict('An Application instance cannot be registered with more than one owner or name.');
  }
  if (owner._childApps?.has(name)) {
    throwApplicationOwnershipConflict(`Child Application name "${name}" is already registered.`);
  }
  let parent = owner;
  while (parent) {
    if (parent === application) {
      throwApplicationOwnershipConflict('A child Application cannot be an ancestor of its owner.');
    }
    parent = parent._parentApp;
  }
}
function removeChildAppReference(owner, name, application) {
  owner._childApps.delete(name);
  delete application._parentApp;
  delete application._name;
  if (owner._childApps.size === 0) {
    delete owner._childApps;
  }
}
async function destroyChildApps(application, options) {
  for (const child of application._childApps.values()) {
    await child.destroy(options);
  }
}
function hasStableLifecycleState(application, state) {
  return application._lifecycleState === state && !application._lifecycleOperation;
}
async function startChildApps(application, operation, options) {
  if (!application._childApps) {
    return true;
  }
  for (const child of application._childApps.values()) {
    if (!isCurrentOperation(application, operation)) {
      return false;
    }
    const started = await child.start(options);
    if (!isCurrentOperation(application, operation) || !started || !hasStableLifecycleState(child, RUNNING)) {
      return false;
    }
  }
  return true;
}
async function stopChildApps(application, operation, options) {
  if (!application._childApps) {
    return true;
  }
  for (const child of application._childApps.values()) {
    if (!isCurrentOperation(application, operation)) {
      return false;
    }
    const stopped = await child.stop(options);
    if (!isCurrentOperation(application, operation)) {
      return false;
    }
    if (stopped && hasStableLifecycleState(child, STOPPED)) {
      continue;
    }
    if (!isTerminal(application)) {
      return false;
    }
    await child.destroy(options);
  }
  return true;
}
function hasActiveChildApps(application) {
  for (const child of application._childApps.values()) {
    if (child._lifecycleState !== STOPPED && child._lifecycleState !== DESTROYED) {
      return true;
    }
  }
  return false;
}
function clearRootView(application) {
  const region = application._region;
  region?.off('empty', application._onRootRegionEmpty, application);
  delete application._view;
}
function getRootView(application) {
  const view = application._view;
  if (view && application._region?.currentView !== view) {
    clearRootView(application);
    return;
  }
  return view;
}
function emptyRootView(application, options) {
  if (!getRootView(application)) {
    return;
  }
  try {
    application._region.empty(options);
  } finally {
    getRootView(application);
  }
}
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    reject,
    resolve
  };
}
function beginReadiness(operation, options, callback) {
  const deferred = createDeferred();
  const controller = new AbortController();
  const readiness = {
    ...deferred,
    context: {
      signal: controller.signal
    },
    controller,
    options
  };
  operation.readiness = readiness;
  try {
    Promise.resolve(callback(readiness.context)).then(readiness.resolve, readiness.reject);
  } catch (error) {
    readiness.reject(error);
  }
  return readiness;
}
function completeReadiness(operation) {
  delete operation.readiness;
}
function getFailureState(application, operation) {
  if (operation?.stopReadiness) {
    return operation.failureState;
  }
  return application._lifecycleState === RUNNING ? RUNNING : STOPPED;
}
function supersedeOperation(application) {
  const operation = application._lifecycleOperation;
  if (!operation) {
    return;
  }
  delete application._lifecycleOperation;
  operation.resolve(!!operation.isCompleting);
  return operation;
}
function completeOperation(application, operation) {
  if (!isCurrentOperation(application, operation)) {
    return;
  }
  delete application._lifecycleOperation;
  operation.resolve(true);
}
function cancelOperation(application, operation) {
  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.resolve(false);
}
function failOperation(application, operation, error) {
  if (!isCurrentOperation(application, operation)) {
    return;
  }
  delete application._lifecycleOperation;
  application._lifecycleState = operation.failureState;
  operation.reject(error);
}
function runOperation(application, operation, callback) {
  (async () => {
    try {
      await callback();
      completeOperation(application, operation);
    } catch (error) {
      failOperation(application, operation, error);
    }
  })();
}
function beginOperation(application, kind, state, failureState, callback) {
  const superseded = supersedeOperation(application);
  const deferred = createDeferred();
  const stopReadiness = superseded?.stopReadiness;
  const operation = {
    ...deferred,
    kind,
    failureState,
    readiness: stopReadiness,
    stopReadiness
  };
  application._lifecycleOperation = operation;
  application._lifecycleState = state;
  if (superseded?.readiness && superseded.readiness !== stopReadiness) {
    superseded.readiness.controller.abort();
  }
  if (!isCurrentOperation(application, operation)) {
    return deferred.promise;
  }
  runOperation(application, operation, () => callback(operation));
  return deferred.promise;
}
async function startApplication(application, operation, options) {
  if (operation.stopReadiness) {
    const readiness = operation.stopReadiness;
    await readiness.promise;
    if (!isCurrentOperation(application, operation)) {
      return;
    }
    completeReadiness(operation);
    operation.failureState = STOPPED;
    delete operation.stopReadiness;
  }
  const readiness = beginReadiness(operation, options, async context => {
    await application.triggerMethod('before:start', application, options, context);
    return startChildApps(application, operation, options);
  });
  const childrenStarted = await readiness.promise;
  if (!isCurrentOperation(application, operation)) {
    return;
  }
  completeReadiness(operation);
  if (!childrenStarted) {
    cancelOperation(application, operation);
    return;
  }
  application._lifecycleState = RUNNING;
  operation.failureState = RUNNING;
  operation.isCompleting = true;
  application.triggerMethod('start', application, options);
}
async function stopApplication(application, operation, options) {
  try {
    if (!operation.stopReadiness) {
      const readiness = beginReadiness(operation, options, async context => {
        await application.triggerMethod('before:stop', application, options, context);
        return stopChildApps(application, operation, options);
      });
      operation.stopReadiness = readiness;
    }
    const readiness = operation.stopReadiness;
    const childrenStopped = await readiness.promise;
    if (!isCurrentOperation(application, operation)) {
      return;
    }
    completeReadiness(operation);
    delete operation.stopReadiness;
    if (!childrenStopped) {
      cancelOperation(application, operation);
      return;
    }
    emptyRootView(application, readiness.options);
    if (!isCurrentOperation(application, operation)) {
      return;
    }
    operation.failureState = STOPPED;
    operation.isStopped = true;
    if (operation.kind === 'stop') {
      application._lifecycleState = STOPPED;
      operation.isCompleting = true;
    }
    application.triggerMethod('stop', application, readiness.options);
    operation.stopDeferred?.resolve(true);
  } catch (error) {
    operation.stopDeferred?.reject(error);
    throw error;
  }
}
var application = /* @__PURE__ */(methods => {
  Application.extend = extend;
  assignOwn(Application.prototype, CommonMixin, DestroyMixin, RadioMixin, StateMixin, methods);
  return Application;
})({
  cidPrefix: 'mna',
  _lifecycleState: STOPPED,
  isRunning() {
    return this._lifecycleState === RUNNING;
  },
  start(options) {
    if (isTerminal(this) || hasTerminalOwner(this)) {
      return Promise.resolve(false);
    }
    const operation = this._lifecycleOperation;
    if (operation?.kind === 'start') {
      return operation.promise;
    }
    if (this._lifecycleState === RUNNING && !operation) {
      return Promise.resolve(true);
    }
    const failureState = getFailureState(this, operation);
    return beginOperation(this, 'start', STARTING, failureState, nextOperation => {
      return startApplication(this, nextOperation, options);
    });
  },
  stop(options) {
    if (this._lifecycleState === DESTROYED) {
      return Promise.resolve(true);
    }
    const operation = this._lifecycleOperation;
    if (this._lifecycleState === DESTROYING) {
      if (!operation?.stopReadiness) {
        return Promise.resolve(true);
      }
      if (!operation.stopDeferred) {
        operation.stopDeferred = createDeferred();
      }
      return operation.stopDeferred.promise;
    }
    if (operation?.kind === 'stop') {
      return operation.promise;
    }
    if (operation?.isStopped) {
      const superseded = supersedeOperation(this);
      this._lifecycleState = STOPPED;
      superseded.readiness?.controller.abort();
      return Promise.resolve(true);
    }
    if (this._lifecycleState === STOPPED && !operation) {
      try {
        emptyRootView(this, options);
        return Promise.resolve(true);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    const failureState = getFailureState(this, operation);
    return beginOperation(this, 'stop', STOPPING, failureState, nextOperation => {
      return stopApplication(this, nextOperation, options);
    });
  },
  restart(options) {
    if (isTerminal(this) || hasTerminalOwner(this)) {
      return Promise.resolve(false);
    }
    const operation = this._lifecycleOperation;
    if (operation?.kind === 'restart') {
      return operation.promise;
    }
    const shouldStop = !operation?.isStopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);
    return beginOperation(this, 'restart', RESTARTING, failureState, async nextOperation => {
      if (shouldStop) {
        await stopApplication(this, nextOperation, options);
      } else {
        emptyRootView(this, options);
      }
      if (!isCurrentOperation(this, nextOperation)) {
        return;
      }
      await startApplication(this, nextOperation, options);
    });
  },
  destroy(options) {
    if (this._lifecycleState === DESTROYED) {
      return Promise.resolve(true);
    }
    const operation = this._lifecycleOperation;
    if (operation?.kind === 'destroy') {
      return operation.promise;
    }
    const shouldStop = !operation?.isStopped && this._lifecycleState !== STOPPED;
    const failureState = getFailureState(this, operation);
    return beginOperation(this, 'destroy', DESTROYING, failureState, async nextOperation => {
      if (shouldStop) {
        await stopApplication(this, nextOperation, options);
      } else if (this._childApps && hasActiveChildApps(this)) {
        await stopChildApps(this, nextOperation, options);
      }
      emptyRootView(this, options);
      const readiness = beginReadiness(nextOperation, options, context => {
        return this.triggerMethod('before:destroy', this, options, context);
      });
      await readiness.promise;
      completeReadiness(nextOperation);
      if (this._childApps) {
        await destroyChildApps(this, options);
      }
      this._ownedRegion?.destroy(options);
      delete this._region;
      delete this._ownedRegion;
      this._isDestroyed = true;
      this._lifecycleState = DESTROYED;
      nextOperation.failureState = DESTROYED;
      nextOperation.isCompleting = true;
      if (this._parentApp) {
        removeChildAppReference(this._parentApp, this._name, this);
      }
      this.triggerMethod('destroy', this, options);
      this.stopListening();
    });
  },
  addChildApp(name, application) {
    if (isTerminal(this)) {
      return application;
    }
    if (application instanceof Application && isTerminal(application)) {
      return application;
    }
    assertChildAppCanRegister(this, name, application);
    if (isSameChildApp(this, name, application)) {
      return application;
    }
    const children = this._childApps || (this._childApps = new Map());
    application._parentApp = this;
    application._name = name;
    children.set(name, application);
    return application;
  },
  removeChildApp(name, options) {
    const application = this.getChildApp(name);
    if (!application) {
      return Promise.resolve();
    }
    return application.destroy(options).then(() => application);
  },
  hasChildApp(name) {
    return !!this._childApps?.has(name);
  },
  getChildApp(name) {
    return this._childApps?.get(name);
  },
  getChildApps() {
    const applications = {};
    this._childApps?.forEach((application, name) => {
      setProperty(applications, name, application);
    });
    return applications;
  },
  getParentApp() {
    return this._parentApp;
  },
  getRootApp() {
    let application = this;
    while (application._parentApp) {
      application = application._parentApp;
    }
    return application;
  },
  getName() {
    return this._name;
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
    if (!(region instanceof Region)) {
      this._ownedRegion = this._region;
    }
  },
  getRegion() {
    return this._region;
  },
  _onRootRegionEmpty() {
    clearRootView(this);
  },
  showView(view, ...args) {
    if (isTerminal(this)) {
      return view;
    }
    const region = this.getRegion();
    region.show(view, ...args);
    if (region.currentView === view) {
      if (this._view !== view) {
        clearRootView(this);
        region.on('empty', this._onRootRegionEmpty, this);
      }
      this._view = view;
    }
    return view;
  },
  getView() {
    return getRootView(this);
  }
});

const setDomApi = function (mixin) {
  CollectionView.setDomApi(mixin);
  Region.setDomApi(mixin);
  View.setDomApi(mixin);
};
const setDataApi = function (mixin) {
  CollectionView.setDataApi(mixin);
  View.setDataApi(mixin);
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

export { application as Application, Behavior, CollectionView, DataApi, DomApi, Events, MarionetteError, MarionetteObject as MnObject, Radio, Region, State, version as VERSION, View, extend, monitorViewEvents, setDataApi, setDomApi, setEventDelegator, setRenderer };
