const assertInterop = require('./assert-adapter.cjs');
const assert = require('node:assert/strict');

const Backbone = require('backbone');
const constructors = {
  Collection: Backbone.Collection,
  Model: Backbone.Model,
  Router: Backbone.Router,
  View: Backbone.View,
};
const prototypeDescriptors = Object.fromEntries(Object.entries(constructors)
  .map(([name, Constructor]) => [name, Object.getOwnPropertyDescriptors(Constructor.prototype)]));
assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const Marionette = require('marionette');
for (const Constructor of Object.values(constructors)) {
  assert.strictEqual(Constructor.prototype.triggerMethod, undefined);
}
const BackboneApi = require('@marionette/adapters/backbone');

assertInterop({
  BackboneApi,
  Backbone,
  Marionette,
  constructors,
  prototypeDescriptors,
});
