import { buildEventArgs, normalizeBindings } from '@marionette/utils';
import type { Bindings, EventCallback } from '@marionette/utils';
import cleanupSubscriptions from './cleanup-subscriptions.ts';

type Subscription = (source: unknown, name: string, callback: EventCallback, context: unknown) => () => void;
export interface SubscriptionApi {
  subscribe?: (source: never, name: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
}

type BindingArgs = { name: string; callback: EventCallback; context: unknown };

export default function subscribeBindings(
  context: unknown, Api: SubscriptionApi, source: unknown, bindings: Bindings
) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context) as BindingArgs[];
  const cleanups: Array<() => void> = [];
  const cleanup = function() {
    cleanupSubscriptions(cleanups.splice(0));
  };

  try {
    for (const { name, callback } of eventArgs) {
      cleanups.push((Api.subscribe as Subscription)(source, name, callback, context));
    }
  } catch (error) {
    try { cleanup(); } catch { /* Preserve the subscription setup error. */ }
    throw error;
  }

  return cleanup;
}
