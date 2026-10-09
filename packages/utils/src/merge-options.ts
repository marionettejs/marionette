import setProperty from './set-property.ts';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

// Merge `keys` from `options` onto `this`
function mergeOptions(this: unknown, options?: null | undefined, keys?: unknown): void;
function mergeOptions(this: object, options: unknown, keys: readonly unknown[]): void;
function mergeOptions(this: unknown, options?: unknown, keys?: unknown): void {
  if (options == null) { return; }

  const optionKeys = keys as readonly unknown[];
  const length = optionKeys.length;
  for (let index = 0; index < length; index++) {
    const key = optionKeys[index];
    if (typeof key !== 'string' || !propertyIsEnumerable.call(options, key)) { continue; }

    const option = (options as Record<string, unknown>)[key];
    if (option !== undefined) {
      setProperty(this, key, option);
    }
  }
}

export default mergeOptions;
