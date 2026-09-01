import MarionetteError from '../../utils/error.js';
import { setProperty } from '../../utils/assign-in.js';
import isString from '../../utils/is-string.js';

// Marionette.normalizeMethods
// ----------------------

// Pass in a mapping of events => functions or function names
// and return a mapping of events => functions
const resolveMethod = function(context, method, name) {
  if (typeof method === 'function') { return method; }

  const methodName = method;
  const resolvedMethod = isString(methodName) ?
    context[methodName] : undefined;

  if (typeof resolvedMethod !== 'function') {
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
  if (!hash) { return; }

  const normalizedHash = {};

  for (const name of Object.keys(hash)) {
    setProperty(normalizedHash, name, resolveMethod(this, hash[name], name));
  }

  return normalizedHash;
};

export default normalizeMethods;
export { resolveMethod };
