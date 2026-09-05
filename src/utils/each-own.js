export default function eachOwn(object, iteratee) {
  if (object == null) { return object; }

  const keys = Object.keys(object);
  for (const key of keys) {
    iteratee(object[key], key, object);
  }

  return object;
}
