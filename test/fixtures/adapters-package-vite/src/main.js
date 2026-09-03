import Backbone from 'backbone';
import $ from 'jquery';
import { createMarionette } from 'marionette';
import BackboneApi from '@marionette/adapters/backbone';
import JQueryDomApi from '@marionette/adapters/dom/jquery';

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
