const assertInterop = require('./assert-adapter.cjs');

const BackboneApi = require('@marionette/adapters/backbone');
const Backbone = require('backbone');
const Marionette = require('marionette');
const constructors = {
  Collection: Backbone.Collection,
  Model: Backbone.Model,
  Router: Backbone.Router,
  View: Backbone.View,
};
const prototypeDescriptors = Object.fromEntries(Object.entries(constructors)
  .map(([name, Constructor]) => [name, Object.getOwnPropertyDescriptors(Constructor.prototype)]));

assertInterop({
  BackboneApi,
  Backbone,
  Marionette,
  constructors,
  prototypeDescriptors,
});
