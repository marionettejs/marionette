import { View, CollectionView, createMarionette, setDataApi, setStateApi } from 'marionette';
import { configureStore } from '@reduxjs/toolkit';
import { createStore as createXStateStore } from '@xstate/store';
import createReduxDataApi = require('@marionette/adapters/redux');
import createXStateStoreDataApi = require('@marionette/adapters/xstate-store');
import createZustandDataApi = require('@marionette/adapters/zustand');
import { createStore as createZustandStore } from 'zustand/vanilla';
import createXStateActorApi = require('@marionette/adapters/xstate');
import { createActor, createMachine } from 'xstate';

interface Model {
  id: number;
  label: string;
}

interface State {
  models: Model[];
}

const initialState: State = { models: [{ id: 1, label: 'one' }] };
const redux = configureStore({ reducer: (state = initialState) => state });
const zustand = createZustandStore<State>(() => initialState);
const xstate = createXStateStore({ context: initialState, on: {} });
const reduxApi = createReduxDataApi({
  key: (model: Model) => model.id,
  select: (state: State) => state.models
});
const zustandApi = createZustandDataApi({
  key: (model: Model) => model.id,
  select: (state: State) => state.models
});
const xstateApi = createXStateStoreDataApi({
  key: (model: Model) => model.id,
  select: (snapshot: ReturnType<typeof xstate.getSnapshot>) => snapshot.context.models
});

reduxApi.observeCollection(redux, () => {})();
zustandApi.observeCollection(zustand, () => {})();
xstateApi.observeCollection(xstate, () => {})();
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
// @ts-expect-error Redux sources require getState() and subscribe().
reduxApi.models({});
// @ts-expect-error Zustand sources require getState() and subscribe().
zustandApi.models({});
// @ts-expect-error XState Store sources require getSnapshot() and subscribe().
xstateApi.models({});
void actorLabel;
void actorContext;

// Each installed provider composes with the public root and isolated facade.
const runtime = createMarionette();
setDataApi(reduxApi);
runtime.setDataApi(reduxApi);
const reduxView = new View({ model: initialState.models[0], template: false });
const reduxLabel: string = reduxView.options.model.label;
const reduxList = new CollectionView({ collection: redux, childView: View });
const reduxSource: typeof redux = reduxList.collection;
new runtime.CollectionView({ collection: redux, childView: runtime.View });
setDataApi(zustandApi);
runtime.setDataApi(zustandApi);
const zustandList = new CollectionView({ collection: zustand, childView: View });
const zustandSource: typeof zustand = zustandList.collection;
new runtime.View({ model: initialState.models[0], template: false });
new runtime.CollectionView({ collection: zustand, childView: runtime.View });
setDataApi(xstateApi);
runtime.setDataApi(xstateApi);
const storeList = new CollectionView({ collection: xstate, childView: View });
const storeSource: typeof xstate = storeList.collection;
new runtime.CollectionView({ collection: xstate, childView: runtime.View });
setDataApi(actorApi);
setStateApi(actorApi);
runtime.setDataApi(actorApi);
runtime.setStateApi(actorApi);
const actorView = new View({ model: childActor, state: childActor, template: false });
const borrowedActor: typeof childActor = actorView.getState();
const actorList = new CollectionView({ collection: parentActor, childView: View });
const actorSource: typeof parentActor = actorList.collection;
new runtime.View({ model: childActor, state: childActor, template: false });
new runtime.CollectionView({ collection: parentActor, childView: runtime.View });
const subscriptionContext = { snapshots: 0 };
const unsubscribe: () => void = actorApi.subscribe(childActor, 'actor:snapshot',
  function(this: typeof subscriptionContext, snapshot: unknown) { this.snapshots++; }, subscriptionContext);
unsubscribe();
// @ts-expect-error A configured Redux selector must return an ordered model list.
setDataApi({ ...reduxApi, models() { return 1; } });
// @ts-expect-error A configured Zustand observer must return a cleanup function.
runtime.setDataApi({ ...zustandApi, observeCollection() { return false; } });
// @ts-expect-error A configured XState Store selector must return a model list.
setDataApi({ ...xstateApi, models() { return {}; } });
// @ts-expect-error Actor state subscriptions must return cleanup functions.
runtime.setStateApi({ ...actorApi, subscribe() { return 1; } });
