import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('packed data models collections and state', async({ page, browserName }) => {
  const result = await page.evaluate(async function() {
    const { createMarionette } = await import('marionette');
    const { Collection, DataApi, Model, StateApi } = await import('@mnjs/data');
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    runtime.setStateApi(StateApi);
    const calls = { collection: 0, model: 0, state: 0 };
    const TestView = runtime.View.extend({
      collectionEvents: { update: 'onCollectionUpdate' },
      modelEvents: { 'change:label': 'onModelChange' },
      onCollectionUpdate() { calls.collection++; },
      onModelChange() { calls.model++; }
    });
    const StateOwner = runtime.MnObject.extend({
      stateEvents: { 'change:ready': 'onReady' },
      createState() { return new Model({ ready: false }); },
      onReady() { calls.state++; }
    });
    const model = new Model({ id: 1, label: 'one' });
    const collection = new Collection([model]);
    const view = new TestView({
      collection,
      el: document.createElement('section'),
      model
    });
    const owner = new StateOwner();
    const state = owner.getState();

    collection.add({ id: 2, label: 'two' });
    model.set('label', 'ONE');
    state.set('ready', true);
    const models = DataApi.models(collection).map(entry => entry.id);
    view.destroy();
    owner.destroy();
    collection.destroy();

    return { calls, models, stateDestroyed: state.isDestroyed() };
  });

  assert.deepEqual(result, {
    calls: { collection: 1, model: 1, state: 1 },
    models: [1, 2],
    stateDestroyed: true
  }, `${browserName}: packed @mnjs/data runtime behavior`);
});
