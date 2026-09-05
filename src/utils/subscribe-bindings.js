import buildEventArgs from './build-event-args.ts';
import disposeAll from './dispose-all.ts';
import MarionetteError from '../modules/error.js';
import { normalizeBindings } from '../modules/common/bind-events.ts';

export function normalizeCleanup(cleanup, methodName) {
  if (typeof cleanup !== 'function') {
    throw new MarionetteError({
      code: 'MN0038',
      name: 'AdapterError',
      message: `${ methodName }() must return a cleanup function.`,
      url: 'data.api.html#adapter-cleanup'
    });
  }

  let isDisposed = false;
  return function() {
    if (isDisposed) { return; }
    isDisposed = true;
    cleanup();
  };
}

export default function subscribeBindings(context, Api, source, bindings, apiName) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context);
  const subscriptions = [];

  try {
    for (let index = 0; index < eventArgs.length; index++) {
      if (context._isDestroyed) { break; }

      const { name, callback, context: eventContext } = eventArgs[index];
      const cleanup = Api.subscribe(source, name, callback, eventContext);
      subscriptions.push(normalizeCleanup(cleanup, `${ apiName }.subscribe`));
    }
  } catch (error) {
    disposeAll(subscriptions, error);
  }

  let isDisposed = false;
  const cleanup = function() {
    if (isDisposed) { return; }
    isDisposed = true;
    disposeAll(subscriptions);
  };

  if (context._isDestroyed) { cleanup(); }
  return cleanup;
}
