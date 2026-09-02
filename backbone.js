import Backbone from 'backbone';
import { Events, setDataApi } from './index.js';
import BackboneDataApi from './runtime/backbone-data-api.js';

setDataApi(BackboneDataApi);

const prototypes = [
  Backbone.Model.prototype,
  Backbone.Collection.prototype,
  Backbone.View.prototype,
  Backbone.Router.prototype
];

for (const prototype of prototypes) {
  Object.assign(prototype, Events);
  delete prototype.bind;
  delete prototype.unbind;
}

export default Backbone;
