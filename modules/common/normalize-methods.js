import { reduce, isFunction } from 'underscore';

// Marionette.normalizeMethods
// ----------------------

// Pass in a mapping of events => functions or function names
// and return a mapping of events => functions
const normalizeMethods = function(hash) {
  if (!hash) { return }

  return reduce(hash, (normalizedHash, method, name) => {
    if (!isFunction(method)) {
      method = this[method];
    }
    if (method) {
      normalizedHash[name] = method;
    }
    return normalizedHash;
  }, {});
};

export default normalizeMethods;
