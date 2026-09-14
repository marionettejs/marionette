import { debugLog, log } from './debug.ts';
import { setProperty, callHandler, onceWrap } from '@mnjs/utils';

/*
 * Requests
 * -----------------------
 * A messaging system for requesting data.
 *
 */

export interface Requests {
  reply<Receiver>(this: Receiver, name: string | Record<string, unknown>, callback?: unknown, context?: unknown): Receiver;
  replyOnce<Receiver>(this: Receiver, name: string | Record<string, unknown>, callback?: unknown, context?: unknown): Receiver;
  stopReplying<Receiver>(this: Receiver, name?: string | Record<string, unknown> | null, callback?: unknown, context?: unknown): Receiver;
  request(name: string, ...args: unknown[]): unknown;
  request(requests: Record<string, unknown>, ...args: unknown[]): Record<string, unknown>;
}

type Callback = ((...args: unknown[]) => unknown) & { _callback?: unknown };
type Registry = Record<string, { callback: Callback; context: unknown }>;
type RequestState = Requests & {
  _rdRequests?: Registry;
  _debugLog?: typeof debugLog;
  _log?: typeof log;
  channelName?: string;
  _tunedIn?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- This declaration specializes generic methods for the implementation check only.
declare const requestContract: Requests;

const objectKeys = Object.keys;

// Wrap a non-function reply value and retain it for stopReplying matching.
function makeCallback(callback: unknown): Callback {
  if (typeof callback === 'function') {
    return callback as Callback;
  }
  const result = function() { return callback; };
  result._callback = callback;
  return result;
}

function getDebugLog(channel: RequestState) {
  return channel._debugLog || debugLog;
}

function getKeys(object: unknown) {
  const type = typeof object;
  return object != null && (type === 'object' || type === 'function') ? objectKeys(object) : [];
}

const registerReply = function(this: RequestState, requests: Registry, name: string, callback: unknown, context: unknown) {
  if (Object.hasOwn(requests, name)) {
    getDebugLog(this)('A request was overwritten', name, this.channelName);
  }

  setProperty(requests, name, {
    callback: makeCallback(callback),
    context: context || this,
  });

  return requests;
};

const stopReducer = function(requests: Registry, { name, callback, context }: {
  name?: string | null; callback?: unknown; context?: unknown;
}) {
  const names = name == null ? getKeys(requests) : [name];

  for (let index = 0, length = names.length; index < length; index++) {
    const key = names[index];
    const handler = Object.hasOwn(requests, key) ? requests[key] : undefined;

    // Skip absent replies and replies that do not match the supplied filters.
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

function dispatchOverload(
  receiver: RequestState, method: 'reply' | 'replyOnce' | 'stopReplying',
  name: string | Record<string, unknown> | null | undefined, callback: unknown, context: unknown
) {
  if (name && typeof name === 'object') {
    const names = getKeys(name);
    const mapContext = context || callback;
    for (let index = 0, length = names.length; index < length; index++) {
      const key = names[index];
      receiver[method](key, name[key], mapContext);
    }
    return true;
  }

  return false;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare -- The type and value occupy separate TypeScript namespaces.
export const Requests = {

  // Set up a handler for a request
  reply(this: RequestState, name: string | Record<string, unknown>, callback?: unknown, context?: unknown) {
    if (dispatchOverload(this, 'reply', name, callback, context)) { return this; }

    this._rdRequests = registerReply.call(this, this._rdRequests || {}, name as string, callback, context);

    return this;
  },

  // Set up a handler that can only be requested once
  replyOnce(this: RequestState, name: string | Record<string, unknown>, callback?: unknown, context?: unknown) {
    if (dispatchOverload(this, 'replyOnce', name, callback, context)) { return this; }

    const onceCallback = onceWrap(makeCallback(callback), callbackToRemove => {
      this.stopReplying(name, callbackToRemove);
    });

    return this.reply(name, onceCallback, context);
  },

  // Remove handler(s)
  stopReplying(this: RequestState, name?: string | Record<string, unknown> | null, callback?: unknown, context?: unknown) {
    if (dispatchOverload(this, 'stopReplying', name, callback, context)) { return this; }
    if (!this._rdRequests) { return this; }

    if (name == null && !callback && !context) {
      delete this._rdRequests;
      return this;
    }

    this._rdRequests = stopReducer.call(this, this._rdRequests, { name, callback, context } as Parameters<typeof stopReducer>[1]);

    return this;
  },

  // Make a request
  request(this: RequestState, name: string | Record<string, unknown>, ...args: unknown[]): unknown {
    if (name && typeof name === 'object') {
      const replies: Record<string, unknown> = {};
      const names = getKeys(name);
      for (let index = 0, length = names.length; index < length; index++) {
        const key = names[index];
        const result = this.request(key, name[key], ...args);
        setProperty(replies, key, result);
      }
      return replies;
    }

    const channelName = this.channelName;
    const requests = this._rdRequests;

    // Log requests while the channel is tuned in.
    if (channelName && this._tunedIn) {
      (this._log || log)(channelName, name as string, ...args);
    }

    // Prefer an exact reply, then the default reply with the request name.
    // If neither exists, call the debug hook below and return undefined.
    if (requests) {
      const hasRequest = Object.hasOwn(requests, name);
      const handler = hasRequest ? requests[name] :
        Object.hasOwn(requests, 'default') ? requests.default : undefined;

      if (handler) {
        if (hasRequest) {
          return callHandler(handler.callback, handler.context, args);
        }
        return callHandler(handler.callback, handler.context, arguments);
      }
    }

    getDebugLog(this)('An unhandled request was fired', name, channelName);
  },
} satisfies {
  reply: typeof requestContract.reply<RequestState>;
  replyOnce: typeof requestContract.replyOnce<RequestState>;
  stopReplying: typeof requestContract.stopReplying<RequestState>;
  request: (name: string | Record<string, unknown>, ...args: unknown[]) => unknown;
  // The receiver gains these methods when composed; request maps return the
  // record assembled above while individual request results remain unknown.
} as Requests;

export default Requests;
