import buildEventArgs, { eventSplitter } from '../utils/build-event-args.ts';
import { setProperty } from '../utils/assign-in.js';
import callHandler from '../utils/call-handler.ts';
import onceWrap from '../utils/once-wrap.ts';
import uniqueId from '../utils/unique-id.ts';

import triggerMethod from '../modules/common/trigger-method.ts';

export type EventCallback = (...args: never[]) => unknown;
export type EventMap = Record<string, EventCallback>;

export interface EventSource {
  on(name: string, callback?: (...args: unknown[]) => unknown, context?: unknown): unknown;
  off(name?: string | null, callback?: ((...args: unknown[]) => unknown) | null, context?: unknown): unknown;
}

export interface Events extends EventSource {
  on<Receiver>(this: Receiver, name: string, callback?: EventCallback, context?: unknown): Receiver;
  on<Receiver>(this: Receiver, events: EventMap, context?: unknown, explicitContext?: unknown): Receiver;
  once<Receiver>(this: Receiver, name: string, callback?: EventCallback, context?: unknown): Receiver;
  once<Receiver>(this: Receiver, events: EventMap, context?: unknown, explicitContext?: unknown): Receiver;
  off<Receiver>(this: Receiver, name?: string | null, callback?: EventCallback | null, context?: unknown): Receiver;
  off<Receiver>(this: Receiver, events: EventMap, context?: unknown, explicitContext?: unknown): Receiver;
  listenTo<Receiver>(this: Receiver, source: EventSource | null | undefined, name: string | EventMap, callback?: EventCallback): Receiver;
  listenToOnce<Receiver>(this: Receiver, source: EventSource | null | undefined, name: string | EventMap, callback?: EventCallback): Receiver;
  stopListening<Receiver>(this: Receiver, source?: EventSource | null, name?: string | EventMap | null, callback?: EventCallback | null): Receiver;
  trigger<Receiver>(this: Receiver, name: string, ...args: unknown[]): Receiver;
  trigger<Receiver>(this: Receiver, events: Record<string, unknown>): Receiver;
  triggerMethod: typeof triggerMethod;
}

type Callback = EventCallback & { _callback?: EventCallback };
type Registry = Record<string, Handler[]>;
type Listeners = Record<string, Listening>;

interface Handler {
  callback: Callback;
  context: unknown;
  ctx: unknown;
  listener?: Listening;
}

interface Source extends EventSource {
  _rdListenId?: string;
  _rdListeners?: Listeners;
}

type EventState = Events & Source & {
  _rdEvents?: Registry;
  _rdListeningTo?: Listeners;
};

interface Listening {
  obj: Source;
  listeneeId: string;
  listenerId: string;
  listeningTo: Listeners;
  count: number;
  interop: boolean;
  _rdEvents: Registry;
}

interface NormalizedEvent {
  name?: string | null;
  callback?: EventCallback | null;
  context?: unknown;
}

interface ListeningEvent extends NormalizedEvent {
  listener: Listening;
}

const objectKeys = Object.keys;
let listening: Listening | undefined;

function getKeys(object?: object | null) {
  return object == null ? [] : objectKeys(object);
}

// A module that can be mixed in to *any object* in order to provide it with
// a custom event channel. You may bind a callback to an event with `on` or
// remove with `off`; `trigger`-ing an event fires all callbacks in
// succession.
//
//     const object = Object.assign({}, Events);
//     object.on('expand', function() { alert('expanded'); });
//     object.trigger('expand');
//

// The reducing API that adds a callback to the `events` object.
const onApi = function({ events, name, callback, context, ctx, listener }: {
  events: Registry; name?: string | null; callback: EventCallback;
  context?: unknown; ctx: unknown; listener?: Listening;
}) {
  let handlers = Object.hasOwn(events, name as string) ? events[name as string] : undefined;
  if (!handlers) {
    handlers = [];
    setProperty(events, name, handlers);
  }
  handlers.push({ callback, context, ctx: context || ctx, listener });
  return events;
};

const onReducer = function(this: EventState, events: Registry, { name, callback, context }: NormalizedEvent) {
  if (!callback) { return events; }
  const listener = listening;
  events = onApi({ events, name, callback, context, ctx: this, listener });

  if (listener) {
    const listeners = this._rdListeners || (this._rdListeners = {});
    listeners[listener.listenerId] = listener;
    listener.count++;
    listener.interop = false;
  }

  return events;
};

const cleanupListener = function({ obj, listeneeId, listenerId, listeningTo }: Listening) {
  delete listeningTo[listeneeId];
  if (obj._rdListeners) { delete obj._rdListeners[listenerId]; }
};

// The reducing API that removes a callback from the `events` object.
const offReducer = function(events: Registry, { name, callback, context }: NormalizedEvent) {
  const names = name ? [name] : getKeys(events);

  for (let nameIndex = 0, namesLength = names.length; nameIndex < namesLength; nameIndex++) {
    const key = names[nameIndex];
    const handlers = Object.hasOwn(events, key) ? events[key] : undefined;

    // Bail out if there are no events stored.
    if (!handlers) { continue; }

    // Find any remaining events.
    const remaining: Handler[] = [];
    for (let index = 0, length = handlers.length; index < length; index++) {
      const handler = handlers[index];
      if (
        callback && callback !== handler.callback &&
          callback !== handler.callback._callback ||
            context && context !== handler.context
      ) {
        remaining.push(handler);
        continue;
      }

      // If not including event, clean up any related listener
      if (handler.listener) {
        const listener = handler.listener;
        listener.count--;
        if (!listener.count) { cleanupListener(listener); }
      }

    }
    events[key] = remaining;

    if (!events[key].length) { delete events[key]; }
  }

  return events;
};

const getListener = function(obj: Source, listenerObj: EventState): Listening {
  const listeneeId = obj._rdListenId || (obj._rdListenId = uniqueId('l'));
  const listeningTo = listenerObj._rdListeningTo || (listenerObj._rdListeningTo = {});
  const listener = listeningTo[listeneeId];

  // This listenerObj is not listening to any other events on `obj` yet.
  // Setup the necessary references to track the listening callbacks.
  if (!listener) {
    const listenerId = listenerObj._rdListenId || (listenerObj._rdListenId = uniqueId('l'));
    listeningTo[listeneeId] = {
      obj,
      listeneeId,
      listenerId,
      listeningTo,
      count: 0,
      interop: true,
      _rdEvents: {},
    };

    return listeningTo[listeneeId];
  }

  return listener;
};

const listenToApi = function({ name, callback, context, listener }: ListeningEvent) {
  if (!callback) { return; }

  const previousListening = listening;
  listening = listener;
  try {
    listener.obj.on(name as string, callback as (...args: unknown[]) => unknown, context);
  } finally {
    listening = previousListening;
  }

  if (listener.interop) {
    listener._rdEvents = onApi({
      events: listener._rdEvents,
      name,
      callback,
      context,
      ctx: context,
    });
  }
};

function buildOnceMap(eventArgs: NormalizedEvent[], offCallback: (name: string, callback: EventCallback) => unknown) {
  const events: EventMap = {};
  for (let index = 0, length = eventArgs.length; index < length; index++) {
    const { name, callback } = eventArgs[index];
    if (!callback) { continue; }
    const onceCallback = onceWrap(callback, callbackToRemove => {
      offCallback(name as string, callbackToRemove);
    });
    setProperty(events, name, onceCallback);
  }
  return events;
}

// Handles triggering the appropriate event callbacks.
const triggerApi = function({ events, name, args }: { events: Registry; name: unknown; args: unknown[] }) {
  const objEvents = Object.hasOwn(events, name as string) ? events[name as string] : undefined;
  const registeredAllEvents = Object.hasOwn(events, 'all') ? events.all : undefined;
  const allEvents = (objEvents && registeredAllEvents) ? registeredAllEvents.slice() : registeredAllEvents;
  if (objEvents) { triggerEvents(objEvents, args); }
  if (allEvents) { triggerEvents(allEvents, [name].concat(args)); }
};

const triggerEvents = function(events: Handler[], args: unknown[]) {
  for (let index = 0, length = events.length; index < length; index++) {
    const { callback, ctx } = events[index];
    callHandler(callback as (...args: unknown[]) => unknown, ctx, args);
  }
};

function reduceEventArgs<Context>(
  context: Context, eventArgs: NormalizedEvent[], events: Registry,
  reducer: (this: Context, events: Registry, args: NormalizedEvent) => Registry
) {
  for (let index = 0, length = eventArgs.length; index < length; index++) {
    events = reducer.call(context, events, eventArgs[index]);
  }

  return events;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- This declaration specializes generic methods for the implementation check only.
declare const eventContract: Events;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- The type and value occupy separate TypeScript namespaces.
const Events = {

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  on(this: EventState, name: string | EventMap, callback?: unknown, context?: unknown) {
    const eventArgs = buildEventArgs(name, callback, context) as NormalizedEvent[];
    this._rdEvents = reduceEventArgs(this, eventArgs, this._rdEvents || {}, onReducer);

    return this;
  },

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  off(this: EventState, name?: string | EventMap | null, callback?: unknown, context?: unknown) {
    if (!this._rdEvents) { return this; }

    // Delete all event listeners and "drop" events.
    if (!name && !context && !callback) {
      this._rdEvents = void 0;
      const listeners = this._rdListeners;
      const listenerIds = getKeys(listeners);
      for (let index = 0, length = listenerIds.length; index < length; index++) {
        const listenerId = listenerIds[index];
        cleanupListener(listeners![listenerId]);
      }
      return this;
    }

    const eventArgs = buildEventArgs(name, callback, context) as NormalizedEvent[];

    this._rdEvents = reduceEventArgs(undefined, eventArgs, this._rdEvents, offReducer);

    return this;
  },

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  once(this: EventState, name: string | EventMap, callback?: unknown, context?: unknown) {
    const eventArgs = buildEventArgs(name, callback, context) as NormalizedEvent[];
    const events = buildOnceMap(eventArgs, (this.off as (name: string, callback?: EventCallback) => unknown).bind(this));
    if (typeof name === 'string' && context == null) { callback = undefined; }

    return this.on(events, callback, context);
  },

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  listenTo(this: EventState, obj: Source | null | undefined, name: string | EventMap, callback?: EventCallback) {
    if (!obj) { return this; }

    const listener = getListener(obj, this);
    const eventArgs = buildEventArgs(name, callback, this, listener) as ListeningEvent[];
    for (let index = 0, length = eventArgs.length; index < length; index++) {
      listenToApi(eventArgs[index]);
    }

    return this;
  },

  // Inversion-of-control versions of `once`.
  listenToOnce(this: EventState, obj: Source | null | undefined, name: string | EventMap, callback?: EventCallback) {
    const eventArgs = buildEventArgs(name, callback, this) as NormalizedEvent[];
    const events = buildOnceMap(eventArgs, this.stopListening.bind(this, obj));

    return this.listenTo(obj, events);
  },

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  stopListening(this: EventState, obj?: Source | null, name?: string | EventMap | null, callback?: EventCallback | null) {
    const listeningTo = this._rdListeningTo;
    if (!listeningTo) { return this; }

    const eventArgs = buildEventArgs(name, callback, this) as NormalizedEvent[];

    const listenerIds = obj ? [obj._rdListenId] : getKeys(listeningTo);
    for (let i = 0, listenerIdsLength = listenerIds.length; i < listenerIdsLength; i++) {
      const listener = listeningTo[listenerIds[i] as string];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listener) { break; }

      for (let index = 0, length = eventArgs.length; index < length; index++) {
        const args = eventArgs[index];
        listener.obj.off(args.name, args.callback as ((...args: unknown[]) => unknown) | null | undefined, this);

        if (listener.interop) {
          listener._rdEvents = offReducer(listener._rdEvents, args);
          if (!getKeys(listener._rdEvents).length) { cleanupListener(listener); }
        }
      }
    }

    return this;
  },

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  trigger(this: EventState, name: string | Record<string, unknown>, ...args: unknown[]) {
    const events = this._rdEvents;
    if (!events) { return this; }

    if (name && typeof name === 'object') {
      const names = getKeys(name);
      for (let index = 0, length = names.length; index < length; index++) {
        const key = names[index];
        triggerApi({
          events,
          name: key,
          args: [name[key]],
        });
      }
      return this;
    }

    if (name && eventSplitter.test(name)) {
      const names = name.split(eventSplitter);
      for (let index = 0, length = names.length; index < length; index++) {
        const n = names[index];
        triggerApi({
          events,
          name: n,
          args,
        });
      }
      return this;
    }

    triggerApi({
      events,
      name,
      args,
    });

    return this;
  },

  triggerMethod,
  // Check every overload with the composed receiver, preserving more specific
  // receiver types in the exported contract below.
} satisfies {
  on: typeof eventContract.on<EventState>;
  off: typeof eventContract.off<EventState>;
  once: typeof eventContract.once<EventState>;
  listenTo: typeof eventContract.listenTo<EventState>;
  listenToOnce: typeof eventContract.listenToOnce<EventState>;
  stopListening: typeof eventContract.stopListening<EventState>;
  trigger: typeof eventContract.trigger<EventState>;
  triggerMethod: Events['triggerMethod'];
};

// The receiver gains these methods when the mixin is composed into an object.
export default Events as Events;
