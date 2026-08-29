import assertInterop from './assert-interop.cjs';
import assert from 'node:assert/strict';

const { default: Backbone } = await import('backbone');
const constructors = {
  Collection: Backbone.Collection,
  Model: Backbone.Model,
  Router: Backbone.Router,
  View: Backbone.View,
};
assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const Marionette = await import('marionette');
for (const Constructor of Object.values(constructors)) {
  assert.strictEqual(Constructor.prototype.triggerMethod, undefined);
}
const { default: ShimmedBackbone } = await import('marionette/backbone');

assertInterop({
  Backbone,
  Marionette,
  ShimmedBackbone,
  constructors,
});
