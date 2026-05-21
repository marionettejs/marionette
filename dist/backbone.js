import { extend } from 'underscore';
import Backbone from 'backbone';
export { default } from 'backbone';
import { Events } from 'marionette';

extend(Backbone, Events);
extend(Backbone.Model.prototype, Events);
extend(Backbone.Collection.prototype, Events);
extend(Backbone.View.prototype, Events);
extend(Backbone.Router.prototype, Events);
extend(Backbone.History.prototype, Events);
