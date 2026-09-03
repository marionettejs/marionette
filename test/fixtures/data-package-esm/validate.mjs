import assert from 'node:assert/strict';
import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi, triggerMethod } from '@marionette/data';

const runtime = createMarionette();
runtime.setDataApi(DataApi);
runtime.setStateApi(StateApi);
const model = new Model({ id: 1, label: 'one' });
const collection = new Collection([model]);

assert.deepEqual(DataApi.items(collection), [model]);
assert.deepEqual(DataApi.serialize(model), { id: 1, label: 'one' });
assert.equal(typeof triggerMethod, 'function');
const events = { collection: 0, model: 0, state: 0 };
const TestView = runtime.View.extend({
  collectionEvents: { update: 'onCollectionUpdate' },
  modelEvents: { 'change:label': 'onModelChange' },
  onCollectionUpdate() { events.collection++; },
  onModelChange() { events.model++; }
});
const StateOwner = runtime.MnObject.extend({
  stateEvents: { 'change:ready': 'onReady' },
  createState() { return new Model({ ready: false }); },
  onReady() { events.state++; }
});
const documentElement = { contains() { return false; } };
const el = { hasChildNodes() { return false; }, ownerDocument: { documentElement } };
const view = new TestView({ collection, el, model });
const owner = new StateOwner();
const state = owner.getState();
collection.add({ id: 2 });
model.set('label', 'ONE');
state.set('ready', true);
assert.deepEqual(events, { collection: 1, model: 1, state: 1 });
view.destroy();
owner.destroy();
assert.equal(state.isDestroyed(), true);

collection.destroy();
