import createKeyedSnapshotDataApi from './data/keyed-snapshot.js';

function readSnapshot(store) {
  if (typeof store?.getSnapshot !== 'function') {
    throw new TypeError('XState Store adapter requires a store with getSnapshot().');
  }
  return store.getSnapshot();
}

function subscribe(store, notify) {
  if (typeof store?.subscribe !== 'function') {
    throw new TypeError('XState Store adapter requires a store with subscribe().');
  }
  return store.subscribe(notify);
}

export default function createXStateStoreDataApi({ key, select } = {}) {
  return createKeyedSnapshotDataApi({
    adapterName: 'XState Store',
    key,
    readSnapshot,
    select,
    subscribe
  });
}
