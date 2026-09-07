import { buildEventArgs, normalizeBindings } from '@marionette/utils';
import type { Bindings, EventCallback } from '@marionette/utils';

type Subscription = (source: unknown, name: string, callback: EventCallback, context: unknown) => () => void;
export interface SubscriptionApi {
  subscribe?: (source: never, name: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
}

type BindingArgs = { name: string; callback: EventCallback; context: unknown };

export default function subscribeBindings(
  context: unknown, Api: SubscriptionApi, source: unknown, bindings: Bindings
) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context) as BindingArgs[];
  const cleanups = eventArgs.map(({ name, callback }) =>
    (Api.subscribe as Subscription)(source, name, callback, context)
  );

  return function() {
    cleanups.forEach(cleanup => cleanup());
  };
}
