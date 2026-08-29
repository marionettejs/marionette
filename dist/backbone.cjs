'use strict';

var Backbone = require('backbone');
var marionette = require('marionette');

Object.assign(Backbone.Model.prototype, marionette.Events);
Object.assign(Backbone.Collection.prototype, marionette.Events);
Object.assign(Backbone.View.prototype, marionette.Events);
Object.assign(Backbone.Router.prototype, marionette.Events);

module.exports = Backbone;
