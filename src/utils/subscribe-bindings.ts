import buildEventArgs from './build-event-args.ts';
import { normalizeBindings } from '../modules/common/bind-events.ts';
import type { EventCallback } from '../mixins/events.ts';
import type { StateApi } from '../runtime/state-api.ts';

type Subscription = (source: unknown, name: string, callback: EventCallback, context: unknown) => () => void;
type BindingArgs = { name: string; callback: EventCallback; context: unknown };

export default function subscribeBindings(
  context: unknown, Api: Partial<StateApi<never>>, source: unknown, bindings: unknown
) {
  const eventArgs = buildEventArgs(normalizeBindings(context, bindings), context) as BindingArgs[];
  const cleanups = eventArgs.map(({ name, callback }) =>
    (Api.subscribe as Subscription)(source, name, callback, context)
  );

  return function() {
    cleanups.forEach(cleanup => cleanup());
  };
}
