// Detached data snapshots for the opt-in commit channel, never the Core value itself.
const tagOf = value => Object.prototype.toString.call(value);
const typedArrays = { Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array };

export function captureValue(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function') { throw new TypeError('Field commit values cannot capture callable objects.'); }
    return value;
  }
  if (seen.has(value)) { return seen.get(value); }
  const tag = tagOf(value);
  if (tag === '[object File]' || tag === '[object Blob]') {
    for (let prototype = Object.getPrototypeOf(value); prototype; prototype = Object.getPrototypeOf(prototype)) {
      if (prototype.constructor?.name === 'Blob' && Object.prototype.hasOwnProperty.call(prototype, 'slice')) {
        Reflect.apply(prototype.slice, value, [0, 0]); return value;
      }
    }
    throw new TypeError('Field commit file values require an immutable Blob data handle.');
  }
  if (tag === '[object Date]') { const copy = new Date(Date.prototype.getTime.call(value)); seen.set(value, copy); return Object.freeze(copy); }
  if (tag === '[object RegExp]') { const copy = new RegExp(value.source, value.flags); seen.set(value, copy); copy.lastIndex = value.lastIndex; return Object.freeze(copy); }
  if (tag === '[object ArrayBuffer]') { const copy = ArrayBuffer.prototype.slice.call(value, 0); seen.set(value, copy); return copy; }
  if (ArrayBuffer.isView(value)) {
    const buffer = captureValue(value.buffer, seen);
    const Type = typedArrays[tag.slice(8, -1)];
    const copy = tag === '[object DataView]' ? new DataView(buffer, value.byteOffset, value.byteLength) :
      Type ? new Type(buffer, value.byteOffset, value.length) : undefined;
    if (copy) { seen.set(value, copy); return copy; }
  }
  if (tag === '[object Map]') {
    const copy = new Map(); seen.set(value, copy);
    for (const [key, part] of Map.prototype.entries.call(value)) { copy.set(captureValue(key, seen), captureValue(part, seen)); }
    return Object.freeze(copy);
  }
  if (tag === '[object Set]') {
    const copy = new Set(); seen.set(value, copy);
    for (const part of Set.prototype.values.call(value)) { copy.add(captureValue(part, seen)); }
    return Object.freeze(copy);
  }
  const prototype = Object.getPrototypeOf(value);
  const plain = prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null && prototype.constructor?.name === 'Object';
  if (!Array.isArray(value) && !plain) { throw new TypeError('Field commit values require supported data objects.'); }
  const copy = Array.isArray(value) ? new Array(value.length) : Object.create(prototype === null ? null : Object.prototype);
  seen.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    if (Object.prototype.propertyIsEnumerable.call(value, key)) { Object.defineProperty(copy, key, { value: captureValue(value[key], seen), enumerable: true }); }
  }
  return Object.freeze(copy);
}

export function sameValue(left, right, seen = new Map()) {
  if (Object.is(left, right)) { return true; }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') { return false; }
  const tag = tagOf(left); if (tag !== tagOf(right)) { return false; }
  if (seen.has(left)) { return seen.get(left) === right; } seen.set(left, right);
  if (tag === '[object Date]') { return Object.is(left.getTime(), right.getTime()); }
  if (tag === '[object RegExp]') { return left.source === right.source && left.flags === right.flags && left.lastIndex === right.lastIndex; }
  if (tag === '[object File]' || tag === '[object Blob]') { return false; }
  if (tag === '[object Map]' || tag === '[object Set]') {
    if (left.size !== right.size) { return false; }
    const a = [...left], b = [...right]; return a.every((part, index) => sameValue(part, b[index], seen));
  }
  if (tag === '[object ArrayBuffer]' || ArrayBuffer.isView(left)) {
    const a = tag === '[object ArrayBuffer]' ? new Uint8Array(left) : new Uint8Array(left.buffer, left.byteOffset, left.byteLength);
    const b = tag === '[object ArrayBuffer]' ? new Uint8Array(right) : new Uint8Array(right.buffer, right.byteOffset, right.byteLength);
    return a.length === b.length && a.every((byte, index) => byte === b[index]);
  }
  if (Array.isArray(left) && left.length !== right.length) { return false; }
  const a = Reflect.ownKeys(left).filter(key => Object.prototype.propertyIsEnumerable.call(left, key));
  const b = Reflect.ownKeys(right).filter(key => Object.prototype.propertyIsEnumerable.call(right, key));
  return a.length === b.length && a.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key], seen));
}
