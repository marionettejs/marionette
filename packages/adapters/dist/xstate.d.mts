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

declare function createXStateActorApi<
  TParentSnapshot,
  TActor extends XStateActor<{ context: object }>,
>(options: XStateActorApiOptions<TParentSnapshot, TActor>): XStateActorApi & {
  models(parent: XStateSnapshotSource<TParentSnapshot>): readonly TActor[];
  observeCollection(
    parent: XStateSnapshotSource<TParentSnapshot>,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};
declare function createXStateActorApi(options?: XStateActorEventOptions): XStateActorApi;

export default createXStateActorApi;
