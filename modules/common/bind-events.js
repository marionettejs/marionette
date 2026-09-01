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

import normalizeMethods from './normalize-methods.js';
import MarionetteError from '../../utils/error.js';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

function normalizeBindings(context, bindings) {
  const bindingsType = typeof bindings;
  if (bindings === null || (bindingsType !== 'object' && bindingsType !== 'function')) {
    throw new MarionetteError({
      code: 'MN0009',
      message: 'Bindings must be an object.',
      url: 'common.html#bindevents'
    });
  }

  if (propertyIsEnumerable.call(bindings, '__proto__')) {
    throw new MarionetteError({
      code: 'MN0026',
      message: 'Entity event maps cannot include an own "__proto__" event name.',
      url: 'common.html#bindevents'
    });
  }

  return normalizeMethods.call(context, bindings);
}

function bindEvents(entity, bindings) {
  if (!entity || !bindings) { return this; }

  this.listenTo(entity, normalizeBindings(this, bindings));

  return this;
}

function unbindEvents(entity, bindings) {
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
  unbindEvents
};
