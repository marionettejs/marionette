export function setProperty(target: object, key: string, value: unknown) {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    (target as Record<string, unknown>)[key] = value;
  }
}

export default function assignOwn<Target extends object>(target: Target, ...sources: unknown[]): Target {
  for (const source of sources) {
    const type = typeof source;
    if (source == null || type !== 'object' && type !== 'function') { continue; }

    for (const key of Object.keys(Object(source))) {
      setProperty(target, key, (source as Record<string, unknown>)[key]);
    }
  }

  return target;
}
