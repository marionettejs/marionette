import { Collection, DataApi, Model } from '../../../packages/data/src/index.js';

describe('@marionette/data collection observers', function() {
  let collection;

  beforeEach(function() {
    collection = new Collection([{ id: 1 }, { id: 2 }]);
  });

  afterEach(function() {
    collection.destroy();
  });

  function mutateBeforeSecondObserver(mutate, snapshots) {
    let mutated = false;
    DataApi.observeCollection(collection, () => {
      if (mutated) { return; }
      mutated = true;
      mutate();
    });
    const changes = [];
    DataApi.observeCollection(collection, change => {
      changes.push(change);
      if (snapshots) { snapshots.push(DataApi.models(collection)); }
    });
    return changes;
  }

  it('includes both additions for an observer first called by a nested mutation', function() {
    const changes = mutateBeforeSecondObserver(() => collection.add({ id: 4 }));
    const third = collection.add({ id: 3 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [third, collection.get(4)], removed: [], updated: []
    }]);
  });

  it('omits a model added and removed before an observer receives it', function() {
    const changes = mutateBeforeSecondObserver(() => collection.remove(3));
    collection.add({ id: 3 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [], removed: [], updated: []
    }]);
  });

  it('adds the final replacement of a model an observer has not received yet', function() {
    const changes = mutateBeforeSecondObserver(() => collection.replace(3, { id: 3 }));
    collection.add({ id: 3 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [collection.get(3)], removed: [], updated: []
    }]);
  });

  it('reports replacement from the model the observer last received', function() {
    const previous = collection.get(1);
    const changes = mutateBeforeSecondObserver(() => collection.replace(1, { id: 1 }));
    collection.replace(1, { id: 1 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [], removed: [],
      updated: [{ previous, current: collection.get(1) }]
    }]);
  });

  it('reports removal of the original model when its replacement is removed', function() {
    const previous = collection.get(1);
    const changes = mutateBeforeSecondObserver(() => collection.remove(1));
    collection.replace(1, { id: 1 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [], removed: [previous], updated: []
    }]);
  });

  it('reports a same-key removal and addition as a replacement', function() {
    const previous = collection.get(1);
    const changes = mutateBeforeSecondObserver(() => collection.add({ id: 1 }));
    collection.remove(1);

    expect(changes).to.deep.equal([{
      kind: 'update', added: [], removed: [],
      updated: [{ previous, current: collection.get(1) }]
    }]);
  });

  it('keeps separate keys when a removed model is re-added with a different id', function() {
    const model = collection.get(1);
    const changes = mutateBeforeSecondObserver(() => {
      model.set('id', 10);
      collection.add(model);
    });
    collection.remove(model);

    expect(changes).to.deep.equal([{
      kind: 'update', added: [model], removed: [model], updated: []
    }]);
  });

  it('combines in-place updates for a model without an id', function() {
    const model = new Model();
    collection.add(model);
    const changes = mutateBeforeSecondObserver(() => collection.touch(model));
    collection.touch(model);

    expect(changes).to.deep.equal([{
      kind: 'update', added: [], removed: [], updated: [{ previous: model, current: model }]
    }]);
  });

  it('retains membership changes when an observer also misses a reorder', function() {
    const snapshots = [];
    const changes = mutateBeforeSecondObserver(() => collection.move(3, 0), snapshots);
    const third = collection.add({ id: 3 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [third], removed: [], updated: []
    }]);
    expect(collection.at(0)).to.equal(third);
    expect(snapshots).to.deep.equal([[third, collection.get(1), collection.get(2)]]);
  });

  it('retains a nested update when an observer has not received a reorder', function() {
    const snapshots = [];
    const changes = mutateBeforeSecondObserver(() => collection.add({ id: 3 }), snapshots);
    collection.move(2, 0);

    expect(changes).to.deep.equal([{
      kind: 'update', added: [collection.get(3)], removed: [], updated: []
    }]);
    expect(snapshots).to.deep.equal([[collection.get(2), collection.get(1), collection.get(3)]]);
  });

  it('retains an explicit reset when another change happens during its notification', function() {
    const changes = mutateBeforeSecondObserver(() => collection.add({ id: 4 }));
    collection.reset([{ id: 3 }]);

    expect(changes).to.deep.equal([{ kind: 'reset' }]);
  });

  it('uses a nested reset instead of a pending incremental change', function() {
    const changes = mutateBeforeSecondObserver(() => collection.reset([{ id: 4 }]));
    collection.add({ id: 3 });

    expect(changes).to.deep.equal([{ kind: 'reset' }]);
  });

  it('keeps undelivered changes when an earlier observer throws', function() {
    const error = new Error('observer failed');
    const stop = DataApi.observeCollection(collection, () => { throw error; });
    const changes = [];
    DataApi.observeCollection(collection, change => changes.push(change));

    expect(() => collection.add({ id: 3 })).to.throw(error);
    stop();
    const fourth = collection.add({ id: 4 });

    expect(changes).to.deep.equal([{
      kind: 'update', added: [collection.get(3), fourth], removed: [], updated: []
    }]);
  });

  it('does not call an observer released by an earlier callback', function() {
    DataApi.observeCollection(collection, () => stop());
    const callback = this.sinon.spy();
    const stop = DataApi.observeCollection(collection, callback);
    collection.add({ id: 3 });

    expect(callback).to.not.have.been.called;
  });

  it('does not call remaining observers after a callback destroys the collection', function() {
    DataApi.observeCollection(collection, () => collection.destroy());
    const callback = this.sinon.spy();
    DataApi.observeCollection(collection, callback);
    collection.add({ id: 3 });

    expect(callback).to.not.have.been.called;
  });
});
