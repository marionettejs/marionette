// Event names do not encode payload types; registration accepts typed handlers.
export type EventCallback = (...args: never[]) => unknown;

export interface Source {
  on(name: string, callback?: (...args: unknown[]) => unknown, context?: unknown): unknown;
  off(name?: string | null, callback?: ((...args: unknown[]) => unknown) | null, context?: unknown): unknown;
}

interface TriggerTarget {
  trigger: EventCallback;
}

export interface EventSource extends Source {
  on(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  on(events: Record<string, EventCallback>, context?: unknown, explicitContext?: unknown): this;
  once(name: string | Record<string, EventCallback>, callback?: EventCallback, context?: unknown): this;
  once(events: Record<string, EventCallback>, context?: unknown, explicitContext?: unknown): this;
  off(name?: string | null, callback?: EventCallback | null, context?: unknown): this;
  off(events: Record<string, EventCallback>, context?: unknown, explicitContext?: unknown): this;
  trigger(name: string, ...args: unknown[]): this;
  trigger(events: Record<string, unknown>): this;
  triggerMethod: TriggerMethod;
  listenTo(source: Source | null | undefined, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  listenToOnce(source: Source | null | undefined, name: string | Record<string, EventCallback>, callback?: EventCallback): this;
  stopListening(source?: Source | null, name?: string | Record<string, EventCallback> | null, callback?: EventCallback | null): this;
}


export interface TriggerMethod {
  (this: TriggerTarget, eventName: string, ...args: unknown[]): unknown;
}
