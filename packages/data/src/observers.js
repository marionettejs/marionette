const collectionObservers = new WeakMap();

function modelKey(model) {
  return model.id == null ? model.cid : model.id;
}

function captureChange(change) {
  if (change.kind !== 'update') { return; }
  const entries = [];
  for (const model of change.removed) {
    entries.push({ key: modelKey(model), previous: model, current: undefined });
  }
  for (const { previous, current } of change.updated) {
    entries.push({ key: modelKey(previous), previous, current });
  }
  for (const model of change.added) {
    entries.push({ key: modelKey(model), previous: undefined, current: model });
  }
  return entries;
}

function combineChanges(observer, current, currentEntries) {
  const previous = observer.pending;
  if (previous.kind === 'reset' || current.kind === 'reorder') { return; }
  if (current.kind === 'reset' || previous.kind === 'reorder') {
    observer.pending = current;
    observer.pendingEntries = currentEntries;
    return;
  }

  const changes = new Map(observer.pendingEntries.map(entry => [entry.key, entry]));
  for (const entry of currentEntries) {
    const previousEntry = changes.get(entry.key);
    changes.set(entry.key, previousEntry ? {
      key: entry.key, previous: previousEntry.previous, current: entry.current
    } : entry);
  }

  const combined = { kind: 'update', added: [], removed: [], updated: [] };
  for (const { previous: before, current: after } of changes.values()) {
    if (!before) {
      if (after) { combined.added.push(after); }
    } else if (!after) {
      combined.removed.push(before);
    } else {
      combined.updated.push({ previous: before, current: after });
    }
  }
  observer.pending = combined;
  observer.pendingEntries = [...changes.values()];
}

export function observeCollection(collection, callback, context) {
  const type = typeof collection;
  const isObject = collection != null && (type === 'object' || type === 'function');
  if (!isObject || typeof callback !== 'function' || !collectionObservers.has(collection)) {
    throw new TypeError('@marionette/data can observe only its own Collection instances with a callback.');
  }

  const observers = collectionObservers.get(collection);
  const observer = { callback, context, pending: undefined, pendingEntries: undefined };
  let subscribed = true;
  observers.add(observer);

  return function() {
    if (!subscribed) { return; }
    subscribed = false;
    observer.pending = undefined;
    observer.pendingEntries = undefined;
    observers.delete(observer);
  };
}

export function initializeObservers(collection) {
  collectionObservers.set(collection, new Set());
}

export function notifyCollection(collection, change) {
  const observers = collectionObservers.get(collection);
  if (!observers.size) { return; }
  const currentObservers = [...observers];
  if (currentObservers.length === 1 && !currentObservers[0].pending) {
    const observer = currentObservers[0];
    observer.callback.call(observer.context, change);
    return;
  }

  // Capture keys while removed models still have their observed identities.
  const entries = captureChange(change);

  // Record the change for every observer before user code can mutate the source.
  // A nested notification combines changes an observer has not received yet.
  for (const observer of currentObservers) {
    if (observer.pending) {
      combineChanges(observer, change, entries);
    } else {
      observer.pending = change;
      observer.pendingEntries = entries;
    }
  }
  for (const observer of currentObservers) {
    if (!observers.has(observer) || !observer.pending) { continue; }
    const pending = observer.pending;
    observer.pending = undefined;
    observer.pendingEntries = undefined;
    observer.callback.call(observer.context, pending);
  }
}

export function releaseObservers(collection) {
  const observers = collectionObservers.get(collection);
  for (const observer of observers) {
    observer.pending = undefined;
    observer.pendingEntries = undefined;
  }
  observers.clear();
  collectionObservers.delete(collection);
}
