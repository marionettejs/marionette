'use strict';

var underscore = require('underscore');
var Backbone = require('backbone');
var marionette = require('marionette');

underscore.extend(Backbone.Model.prototype, marionette.Events);
underscore.extend(Backbone.Collection.prototype, marionette.Events);
underscore.extend(Backbone.View.prototype, marionette.Events);
underscore.extend(Backbone.Router.prototype, marionette.Events);

module.exports = Backbone;
