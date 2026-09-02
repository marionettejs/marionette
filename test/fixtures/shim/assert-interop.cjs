const assert = require('node:assert/strict');

module.exports = function assertInterop({
  Backbone,
  Marionette,
  ShimmedBackbone,
  constructors,
}) {
  assert.strictEqual(ShimmedBackbone, Backbone);
  assert.strictEqual(Backbone.Model, constructors.Model);
  assert.strictEqual(Backbone.Collection, constructors.Collection);
  assert.strictEqual(Backbone.View, constructors.View);
  assert.strictEqual(Backbone.Router, constructors.Router);

  for (const Constructor of Object.values(constructors)) {
    assert.strictEqual(
      Constructor.prototype.triggerMethod,
      Marionette.Events.triggerMethod,
    );
  }

  const model = new Backbone.Model({ id: 1, name: 'before' });
  const collection = new Backbone.Collection([model]);
  const listener = new Backbone.Model();
  const calls = [];

  assert.ok(model instanceof constructors.Model);
  assert.strictEqual(collection.get(model.id), model);
  assert.strictEqual(Marionette.View.prototype.Data.key(model), model.cid);
  assert.strictEqual(Marionette.View.prototype.Data.serialize(model), model.attributes);
  assert.strictEqual(Marionette.CollectionView.prototype.Data.items(collection), collection.models);

  const structuralChanges = [];
  const stopObserving = Marionette.CollectionView.prototype.Data.observeCollection(
    collection,
    change => structuralChanges.push(change),
  );

  listener.listenTo(model, 'change:name', (changedModel, value) => {
    calls.push(['change', changedModel, value]);
  });
  listener.listenTo(collection, 'add', (addedModel, changedCollection) => {
    calls.push(['add', addedModel, changedCollection]);
  });

  model.set('name', 'after');
  const addedModel = collection.add({ id: 2, name: 'second' });

  assert.deepStrictEqual(structuralChanges, [{
    kind: 'update',
    added: [addedModel],
    removed: [],
    updated: [],
  }]);
  stopObserving();

  assert.deepStrictEqual(calls, [
    ['change', model, 'after'],
    ['add', addedModel, collection],
  ]);

  listener.stopListening();
  model.set('name', 'ignored');
  collection.add({ id: 3 });

  assert.strictEqual(calls.length, 2);
  assert.strictEqual(structuralChanges.length, 1);
};
