import Backbone from 'backbone';
import { Events } from './index.js';

Object.assign(Backbone.Model.prototype, Events);
Object.assign(Backbone.Collection.prototype, Events);
Object.assign(Backbone.View.prototype, Events);
Object.assign(Backbone.Router.prototype, Events);

export default Backbone;
