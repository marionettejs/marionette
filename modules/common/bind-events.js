// Bind Entity Events & Unbind Entity Events
// -----------------------------------------
//
// These methods are used to bind/unbind a backbone "entity" (e.g. collection/model)
// to methods on a target object.
//
// The first parameter, `target`, must have the Backbone.Events module mixed in.
//
// The second parameter is the `entity` (Backbone.Model, Backbone.Collection or
// any object that has Backbone.Events mixed in) to bind the events from.
//
// The third parameter is a hash of { "event:name": "eventHandler" }
// configuration. Multiple handlers can be separated by a space. A
// function can be supplied instead of a string handler name.

import { isObject } from 'underscore';
import normalizeMethods from './normalize-methods';
import MarionetteError from '../../utils/error';

function normalizeBindings(context, bindings) {
  if (!isObject(bindings)) {
    throw new MarionetteError({
      message: 'Bindings must be an object.',
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
