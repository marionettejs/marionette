type EventName = string | null | undefined | false | 0;

export interface EventArgs<Listener = unknown> {
  name: EventName;
  callback: unknown;
  context: unknown;
  listener: Listener;
}

// Whitespace expression retained for the Requests API.
export const eventSplitter = /\s+/;

// Builds one descriptor per literal event name or own event-map key.
export default function buildEventArgs<Listener>(
  name: EventName | object, callback: unknown, context: unknown, listener: Listener
): EventArgs<Listener>[];
export default function buildEventArgs(
  name?: EventName | object, callback?: unknown, context?: unknown
): EventArgs<undefined>[];
export default function buildEventArgs(
  name?: EventName | object, callback?: unknown, context?: unknown, listener?: unknown
): EventArgs[] {
  if (name && typeof name === 'object') {
    const eventContext = context === undefined ? callback : context;
    const eventArgs = [];
    const names = Object.keys(name);
    for (let i = 0; i < names.length; i++) {
      const key = names[i];
      eventArgs.push({ name: key, callback: (name as Record<string, unknown>)[key], context: eventContext, listener });
    }
    return eventArgs;
  }

  return [{ name, callback, context, listener }];
}
