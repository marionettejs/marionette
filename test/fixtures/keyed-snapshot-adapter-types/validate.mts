import { configureStore } from '@reduxjs/toolkit';
import { createStore as createXStateStore } from '@xstate/store';
import createReduxDataApi from '@marionette/adapters/redux';
import createXStateStoreDataApi from '@marionette/adapters/xstate-store';
import createZustandDataApi from '@marionette/adapters/zustand';
import { createStore as createZustandStore } from 'zustand/vanilla';

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

const reduxModels: readonly Model[] = reduxApi.models(redux);
const zustandModels: readonly Model[] = zustandApi.models(zustand);
const xstateModels: readonly Model[] = xstateApi.models(xstate);
const cleanup = [
  reduxApi.observeCollection(redux, () => {}),
  zustandApi.observeCollection(zustand, () => {}),
  xstateApi.observeCollection(xstate, () => {})
];

cleanup.forEach(dispose => dispose());
// @ts-expect-error Redux sources require getState() and subscribe().
reduxApi.models({});
// @ts-expect-error Zustand sources require getState() and subscribe().
zustandApi.models({});
// @ts-expect-error XState Store sources require getSnapshot() and subscribe().
xstateApi.models({});
void reduxModels;
void zustandModels;
void xstateModels;
