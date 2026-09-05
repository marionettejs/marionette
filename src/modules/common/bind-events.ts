// Bind Entity Events & Unbind Entity Events
// -----------------------------------------
//
// These methods bind/unbind an evented entity (for example, a collection or model)
// to methods on a target object.
//
// The target must provide `listenTo` and `stopListening`. The entity must provide
// compatible `on` and `off` methods.
//
// The third parameter is a hash of { "event:name": "eventHandler" }
// configuration. Multiple handlers can be separated by a space. A
// function can be supplied instead of a string handler name.

import normalizeMethods from './normalize-methods.ts';
import MarionetteError from '../error.js';
import type { EventMap, EventSource } from '../../mixins/events.ts';
import type { Bindings } from './normalize-methods.ts';

interface Listener {
  listenTo(source: EventSource, bindings: EventMap): unknown;
}

interface ListeningOwner {
  stopListening(source: EventSource, bindings?: EventMap): unknown;
}

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

function normalizeBindings(context: unknown, bindings: unknown) {
  const bindingsType = typeof bindings;
  if (bindings === null || (bindingsType !== 'object' && bindingsType !== 'function')) {
    throw new (MarionetteError as unknown as new (options: object) => Error)({
      code: 'MN0009',
      message: 'Bindings must be an object.',
      url: 'common.html#bindevents'
    });
  }

  if (propertyIsEnumerable.call(bindings, '__proto__')) {
    throw new (MarionetteError as unknown as new (options: object) => Error)({
      code: 'MN0026',
      message: 'Entity event maps cannot include an own "__proto__" event name.',
      url: 'common.html#bindevents'
    });
  }

  // The object/function check above excludes every no-map return.
  return normalizeMethods.call(context, bindings as Bindings) as EventMap;
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
