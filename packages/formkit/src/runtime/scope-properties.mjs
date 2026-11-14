// Schema slot scopes intentionally include inherited enumerable aliases.
export function enumerableKeys(source) {
  const keys = [], seen = new Set();
  for (let current = source; current != null; current = Object.getPrototypeOf(current)) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (seen.has(key)) {
        continue;
      }
      // A non-enumerable own property also shadows an enumerable ancestor.
      seen.add(key);
      if (Object.prototype.propertyIsEnumerable.call(current, key)) {
        keys.push(key);
      }
    }
  }
  return keys;
}

export function defineScopeProperties(target, keys, readValue, descriptor = {}) {
  for (const key of keys) {
    Object.defineProperty(target, key, {...descriptor, get: () => readValue(key)});
  }
}
