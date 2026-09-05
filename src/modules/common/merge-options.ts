import { setProperty } from '../../utils/assign-in.js';
import MarionetteError from '../error.js';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

// Merge `keys` from `options` onto `this`
function mergeOptions(this: unknown, options?: null | undefined, keys?: unknown): void;
function mergeOptions(this: object, options: unknown, keys: readonly unknown[]): void;
function mergeOptions(this: unknown, options?: unknown, keys?: unknown): void {
  if (options == null) { return; }

  if (!Array.isArray(keys)) {
    throw new (MarionetteError as unknown as new (options: object) => Error)({
      code: 'MN0033',
      message: 'The mergeOptions keys argument must be an array.',
      url: 'common.html#mergeoptions'
    });
  }

  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const key = keys[index];
    if (typeof key !== 'string' || !propertyIsEnumerable.call(options, key)) { continue; }

    const option = (options as Record<string, unknown>)[key];
    if (option !== undefined) {
      setProperty(this, key, option);
    }
  }
}

export default mergeOptions;
