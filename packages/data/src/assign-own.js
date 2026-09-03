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

export default function assignOwn(target, ...sources) {
  for (const source of sources) {
    const type = typeof source;
    if (source == null || type !== 'object' && type !== 'function') { continue; }

    for (const key of Object.keys(Object(source))) {
      setProperty(target, key, source[key]);
    }
  }

  return target;
}
