import { reduce, isFunction, isString } from 'underscore';
import MarionetteError from '../../utils/error.js';

// Marionette.normalizeMethods
// ----------------------

// Pass in a mapping of events => functions or function names
// and return a mapping of events => functions
const resolveMethod = function(context, method, name) {
  if (isFunction(method)) { return method; }

  const methodName = method;
  const resolvedMethod = context[methodName];

  if (isString(methodName) && !isFunction(resolvedMethod)) {
    throw new MarionetteError({
      code: 'MN0019',
      message: `The handler "${methodName}" for "${name}" must resolve to a function.`
    });
  }

  return resolvedMethod;
};

const normalizeMethods = function(hash) {
  if (!hash) { return }

  return reduce(hash, (normalizedHash, method, name) => {
    method = resolveMethod(this, method, name);
    if (method) {
      normalizedHash[name] = method;
    }
    return normalizedHash;
  }, {});
};

export default normalizeMethods;
export { resolveMethod };
