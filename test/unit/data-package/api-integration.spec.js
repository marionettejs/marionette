import { vi, describe, it, expect } from 'vitest';
import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@marionette/data';

describe('@marionette/data Marionette integration', function() {
  it('drives keyed add, removal, reorder, model updates, and reset reconciliation', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const Child = runtime.View.extend({ template: false });
    const List = runtime.CollectionView.extend({ childView: Child, viewComparator: false });
    const collection = new Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const view = new List({ collection });
    view.render();
    const first = collection.get(1);
    const second = collection.get(2);
    const third = collection.get(3);
    const childViews = [first, second, third].map(model => view.children.findByModel(model));

    const add = vi.fn();
    const remove = vi.fn();
    collection.on('add', add);
    collection.on('remove', remove);
    childViews[2].localSelection = true;
    collection.move(third, 0);
    expect(view.children.toArray()).to.deep.equal([childViews[2], childViews[0], childViews[1]]);

    expect(add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(view.children.findByModel(third).localSelection).toBe(true);

    const fourth = collection.add({ id: 4 }, { at: 1 });
    expect(view.children.findByModel(fourth)).to.not.equal(null).and.not.equal(undefined);
    collection.remove(second);
    expect(childViews[1].isDestroyed()).toBe(true);

    first.set({ id: 10, name: 'updated' });
    expect(view.children.findByModel(first)).to.equal(childViews[0]);
    expect(childViews[0].isDestroyed()).toBe(false);
    collection.reset([]);
    expect(view.children.length).to.equal(0);
    view.destroy();
  });

  it('updates both CollectionViews through successive collection mutations', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const List = runtime.CollectionView.extend({
      childView: runtime.View.extend({ template: false })
    });
    const collection = new Collection([{ id: 1 }]);
    const first = new List({ collection }).render();
    const second = new List({ collection }).render();
    const retained = second.children.findByModel(collection.get(1));
    collection.add({ id: 2 });
    collection.add({ id: 3 });

    expect(first.children.map(child => child.model.id)).to.deep.equal([1, 2, 3]);
    expect(second.children.map(child => child.model.id)).to.deep.equal([1, 2, 3]);
    expect(second.children.findByModel(collection.get(1))).to.equal(retained);
    first.destroy();
    second.destroy();
    collection.destroy();
  });

  it('supports a reorder scheduled after the current notification returns', async function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const collection = new Collection([{ id: 1 }, { id: 2 }]);
    const stop = DataApi.observeCollection(collection, change => {
      if (change.kind === 'update') { queueMicrotask(() => collection.move(3, 0)); }
    });
    const view = new runtime.CollectionView({
      collection, childView: runtime.View.extend({ template: false })
    }).render();
    const retained = view.children.findByModel(collection.get(1));

    collection.add({ id: 3 });
    await Promise.resolve();

    expect(view.children.map(child => child.model.id)).to.deep.equal([3, 1, 2]);
    expect(view.children.findByModel(collection.get(1))).to.equal(retained);
    stop();
    view.destroy();
    collection.destroy();
  });

  it('retains a model child through id changes and removes it before a new model reuses the id', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const collection = new Collection([{ id: 1 }, { id: 2 }]);
    const previous = collection.get(1);
    const view = new runtime.CollectionView({
      collection, childView: runtime.View.extend({ template: false })
    }).render();
    const previousChild = view.children.findByModel(previous);
    const retained = view.children.findByModel(collection.get(2));

    previous.set('id', 10);
    expect(view.children.findByModel(previous)).to.equal(previousChild);
    collection.remove(previous);
    collection.add({ id: 1 });

    expect(view.children.map(child => child.model.id)).to.deep.equal([2, 1]);
    expect(previousChild.isDestroyed()).toBe(true);
    expect(view.children.findByModel(collection.get(1))).to.not.equal(previousChild);
    expect(view.children.findByModel(collection.get(2))).to.equal(retained);
    view.destroy();
    collection.destroy();
  });

  it('removes a child once when another collection releases its model first', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const collection = new Collection([{ id: 1 }, { id: 2 }]);
    const model = collection.get(1);
    const other = new Collection([model]);
    const view = new runtime.CollectionView({
      collection, childView: runtime.View.extend({ template: false })
    }).render();
    const removed = view.children.findByModel(model);
    const retained = view.children.findByModel(collection.get(2));
    other.on('remove', () => collection.remove(model));

    model.destroy();

    expect(removed.isDestroyed()).toBe(true);
    expect(view.children.toArray()).to.deep.equal([retained]);
    expect(collection.map(entry => entry.id)).to.deep.equal([2]);
    expect(other.length).to.equal(0);
    view.destroy();
    collection.destroy();
    other.destroy();
  });

  it('supplies modelEvents, collectionEvents, and owned state disposal', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    runtime.setStateApi(StateApi);
    const modelEvent = vi.fn();
    const collectionEvent = vi.fn();
    const stateEvent = vi.fn();
    const TestView = runtime.View.extend({
      modelEvents: { 'change:name': 'onModelChange' },
      collectionEvents: { add: 'onCollectionAdd' },
      onModelChange: modelEvent,
      onCollectionAdd: collectionEvent
    });
    const Owner = runtime.MnObject.extend({
      stateEvents: { 'change:ready': 'onReady' },
      createState() { return new Model({ ready: false }); },
      onReady: stateEvent
    });
    const model = new Model({ id: 1, name: 'one' });
    const collection = new Collection([model]);
    const view = new TestView({ model, collection });
    const owner = new Owner();
    const state = owner.getState();

    model.set('name', 'ONE');
    collection.add({ id: 2 });
    state.set('ready', true);
    expect(modelEvent).toHaveBeenCalledTimes(1);
    expect(collectionEvent).toHaveBeenCalledTimes(1);
    expect(stateEvent).toHaveBeenCalledTimes(1);

    view.destroy();
    owner.destroy();
    expect(state.isDestroyed()).toBe(true);
  });

  it('validates incompatible adapter inputs and disposes subscriptions once', function() {
    expect(() => DataApi.models([])).to.throw(TypeError, 'requires a Collection');
    expect(() => DataApi.observeCollection({}, () => {})).to.throw(TypeError, 'on() and off()');
    expect(() => DataApi.subscribe({}, 'change', () => {})).to.throw(TypeError, 'on() and off()');

    const model = new Model();
    const callback = vi.fn();
    const dispose = DataApi.subscribe(model, 'change', callback);
    dispose();
    dispose();
    model.set('name', 'one');
    expect(callback).not.toHaveBeenCalled();
    StateApi.disposeOwned(model);
    expect(model.isDestroyed()).toBe(true);
    const packageModel = new Model({ name: 'package' });
    expect(DataApi.key(packageModel)).to.equal(packageModel.cid);
    expect(DataApi.get(packageModel, 'name')).to.equal('package');
    expect(DataApi.has(packageModel, 'name')).toBe(true);
    packageModel.toObject = () => ({ endpoint: true });
    expect(DataApi.serialize(packageModel)).to.equal(packageModel.attributes);
    expect(DataApi.get({ name: 'plain' }, 'name')).to.equal('plain');
    expect(DataApi.has({ name: 'plain' }, 'name')).toBe(true);
    expect(DataApi.serialize({ name: 'plain' })).to.deep.equal({ name: 'plain' });
    const collision = Object.create({ constructor: 'inherited', toString: 'inherited' });
    expect(DataApi.get(collision, 'constructor')).toBeUndefined();
    expect(DataApi.get(collision, 'toString')).toBeUndefined();
    expect(DataApi.has(collision, 'constructor')).toBe(false);
    expect(DataApi.has(collision, 'toString')).toBe(false);
    collision.constructor = 'own constructor';
    collision.toString = 'own toString';
    expect(DataApi.get(collision, 'constructor')).to.equal('own constructor');
    expect(DataApi.get(collision, 'toString')).to.equal('own toString');
    expect(DataApi.has(collision, 'constructor')).toBe(true);
    expect(DataApi.has(collision, 'toString')).toBe(true);
    const packageCollection = new Collection([packageModel]);
    expect(DataApi.models(packageCollection)).to.deep.equal([packageModel]);
    expect(DataApi.models(packageCollection)).to.not.equal(packageCollection.models);
    expect(DataApi.items).toBeUndefined();
    packageCollection.destroy();
  });
});
