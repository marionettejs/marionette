import assertInterop from './assert-adapter.cjs';

const { default: BackboneApi } = await import('@marionette/adapters/backbone');
const { default: Backbone } = await import('backbone');
const Marionette = await import('marionette');
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
