import type { SelectionKey } from './route-outlet.ts';

/*
 * Structural equality for primitive, array, and plain-object selection keys.
 * @param a
 * @param b
 */
export function isEqual(a: SelectionKey, b: SelectionKey): boolean {
  if (Object.is(a, b)) { return true; }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) { return false; }
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
  }
  if (Array.isArray(b)) { return false; }
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length &&
    keys.every(key => Object.hasOwn(b, key) && isEqual(a[key], b[key]));
}
