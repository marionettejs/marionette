import type { SelectionKey } from './child-app-switcher.ts';

type RecordKey = { [name: string]: SelectionKey };
const invalidKey = () => new TypeError('Selection keys must be acyclic primitive, array or plain data values');

// Capture values before lifecycle callbacks can mutate caller-owned identity.
// Ancestors, rather than all visited values, reject cycles while allowing aliases.
export function snapshotKey(value: SelectionKey, ancestors?: Set<object>, copies?: WeakMap<object, SelectionKey>): SelectionKey {
  if (value === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof value)) { return value; }
  if (typeof value !== 'object') { throw invalidKey(); }
  const path = ancestors ?? new Set<object>();
  if (path.has(value)) { throw invalidKey(); }
  const memo = copies ?? new WeakMap<object, SelectionKey>();
  const existing = memo.get(value);
  if (existing) { return existing; }
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) { throw invalidKey(); }
  const copy: RecordKey | SelectionKey[] = array ? new Array(value.length) : Object.create(null);
  path.add(value);
  memo.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') { continue; }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) { throw invalidKey(); }
    if (array && (!Number.isInteger(Number(key)) || Number(key) < 0 || Number(key) >= value.length || String(Number(key)) !== key)) { throw invalidKey(); }
    Object.defineProperty(copy, key, {
      value: snapshotKey(descriptor.value, path, memo), enumerable: true, writable: true, configurable: true,
    });
  }
  path.delete(value);
  return copy;
}

export function equalKeys(a: SelectionKey, b: SelectionKey, pairs?: WeakMap<object, WeakSet<object>>): boolean {
  if (Object.is(a, b)) { return true; }
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) { return false; }
  if (Array.isArray(a) !== Array.isArray(b)) { return false; }
  if (Array.isArray(a) && a.length !== (b as readonly SelectionKey[]).length) { return false; }
  if (pairs?.get(a)?.has(b)) { return true; }
  const left = a as RecordKey;
  const right = b as RecordKey;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) { return false; }
  const memo = pairs ?? new WeakMap<object, WeakSet<object>>();
  const equal = keys.every(key => Object.hasOwn(right, key) && equalKeys(left[key], right[key], memo));
  if (equal) {
    const matches = memo.get(a) ?? new WeakSet<object>();
    matches.add(b);
    memo.set(a, matches);
  }
  return equal;
}
