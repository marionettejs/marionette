import { configureStore } from '@reduxjs/toolkit';
import { createStore as createXStateStore } from '@xstate/store';
import createReduxDataApi = require('@marionette/adapters/redux');
import createXStateStoreDataApi = require('@marionette/adapters/xstate-store');
import createZustandDataApi = require('@marionette/adapters/zustand');
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

reduxApi.observeCollection(redux, () => {})();
zustandApi.observeCollection(zustand, () => {})();
xstateApi.observeCollection(xstate, () => {})();
// @ts-expect-error Redux sources require getState() and subscribe().
reduxApi.models({});
// @ts-expect-error Zustand sources require getState() and subscribe().
zustandApi.models({});
// @ts-expect-error XState Store sources require getSnapshot() and subscribe().
xstateApi.models({});
