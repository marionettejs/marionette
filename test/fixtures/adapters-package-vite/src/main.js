import Backbone from 'backbone';
import { configureStore } from '@reduxjs/toolkit';
import { createStore as createXStateStore } from '@xstate/store';
import $ from 'jquery';
import { createMarionette } from 'marionette';
import BackboneApi from '@marionette/adapters/backbone';
import JQueryDomApi from '@marionette/adapters/dom/jquery';
import createReduxDataApi from '@marionette/adapters/redux';
import createXStateStoreDataApi from '@marionette/adapters/xstate-store';
import createZustandDataApi from '@marionette/adapters/zustand';
import { createStore as createZustandStore } from 'zustand/vanilla';
import createXStateActorApi from '@marionette/adapters/xstate';
import { createActor, createMachine } from 'xstate';

const runtime = createMarionette();
runtime.setDataApi(BackboneApi);
runtime.setStateApi(BackboneApi);
const AdapterView = runtime.View.extend();
AdapterView.setDomApi(JQueryDomApi);

const view = new AdapterView({
  el: document.getElementById('app'),
  model: new Backbone.Model({ label: 'adapter' }),
  template: data => `<span>${data.label}</span>`,
}).render();

if (!(view.$('span') instanceof $)) {
  throw new Error('jQuery adapter did not produce a jQuery collection');
}

const initialState = { models: [{ id: 1 }] };
const sources = [
  [createReduxDataApi, configureStore({ reducer: (state = initialState) => state })],
  [createXStateStoreDataApi, createXStateStore({ context: initialState, on: {} })],
  [createZustandDataApi, createZustandStore(() => initialState)]
];

for (const [createDataApi, source] of sources) {
  const DataApi = createDataApi({
    key: model => model.id,
    select: snapshot => snapshot.context?.models || snapshot.models
  });
  if (DataApi.models(source).length !== 1) {
    throw new Error('Keyed snapshot adapter did not read the provider store.');
  }
  DataApi.observeCollection(source, () => {})();
}

const childActor = createActor(createMachine({ context: { label: 'child' } })).start();
const parentActor = createActor(createMachine({ context: { children: [childActor] } })).start();
const XStateActorApi = createXStateActorApi({
  select: snapshot => snapshot.context.children,
  snapshotEvent: 'actor:snapshot'
});
if (XStateActorApi.models(parentActor)[0] !== childActor ||
    XStateActorApi.serialize(childActor).label !== 'child') {
  throw new Error('XState actor adapter did not preserve actor identity and context.');
}
XStateActorApi.observeCollection(parentActor, () => {})();
childActor.stop();
parentActor.stop();
