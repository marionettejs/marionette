// Shared value grammar for field projection, layout preflight and DOM bindings.
export { isPojo as isSchemaPojo } from '@formkit/utils';
export function schemaValueKey(source, deep = false) {
  let key = source;
  if (key.startsWith('__deep__')) {key = key.slice(8);deep = true;}
  const raw = key.startsWith('__raw__');
  return {source,key: raw ? key.slice(7) : key,raw,deep};
}
export function schemaValueKeys(bag, deep = false, enumerable = false) {
  const keys = new Map();
  for (const source of enumerable ? Object.keys(bag) : Object.getOwnPropertyNames(bag)) {
    if (source === 'length' && Array.isArray(bag)) {continue;}
    const entry = schemaValueKey(source,deep);
    // Last explicit spelling wins even when a shadowed expression changes.
    keys.set(entry.key,entry);
  }
  return keys.values();
}
export function isClassReset(value, key) {
  return typeof value === 'string' && value.startsWith('$reset') && /(?:class|Class)$/.test(key);
}
