import { View, CollectionView, createMarionette, setDataApi, setStateApi } from 'marionette';
import createXStateActorApi = require('@marionette/adapters/xstate');
import { createActor, createMachine } from 'xstate';

const childActor = createActor(createMachine({ context: { id: 1, label: 'child' } })).start();
const parentActor = createActor(createMachine({ context: { children: [childActor] } })).start();
const actorApi = createXStateActorApi({
  select: (snapshot: ReturnType<typeof parentActor.getSnapshot>) => snapshot.context.children,
  snapshotEvent: 'actor:snapshot'
});
const actorLabel: string | undefined = actorApi.get(childActor, 'label');
const actorContext = actorApi.serialize(childActor);
actorApi.observeCollection(parentActor, () => {})();
// @ts-expect-error Parent actor sources require getSnapshot() and subscribe().
actorApi.models({});
void actorLabel;
void actorContext;

// The actor adapter composes with the public root and isolated facade.
const runtime = createMarionette();
setDataApi(actorApi);
setStateApi(actorApi);
runtime.setDataApi(actorApi);
runtime.setStateApi(actorApi);
const actorView = new View({ model: childActor, state: childActor, template: false });
const borrowedActor: typeof childActor = actorView.getState();
const actorList = new CollectionView({ collection: parentActor, childView: View });
const actorSource: typeof parentActor = actorList.collection;
void borrowedActor;
void actorSource;
new runtime.View({ model: childActor, state: childActor, template: false });
new runtime.CollectionView({ collection: parentActor, childView: runtime.View });
const subscriptionContext = { snapshots: 0 };
const unsubscribe: () => void = actorApi.subscribe(childActor, 'actor:snapshot',
  function(this: typeof subscriptionContext, snapshot: unknown) { this.snapshots++; }, subscriptionContext);
unsubscribe();
// @ts-expect-error Actor selectors must return an ordered model list.
setDataApi({ ...actorApi, models() { return 1; } });
// @ts-expect-error Actor collection observers must return cleanup functions.
runtime.setDataApi({ ...actorApi, observeCollection() { return false; } });
// @ts-expect-error Actor state subscriptions must return cleanup functions.
runtime.setStateApi({ ...actorApi, subscribe() { return 1; } });

parentActor.stop();
childActor.stop();
