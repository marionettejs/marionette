export default function eachOwn<Value, Source>(
  object: Source, iteratee: (value: Value, key: string, source: Source) => unknown
): Source {
  if (object == null) { return object; }

  const keys = Object.keys(object);
  for (const key of keys) {
    iteratee((object as Record<string, Value>)[key], key, object);
  }

  return object;
}
