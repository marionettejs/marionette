import Backbone from 'backbone';
export { default } from 'backbone';
import { Events } from 'marionette';

const prototypes = [Backbone.Model.prototype, Backbone.Collection.prototype, Backbone.View.prototype, Backbone.Router.prototype];
for (const prototype of prototypes) {
  Object.assign(prototype, Events);
  delete prototype.bind;
  delete prototype.unbind;
}
