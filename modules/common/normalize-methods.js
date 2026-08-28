import { reduce, isFunction, isString } from 'underscore';
import MarionetteError from '../../utils/error.js';

// Marionette.normalizeMethods
// ----------------------

// Pass in a mapping of events => functions or function names
// and return a mapping of events => functions
const resolveMethod = function(context, method, name) {
  if (isFunction(method)) { return method; }

  const methodName = method;
  const resolvedMethod = isString(methodName) ? context[methodName] : undefined;

  if (!isFunction(resolvedMethod)) {
    let methodLabel = '<unprintable>';
    try {
      methodLabel = String(methodName);
    } catch {
      // Preserve the stable fallback for values without string coercion.
    }

    throw new MarionetteError({
      code: 'MN0019',
      message: `The handler "${methodLabel}" for "${name}" must resolve to a function.`
    });
  }

  return resolvedMethod;
};

const normalizeMethods = function(hash) {
  if (!hash) { return }

  return reduce(hash, (normalizedHash, method, name) => {
    normalizedHash[name] = resolveMethod(this, method, name);
    return normalizedHash;
  }, {});
};

export default normalizeMethods;
export { resolveMethod };
