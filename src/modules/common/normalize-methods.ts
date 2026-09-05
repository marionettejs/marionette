import MarionetteError from '../error.js';
import { setProperty } from '../../utils/assign-in.js';
import isString from '../../utils/is-string.js';
import type { EventCallback, EventMap } from '../../mixins/events.ts';

// Values are checked when method references are resolved.
export type Bindings = object;
type OptionalBindings = Bindings | null | false | 0 | '' | undefined;

// Marionette.normalizeMethods
// ----------------------

// Pass in a mapping of events => functions or function names
// and return a mapping of events => functions
const resolveMethod = function(context: unknown, method: unknown, name: string): EventCallback {
  if (typeof method === 'function') { return method as EventCallback; }

  const methodName = method;
  const resolvedMethod = isString(methodName) ?
    (context as Record<string, unknown>)[methodName as string] : undefined;

  if (typeof resolvedMethod !== 'function') {
    let methodLabel = '<unprintable>';
    try {
      methodLabel = String(methodName);
    } catch {
      // Preserve the stable fallback for values without string coercion.
    }

    throw new (MarionetteError as unknown as new (options: object) => Error)({
      code: 'MN0019',
      message: `The handler "${methodLabel}" for "${name}" must resolve to a function.`
    });
  }

  return resolvedMethod as EventCallback;
};

function normalizeMethods(this: unknown, hash?: null | false | 0 | ''): undefined;
function normalizeMethods(this: unknown, hash: Bindings): EventMap;
function normalizeMethods(this: unknown, hash?: OptionalBindings): EventMap | undefined;
function normalizeMethods(this: unknown, hash?: OptionalBindings) {
  if (!hash) { return; }

  const normalizedHash: EventMap = {};

  for (const name of Object.keys(hash)) {
    setProperty(normalizedHash, name, resolveMethod(this, (hash as Record<string, unknown>)[name], name));
  }

  return normalizedHash;
}

export default normalizeMethods;
export { resolveMethod };
