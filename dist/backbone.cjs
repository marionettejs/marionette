'use strict';

var Backbone = require('backbone');
var marionette = require('marionette');

const prototypes = [Backbone.Model.prototype, Backbone.Collection.prototype, Backbone.View.prototype, Backbone.Router.prototype];
for (const prototype of prototypes) {
  Object.assign(prototype, marionette.Events);
  delete prototype.bind;
  delete prototype.unbind;
}

module.exports = Backbone;
