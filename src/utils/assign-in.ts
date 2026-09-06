export function setProperty(target: unknown, key: unknown, value: unknown) {
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

function assign<Target extends object>(target: Target, sources: readonly unknown[], ownOnly: boolean): Target {
  for (const source of sources) {
    const type = typeof source;
    if (source == null || type !== 'object' && type !== 'function') { continue; }

    for (const key in source) {
      if (ownOnly && !Object.hasOwn(source, key)) { continue; }
      setProperty(target, key, (source as Record<string, unknown>)[key]);
    }
  }

  return target;
}

export function assignOwn<Target extends object>(target: Target, ...sources: unknown[]): Target {
  return assign(target, sources, true);
}

export default function assignIn<Target extends object>(target: Target, ...sources: unknown[]): Target {
  return assign(target, sources, false);
}
