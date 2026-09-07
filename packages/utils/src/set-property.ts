export default function setProperty(target: unknown, key: unknown, value: unknown) {
  if (key === '__proto__') {
    Object.defineProperty(target, key as PropertyKey, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    (target as Record<PropertyKey, unknown>)[key as PropertyKey] = value;
  }
}
