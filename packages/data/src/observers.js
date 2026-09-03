const collectionObservers = new WeakMap();

export function observeCollection(collection, callback, context) {
  const type = typeof collection;
  const isObject = collection != null && (type === 'object' || type === 'function');
  if (!isObject || typeof callback !== 'function' || !collectionObservers.has(collection)) {
    throw new TypeError('@marionette/data can observe only its own Collection instances with a callback.');
  }

  const observers = collectionObservers.get(collection);
  const observer = { callback, context };
  let subscribed = true;
  observers.add(observer);

  return function() {
    if (!subscribed) { return; }
    subscribed = false;
    observers.delete(observer);
  };
}

export function initializeObservers(collection) {
  collectionObservers.set(collection, new Set());
}

export function notifyCollection(collection, change) {
  for (const { callback, context } of [...collectionObservers.get(collection)]) {
    callback.call(context, change);
  }
}

export function releaseObservers(collection) {
  collectionObservers.delete(collection);
}
