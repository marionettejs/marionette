import Backbone from 'backbone';
export { default } from 'backbone';
import { Events } from 'marionette';

Object.assign(Backbone.Model.prototype, Events);
Object.assign(Backbone.Collection.prototype, Events);
Object.assign(Backbone.View.prototype, Events);
Object.assign(Backbone.Router.prototype, Events);
