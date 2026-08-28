import assertInterop from './assert-interop.cjs';

const { default: ShimmedBackbone } = await import('marionette/backbone');
const { default: Backbone } = await import('backbone');
const Marionette = await import('marionette');
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
