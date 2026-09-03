import BackboneApi = require('@marionette/adapters/backbone');
import Backbone = require('backbone');

const model = new Backbone.Model({ id: 1, name: 'first' });
const collection = new Backbone.Collection([model]);
const listener = new Backbone.Model();

listener.listenTo(model, 'change:name', (changedModel, value) => {
  const typedModel: Backbone.Model = changedModel;
  const typedValue: unknown = value;

  void typedModel;
  void typedValue;
});

const modelKey: string = BackboneApi.key(model);
const models: Backbone.Model[] = BackboneApi.models(collection);
const cleanup: () => void = BackboneApi.subscribe(model, 'change:name', () => {});
const stopObserving: () => void = BackboneApi.observeCollection(collection, () => {});
BackboneApi.disposeOwned(model);
collection.add({ id: 2, name: 'second' });
listener.stopListening(model);
cleanup();
stopObserving();

// @ts-expect-error The adapter does not add triggerMethod to Backbone models.
model.triggerMethod('fixture:event');

void modelKey;
void models;
