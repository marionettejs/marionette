// Bind Entity Events & Unbind Entity Events
// -----------------------------------------
//
// These methods bind/unbind an evented entity (for example, a collection or model)
// to methods on a target object.
//
// The target must provide `listenTo` and `stopListening`. The entity must provide
// compatible `on` and `off` methods.
//
// Call with the target as `this`, then the entity and a bindings map.
// Each value is one handler name or function. Space-separated event names
// belong in the map key; handler names are not split.

import normalizeMethods from './normalize-methods.ts';
import MarionetteError from './error.ts';
import type { EventMap, EventSource } from './events.ts';
import type { Bindings } from './normalize-methods.ts';

interface Listener {
  listenTo(source: EventSource, bindings: EventMap): unknown;
}

interface ListeningOwner {
  stopListening(source: EventSource, bindings?: EventMap): unknown;
}

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

function normalizeBindings(context: unknown, bindings: Bindings) {
  if (propertyIsEnumerable.call(bindings, '__proto__')) {
    throw new MarionetteError({
      code: 'MN0026',
      message: 'Entity event maps cannot include an own "__proto__" event name.',
      url: 'common.html#bindevents'
    });
  }

  return normalizeMethods.call(context, bindings) as EventMap;
}

function bindEvents<Receiver extends Listener>(
  this: Receiver, entity?: EventSource | null | false | 0 | 0n | '', bindings?: Bindings | null | false | 0 | 0n | ''
) {
  if (!entity || !bindings) { return this; }

  this.listenTo(entity, normalizeBindings(this, bindings));

  return this;
}

function unbindEvents<Receiver extends ListeningOwner>(
  this: Receiver, entity?: EventSource | null | false | 0 | 0n | '', bindings?: Bindings | null | false | 0 | 0n | ''
) {
  if (!entity) { return this; }

  if (!bindings) {
    this.stopListening(entity);
    return this;
  }

  this.stopListening(entity, normalizeBindings(this, bindings));

  return this;
}

// Export Public API
export {
  bindEvents,
  normalizeBindings,
  unbindEvents
};
