import createKeyedSnapshotDataApi, { normalizeDisposer } from './data/keyed-snapshot.js';

const adapterName = 'XState';

function readSnapshot(actor) {
  const snapshot = actor?.getSnapshot?.();
  if (snapshot == null) {
    throw new TypeError(`${ adapterName } adapter actor returned a missing synchronous snapshot.`);
  }
  return snapshot;
}

function readContext(actor) {
  const context = readSnapshot(actor).context;
  if (!context || typeof context !== 'object') {
    throw new TypeError(`${ adapterName } adapter requires an object snapshot context.`);
  }
  return context;
}

function subscribeSnapshots(actor, notify) {
  return actor.subscribe(notify);
}

function key(actor) {
  return actor;
}

export default function createXStateActorApi({ select, snapshotEvent } = {}) {
  if (snapshotEvent != null && (typeof snapshotEvent !== 'string' || !snapshotEvent)) {
    throw new TypeError(`${ adapterName } adapter snapshotEvent must be a non-empty string.`);
  }

  const ActorApi = {
    key,

    get(actor, attribute) {
      const context = readContext(actor);
      return Object.hasOwn(context, attribute) ? context[attribute] : undefined;
    },

    has(actor, attribute) {
      return Object.hasOwn(readContext(actor), attribute);
    },

    serialize(actor) {
      return readContext(actor);
    },

    subscribe(actor, eventName, callback, context) {
      const disposer = snapshotEvent != null && eventName === snapshotEvent ?
        subscribeSnapshots(actor, snapshot => callback.call(context, snapshot)) :
        actor.on(eventName, event => callback.call(context, event));
      return normalizeDisposer(disposer, adapterName);
    },

    disposeOwned(actor) {
      actor.stop();
    }
  };

  if (select == null) { return ActorApi; }

  return Object.assign(createKeyedSnapshotDataApi({
    adapterName,
    key,
    readSnapshot,
    select,
    subscribe: subscribeSnapshots
  }), ActorApi);
}
