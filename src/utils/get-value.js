export default function getValue(object, property, fallback) {
  const value = object == null ? undefined : object[property];
  const resolvedValue = value === undefined ? fallback : value;

  return typeof resolvedValue === 'function' ? resolvedValue.call(object) : resolvedValue;
}
