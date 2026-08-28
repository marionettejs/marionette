const assertInterop = require('./assert-interop.cjs');

const ShimmedBackbone = require('marionette/backbone');
const Backbone = require('backbone');
const Marionette = require('marionette');
const constructors = {
  Collection: Backbone.Collection,
  Model: Backbone.Model,
  Router: Backbone.Router,
  View: Backbone.View,
};

assertInterop({
  Backbone,
  Marionette,
  ShimmedBackbone,
  constructors,
});
