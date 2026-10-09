import Backbone from 'backbone';
import $ from 'jquery';
import { createMarionette } from 'marionette';
import BackboneApi from '@mnjs/adapters/backbone';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';
import createXStateActorApi from '@mnjs/adapters/xstate';
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
