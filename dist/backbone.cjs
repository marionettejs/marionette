'use strict';

var underscore = require('underscore');
var Backbone = require('backbone');
var marionette = require('marionette');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Backbone__default = /*#__PURE__*/_interopDefaultLegacy(Backbone);

underscore.extend(Backbone__default['default'], marionette.Events);
underscore.extend(Backbone__default['default'].Model.prototype, marionette.Events);
underscore.extend(Backbone__default['default'].Collection.prototype, marionette.Events);
underscore.extend(Backbone__default['default'].View.prototype, marionette.Events);
underscore.extend(Backbone__default['default'].Router.prototype, marionette.Events);
underscore.extend(Backbone__default['default'].History.prototype, marionette.Events);

module.exports = Backbone__default['default'];
