export function setProperty(target, key, value) {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    target[key] = value;
  }
}

function assign(target, sources, ownOnly) {
  for (const source of sources) {
    const type = typeof source;
    if (source == null || type !== 'object' && type !== 'function') { continue; }

    for (const key in source) {
      if (ownOnly && !Object.hasOwn(source, key)) { continue; }
      setProperty(target, key, source[key]);
    }
  }

  return target;
}

export function assignOwn(target, ...sources) {
  return assign(target, sources, true);
}

export default function assignIn(target, ...sources) {
  return assign(target, sources, false);
}
