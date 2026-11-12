import type { SelectionKey } from './selection.ts';

const isPrimitive = (value: unknown) => value === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof value);
const invalidKey = () => new TypeError('A selection key must be a primitive or a plain object of primitives');

export function snapshotKey(value: SelectionKey): SelectionKey {
  if (isPrimitive(value)) {return value;}
  const prototype = typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
  if (prototype !== Object.prototype && prototype !== null) {throw invalidKey();}
  const copy = Object.create(null) as Record<string, string | number | boolean | null | undefined>;
  for (const [name, item] of Object.entries(value!)) {
    if (!isPrimitive(item)) {throw invalidKey();}
    copy[name] = item;
  }
  return copy;
}

export function equalKeys(a: SelectionKey, b: SelectionKey): boolean {
  if (Object.is(a, b)) {return true;}
  if (isPrimitive(a) || isPrimitive(b)) {return false;}
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const names = Object.keys(left);
  return names.length === Object.keys(right).length && names.every(name => Object.hasOwn(right, name) && Object.is(left[name], right[name]));
}
