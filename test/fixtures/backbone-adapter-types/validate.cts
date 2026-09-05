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

const typedHandler = (changed: Backbone.Model, value: string) => value.toUpperCase();
const eventMap = { 'change:name': typedHandler };
const mapContext = { source: 'fixture' };
const stopMap: () => void = BackboneApi.subscribe(model, eventMap, mapContext);
const stopExplicitMap: () => void = BackboneApi.subscribe(model, eventMap, mapContext, mapContext);
const eventNames: string | Backbone.EventMap = Math.random() ? 'change:name' : eventMap;
BackboneApi.subscribe(model, eventNames, typedHandler);
// @ts-expect-error String event registration still requires a callable handler.
BackboneApi.subscribe(model, 'change:name', 123);
// @ts-expect-error The adapter requires an Events source.
BackboneApi.subscribe({}, eventMap, mapContext);
stopMap();
stopExplicitMap();
