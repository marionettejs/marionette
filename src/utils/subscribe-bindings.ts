import { buildEventArgs, normalizeBindings } from '@mnjs/utils';
import type { Bindings, EventCallback } from '@mnjs/utils';

type Subscription = (source: unknown, name: string, callback: EventCallback, context: unknown) => () => void;
export interface SubscriptionApi {
  subscribe?: (source: never, name: string, callback: (...args: unknown[]) => unknown, context?: unknown) => () => void;
}

type BindingArgs = { name: string; callback: EventCallback; context: unknown };

export default function subscribeBindings<Context>(
  context: Context, Api: SubscriptionApi, source: unknown, bindings: Bindings,
  shouldDeliver?: (context: Context) => boolean
) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context) as BindingArgs[];
  const cleanups = eventArgs.map(({ name, callback }) => {
    const handler = shouldDeliver ? (...args: never[]) => {
      if (shouldDeliver(context)) { return callback.apply(context, args); }
    } : callback;
    return (Api.subscribe as Subscription)(source, name, handler, context);
  });

  return function() {
    cleanups.forEach(cleanup => cleanup());
  };
}
