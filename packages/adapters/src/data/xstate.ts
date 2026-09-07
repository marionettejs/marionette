import createKeyedSnapshotDataApi, { normalizeDisposer } from './internal/keyed-snapshot.ts';
import type { KeyedSnapshotDataApi } from './internal/keyed-snapshot.ts';

interface XStateSubscription {
  unsubscribe(): void;
}

interface XStateSnapshotSource<TSnapshot> {
  getSnapshot(): TSnapshot;
  subscribe(observer: (snapshot: TSnapshot) => void): XStateSubscription;
}

interface XStateActor<TSnapshot extends { context: object }, TEvent = unknown>
  extends XStateSnapshotSource<TSnapshot> {
  on(eventType: string, handler: (event: TEvent) => void): XStateSubscription;
  stop(): void;
}

type ActorSnapshot<TActor> = TActor extends XStateSnapshotSource<infer TSnapshot>
  ? TSnapshot
  : never;

type ActorContext<TActor> = ActorSnapshot<TActor> extends { context: infer TContext }
  ? TContext
  : never;

export interface XStateActorEventOptions {
  snapshotEvent?: string;
}

export interface XStateActorApiOptions<TParentSnapshot, TActor>
  extends XStateActorEventOptions {
  select(snapshot: TParentSnapshot): readonly TActor[];
}

interface XStateActorApi {
  key<TActor>(actor: TActor): TActor;
  get<TActor extends XStateActor<{ context: object }>, TAttribute extends keyof ActorContext<TActor>>(
    actor: TActor,
    attribute: TAttribute,
  ): ActorContext<TActor>[TAttribute] | undefined;
  has<TActor extends XStateActor<{ context: object }>>(
    actor: TActor,
    attribute: PropertyKey,
  ): boolean;
  serialize<TActor extends XStateActor<{ context: object }>>(
    actor: TActor,
  ): ActorContext<TActor>;
  subscribe<TActor extends XStateActor<{ context: object }>>(
    actor: TActor,
    eventName: string,
    callback: (payload: ActorSnapshot<TActor> | unknown) => void,
    context?: unknown,
  ): () => void;
  disposeOwned<TActor extends XStateActor<{ context: object }>>(actor: TActor): void;
}

const adapterName = 'XState';

function readSnapshot<TSnapshot>(actor: XStateSnapshotSource<TSnapshot>): TSnapshot {
  const snapshot = actor?.getSnapshot?.();
  if (snapshot == null) {
    throw new TypeError(`${ adapterName } adapter actor returned a missing synchronous snapshot.`);
  }
  return snapshot;
}

function readContext<TActor extends XStateActor<{ context: object }>>(
  actor: TActor
): ActorContext<TActor> {
  const context = readSnapshot(actor).context;
  if (!context || typeof context !== 'object') {
    throw new TypeError(`${ adapterName } adapter requires an object snapshot context.`);
  }
  return context as ActorContext<TActor>;
}

function subscribeSnapshots<TSnapshot>(
  actor: XStateSnapshotSource<TSnapshot>, notify: (snapshot: TSnapshot) => void
) {
  return actor.subscribe(notify);
}

function key<TActor>(actor: TActor): TActor {
  return actor;
}

export default function createXStateActorApi<
  TParentSnapshot, TActor extends XStateActor<{ context: object }>
>(options: XStateActorApiOptions<TParentSnapshot, TActor>): XStateActorApi &
  KeyedSnapshotDataApi<XStateSnapshotSource<TParentSnapshot>, TActor>;
export default function createXStateActorApi(options?: XStateActorEventOptions): XStateActorApi;
export default function createXStateActorApi<
  TParentSnapshot, TActor extends XStateActor<{ context: object }>
>({ select, snapshotEvent }: Partial<XStateActorApiOptions<TParentSnapshot, TActor>> = {}): XStateActorApi {
  if (snapshotEvent === '') {
    throw new TypeError(`${ adapterName } adapter snapshotEvent must be a non-empty string.`);
  }

  const ActorApi: XStateActorApi = {
    key,

    get(actor, attribute) {
      const context = readContext(actor);
      return Object.hasOwn(context as object, attribute) ? context[attribute] : undefined;
    },

    has(actor, attribute) {
      return Object.hasOwn(readContext(actor) as object, attribute);
    },

    serialize(actor) {
      return readContext(actor);
    },

    subscribe(actor, eventName, callback, context) {
      const disposer = snapshotEvent != null && eventName === snapshotEvent ?
        subscribeSnapshots(actor, snapshot => callback.call(context, snapshot)) :
        actor.on(eventName, event => callback.call(context, event));
      return normalizeDisposer(disposer);
    },

    disposeOwned(actor) {
      actor.stop();
    }
  };

  if (select == null) { return ActorApi; }

  return Object.assign(createKeyedSnapshotDataApi({
    adapterName,
    readSnapshot,
    select,
    subscribe: subscribeSnapshots
  }), ActorApi);
}
