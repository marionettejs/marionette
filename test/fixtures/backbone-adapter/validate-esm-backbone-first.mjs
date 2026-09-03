import assertInterop from './assert-adapter.cjs';
import assert from 'node:assert/strict';

const { default: Backbone } = await import('backbone');
const constructors = {
  Collection: Backbone.Collection,
  Model: Backbone.Model,
  Router: Backbone.Router,
  View: Backbone.View,
};
const prototypeDescriptors = Object.fromEntries(Object.entries(constructors)
  .map(([name, Constructor]) => [name, Object.getOwnPropertyDescriptors(Constructor.prototype)]));
assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const Marionette = await import('marionette');
for (const Constructor of Object.values(constructors)) {
  assert.strictEqual(Constructor.prototype.triggerMethod, undefined);
}
const { default: BackboneApi } = await import('@marionette/adapters/backbone');

assertInterop({
  BackboneApi,
  Backbone,
  Marionette,
  constructors,
  prototypeDescriptors,
});
