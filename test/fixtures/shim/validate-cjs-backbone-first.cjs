const assertInterop = require('./assert-interop.cjs');
const assert = require('node:assert/strict');

const Backbone = require('backbone');
const constructors = {
  Collection: Backbone.Collection,
  Model: Backbone.Model,
  Router: Backbone.Router,
  View: Backbone.View,
};
assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const Marionette = require('marionette');
for (const Constructor of Object.values(constructors)) {
  assert.strictEqual(Constructor.prototype.triggerMethod, undefined);
}
const ShimmedBackbone = require('marionette/backbone');

assertInterop({
  Backbone,
  Marionette,
  ShimmedBackbone,
  constructors,
});
