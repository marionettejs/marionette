// Marionette.extend
// -----------------

import assignIn, { assignOwn } from './assign-in.js';

function defineOwnDataProperties(target, source) {
  const type = typeof source;
  if (source == null || type !== 'object' && type !== 'function') { return target; }

  for (const key of Object.keys(source)) {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value: source[key],
      writable: true
    });
  }

  return target;
}

// Borrowed from backbone.js
export default function(protoProps, staticProps) {
  const parent = this;
  let child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.
  if (protoProps && Object.hasOwn(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function() { return parent.apply(this, arguments); };
  }

  // Add static properties to the constructor function, if supplied.
  assignIn(child, parent);
  assignOwn(child, staticProps);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function and add the prototype properties.
  child.prototype = Object.create(parent.prototype);
  defineOwnDataProperties(child.prototype, protoProps);
  child.prototype.constructor = child;

  // Set a convenience property in case the parent's prototype is needed
  // later.
  child.__super__ = parent.prototype;

  return child;
}
