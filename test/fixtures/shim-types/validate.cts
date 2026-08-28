import Backbone = require('marionette/backbone');
import CanonicalBackbone = require('backbone');

const sameBackboneType: typeof CanonicalBackbone = Backbone;
const model = new sameBackboneType.Model({ id: 1, name: 'first' });
const collection = new sameBackboneType.Collection([model]);
const listener = new sameBackboneType.Model();

listener.listenTo(model, 'change:name', (changedModel, value) => {
  const typedModel: CanonicalBackbone.Model = changedModel;
  const typedValue: unknown = value;

  void typedModel;
  void typedValue;
});

collection.add({ id: 2, name: 'second' });
listener.stopListening(model);

const triggerResult: unknown = model.triggerMethod('fixture:event', 1);
collection.triggerMethod('fixture:event');
new sameBackboneType.View().triggerMethod('fixture:event');
new sameBackboneType.Router().triggerMethod('fixture:event');

// @ts-expect-error The shim does not patch the Backbone namespace.
sameBackboneType.triggerMethod('fixture:event');
// @ts-expect-error The shim does not patch Backbone.History.
new sameBackboneType.History().triggerMethod('fixture:event');

void triggerResult;
