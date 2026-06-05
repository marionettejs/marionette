import assert from 'assert';
import Backbone from 'backbone';

assert.strictEqual(Backbone.Model.prototype.triggerMethod, undefined);

const ShimmedBackbone = (await import('marionette/backbone')).default;

assert.strictEqual(ShimmedBackbone, Backbone);
assert.strictEqual(typeof Backbone.Model.prototype.triggerMethod, 'function');

let called = false;
const model = new Backbone.Model();
model.on('fixture:event', () => {
  called = true;
});
model.triggerMethod('fixture:event');

assert.strictEqual(called, true);
