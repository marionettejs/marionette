import createKeyedSnapshotDataApi from './data/keyed-snapshot.js';

function readSnapshot(store) {
  if (typeof store?.getState !== 'function') {
    throw new TypeError('Zustand adapter requires a store with getState().');
  }
  return store.getState();
}

function subscribe(store, notify) {
  if (typeof store?.subscribe !== 'function') {
    throw new TypeError('Zustand adapter requires a store with subscribe().');
  }
  return store.subscribe(notify);
}

export default function createZustandDataApi({ key, select } = {}) {
  return createKeyedSnapshotDataApi({
    adapterName: 'Zustand',
    key,
    readSnapshot,
    select,
    subscribe
  });
}
