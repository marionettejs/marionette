import buildEventArgs from './build-event-args.ts';
import disposeAll from './dispose-all.ts';
import MarionetteError from '../modules/error.ts';
import { normalizeBindings } from '../modules/common/bind-events.ts';
import type { EventCallback } from '../mixins/events.ts';
import type { StateApi } from '../runtime/state-api.ts';

export interface SubscriptionOwner {
  _isDestroyed?: boolean;
}

type Subscription = (source: unknown, name: string, callback: EventCallback, context: unknown) => unknown;
type BindingArgs = { name: string; callback: EventCallback; context: unknown };

export function normalizeCleanup(cleanup: unknown, methodName: string) {
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

export default function subscribeBindings(
  context: SubscriptionOwner, Api: Partial<StateApi<never>>, source: unknown, bindings: unknown, apiName: string
) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context) as BindingArgs[];
  const subscriptions: Array<() => void> = [];

  try {
    for (let index = 0; index < eventArgs.length; index++) {
      if (context._isDestroyed) { break; }

      const { name, callback, context: eventContext } = eventArgs[index];
      const cleanup = (Api.subscribe as Subscription)(source, name, callback, eventContext);
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
