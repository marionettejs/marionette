export default function getValue(object?: unknown, property?: unknown, fallback?: unknown): unknown {
  const value = object == null ? undefined : (object as Record<PropertyKey, unknown>)[property as PropertyKey];
  const resolvedValue = value === undefined ? fallback : value;

  return typeof resolvedValue === 'function' ? resolvedValue.call(object) : resolvedValue;
}
