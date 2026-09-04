function assertFunction(value, name, adapterName) {
  if (typeof value !== 'function') {
    throw new TypeError(`${adapterName} adapter requires a ${name} function.`);
  }
}
function readModels(source, readSnapshot, select, adapterName) {
  const snapshot = readSnapshot(source);
  if (snapshot == null) {
    throw new TypeError(`${adapterName} adapter source returned a missing synchronous snapshot.`);
  }
  const models = select(snapshot);
  if (!Array.isArray(models)) {
    throw new TypeError(`${adapterName} adapter selector must return an ordered array.`);
  }
  return models;
}
function buildSnapshot(models, key, adapterName) {
  const entries = Array(models.length);
  const byKey = new Map();
  for (let index = 0; index < models.length; index++) {
    const model = models[index];
    const modelKey = key(model);
    if (modelKey == null) {
      throw new TypeError(`${adapterName} adapter key returned a missing value at index ${index}.`);
    }
    if (byKey.has(modelKey)) {
      throw new TypeError(`${adapterName} adapter key returned duplicate value "${String(modelKey)}".`);
    }
    const entry = {
      index,
      key: modelKey,
      model
    };
    entries[index] = entry;
    byKey.set(modelKey, entry);
  }
  return {
    entries,
    byKey
  };
}
function compareSnapshots(previous, current) {
  const added = [];
  const removed = [];
  const updated = [];
  let reordered = false;
  for (let index = 0; index < current.entries.length; index++) {
    const currentEntry = current.entries[index];
    const previousEntry = previous.byKey.get(currentEntry.key);
    if (!previousEntry) {
      added.push(currentEntry.model);
    } else {
      if (previousEntry.model !== currentEntry.model) {
        updated.push({
          previous: previousEntry.model,
          current: currentEntry.model
        });
      }
      if (previousEntry.index !== index) {
        reordered = true;
      }
    }
  }
  for (const previousEntry of previous.entries) {
    if (!current.byKey.has(previousEntry.key)) {
      removed.push(previousEntry.model);
    }
  }
  if (added.length || removed.length || updated.length) {
    return {
      kind: 'update',
      added,
      removed,
      updated
    };
  }
  return reordered ? {
    kind: 'reorder'
  } : undefined;
}
function normalizeDisposer(disposer, adapterName) {
  let dispose;
  if (typeof disposer === 'function') {
    dispose = disposer;
  } else if (typeof disposer?.unsubscribe === 'function') {
    dispose = () => disposer.unsubscribe();
  } else {
    throw new TypeError(`${adapterName} adapter subscribe must return a disposer.`);
  }
  let isDisposed = false;
  return function () {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    dispose();
  };
}
function createKeyedSnapshotDataApi({
  adapterName,
  key,
  readSnapshot,
  select,
  subscribe
}) {
  assertFunction(key, 'key', adapterName);
  assertFunction(select, 'selector', adapterName);
  const getModels = source => readModels(source, readSnapshot, select, adapterName);
  return {
    key,
    models(source) {
      return getModels(source);
    },
    observeCollection(source, notify, context) {
      let selected = getModels(source);
      let observed = buildSnapshot(selected, key, adapterName);
      let needsReset = false;
      const onChange = function () {
        const currentModels = getModels(source);
        if (currentModels === selected && !needsReset) {
          return;
        }
        const current = buildSnapshot(currentModels, key, adapterName);
        const change = needsReset ? {
          kind: 'reset'
        } : compareSnapshots(observed, current);
        selected = currentModels;
        observed = current;
        if (!change) {
          return;
        }
        needsReset = false;
        try {
          notify.call(context, change);
        } catch (error) {
          needsReset = true;
          throw error;
        }
      };
      return normalizeDisposer(subscribe(source, onChange), adapterName);
    }
  };
}

function readSnapshot(store) {
  if (typeof store?.getState !== 'function') {
    throw new TypeError('Redux adapter requires a store with getState().');
  }
  return store.getState();
}
function subscribe(store, notify) {
  if (typeof store?.subscribe !== 'function') {
    throw new TypeError('Redux adapter requires a store with subscribe().');
  }
  return store.subscribe(notify);
}
function createReduxDataApi({
  key,
  select
} = {}) {
  return createKeyedSnapshotDataApi({
    adapterName: 'Redux',
    key,
    readSnapshot,
    select,
    subscribe
  });
}

export { createReduxDataApi as default };
