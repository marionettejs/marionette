import { buildEventArgs, normalizeBindings } from '@marionette/utils';
import type { Bindings, EventCallback } from '@marionette/utils';
import type { StateApi } from '../runtime/state-api.ts';

type Subscription = (source: unknown, name: string, callback: EventCallback, context: unknown) => () => void;
type BindingArgs = { name: string; callback: EventCallback; context: unknown };

export default function subscribeBindings(
  context: unknown, Api: Partial<StateApi<never>>, source: unknown, bindings: Bindings
) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context) as BindingArgs[];
  const cleanups = eventArgs.map(({ name, callback }) =>
    (Api.subscribe as Subscription)(source, name, callback, context)
  );

  return function() {
    cleanups.forEach(cleanup => cleanup());
  };
}
