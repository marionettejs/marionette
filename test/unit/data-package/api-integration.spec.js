import { createMarionette } from '../../../src/index.ts';
import { Collection, DataApi, Model, StateApi } from '../../../packages/data/src/index.js';

describe('@marionette/data Marionette integration', function() {
  it('drives keyed add, removal, reorder, replacement, and reset reconciliation', function() {
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

    collection.swap(first, third);
    expect(view.children.toArray()).to.deep.equal([childViews[2], childViews[1], childViews[0]]);

    const fourth = collection.add({ id: 4 }, { at: 1 });
    expect(view.children.findByModel(fourth)).to.exist;
    collection.remove(second);
    expect(childViews[1].isDestroyed()).to.be.true;

    const replacement = collection.replace(first, { id: 1, name: 'replacement' });
    const replacementView = view.children.findByModel(replacement);
    expect(replacementView).to.not.equal(childViews[0]);
    expect(replacementView.model).to.equal(replacement);
    expect(childViews[0].isDestroyed()).to.be.true;
    collection.reset([]);
    expect(view.children.length).to.equal(0);
    view.destroy();
  });

  it('updates both CollectionViews when the first adds a model during add:child', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const List = runtime.CollectionView.extend({
      childView: runtime.View.extend({ template: false })
    });
    const collection = new Collection([{ id: 1 }]);
    const first = new List({ collection }).render();
    const second = new List({ collection }).render();
    const retained = second.children.findByModel(collection.get(1));
    first.on('add:child', (_, child) => {
      if (child.model.id === 2) { collection.add({ id: 3 }); }
    });

    collection.add({ id: 2 });

    expect(first.children.map(child => child.model.id)).to.deep.equal([1, 2, 3]);
    expect(second.children.map(child => child.model.id)).to.deep.equal([1, 2, 3]);
    expect(second.children.findByModel(collection.get(1))).to.equal(retained);
    first.destroy();
    second.destroy();
    collection.destroy();
  });

  it('preserves child order when an earlier observer reorders a pending addition', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const collection = new Collection([{ id: 1 }, { id: 2 }]);
    const stop = DataApi.observeCollection(collection, change => {
      if (change.kind === 'update') { collection.move(3, 0); }
    });
    const view = new runtime.CollectionView({
      collection, childView: runtime.View.extend({ template: false })
    }).render();
    const retained = view.children.findByModel(collection.get(1));

    collection.add({ id: 3 });

    expect(view.children.map(child => child.model.id)).to.deep.equal([3, 1, 2]);
    expect(view.children.findByModel(collection.get(1))).to.equal(retained);
    stop();
    view.destroy();
    collection.destroy();
  });

  it('catches up an untouched CollectionView after an earlier observer throws', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const collection = new Collection([{ id: 1 }]);
    const error = new Error('earlier observer failed');
    const stop = DataApi.observeCollection(collection, () => { throw error; });
    const view = new runtime.CollectionView({
      collection, childView: runtime.View.extend({ template: false })
    }).render();
    const retained = view.children.findByModel(collection.get(1));

    expect(() => collection.add({ id: 2 })).to.throw(error);
    stop();
    collection.add({ id: 3 });

    expect(view.children.map(child => child.model.id)).to.deep.equal([1, 2, 3]);
    expect(view.children.findByModel(collection.get(1))).to.equal(retained);
    view.destroy();
    collection.destroy();
  });

  it('retains a removed model key when an earlier observer changes its id', function() {
    const runtime = createMarionette();
    runtime.setDataApi(DataApi);
    const collection = new Collection([{ id: 1 }, { id: 2 }]);
    const previous = collection.get(1);
    let changed = false;
    const stop = DataApi.observeCollection(collection, () => {
      if (changed) { return; }
      changed = true;
      previous.set('id', 10);
      collection.add({ id: 1 });
    });
    const view = new runtime.CollectionView({
      collection, childView: runtime.View.extend({ template: false })
    }).render();
    const previousChild = view.children.findByModel(previous);
    const retained = view.children.findByModel(collection.get(2));

    collection.remove(previous);

    expect(view.children.map(child => child.model.id)).to.deep.equal([2, 1]);
    expect(previousChild.isDestroyed()).to.be.true;
    expect(view.children.findByModel(collection.get(1))).to.not.equal(previousChild);
    expect(view.children.findByModel(collection.get(2))).to.equal(retained);
    stop();
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

    expect(removed.isDestroyed()).to.be.true;
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
    const modelEvent = this.sinon.spy();
    const collectionEvent = this.sinon.spy();
    const stateEvent = this.sinon.spy();
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
    expect(modelEvent).to.have.been.calledOnce;
    expect(collectionEvent).to.have.been.calledOnce;
    expect(stateEvent).to.have.been.calledOnce;

    view.destroy();
    owner.destroy();
    expect(state.isDestroyed()).to.be.true;
  });

  it('validates incompatible adapter inputs and disposes subscriptions once', function() {
    expect(() => DataApi.models([])).to.throw(TypeError, 'requires a Collection');
    expect(() => DataApi.observeCollection({}, () => {})).to.throw(TypeError, 'own Collection');
    expect(() => DataApi.observeCollection(new Collection(), null)).to.throw(TypeError, 'with a callback');
    expect(() => DataApi.subscribe({}, 'change', () => {})).to.throw(TypeError, 'on() and off()');

    const model = new Model();
    const callback = this.sinon.spy();
    const dispose = DataApi.subscribe(model, 'change', callback);
    dispose();
    dispose();
    model.set('name', 'one');
    expect(callback).to.not.have.been.called;
    StateApi.disposeOwned(model);
    expect(model.isDestroyed()).to.be.true;
    const packageModel = new Model({ name: 'package' });
    expect(DataApi.key(packageModel)).to.equal(packageModel.cid);
    expect(DataApi.get(packageModel, 'name')).to.equal('package');
    expect(DataApi.has(packageModel, 'name')).to.be.true;
    expect(DataApi.serialize(packageModel)).to.deep.equal({ name: 'package' });
    expect(DataApi.get({ name: 'plain' }, 'name')).to.equal('plain');
    expect(DataApi.has({ name: 'plain' }, 'name')).to.be.true;
    expect(DataApi.serialize({ name: 'plain' })).to.deep.equal({ name: 'plain' });
    const collision = Object.create({ constructor: 'inherited', toString: 'inherited' });
    expect(DataApi.get(collision, 'constructor')).to.be.undefined;
    expect(DataApi.get(collision, 'toString')).to.be.undefined;
    expect(DataApi.has(collision, 'constructor')).to.be.false;
    expect(DataApi.has(collision, 'toString')).to.be.false;
    collision.constructor = 'own constructor';
    collision.toString = 'own toString';
    expect(DataApi.get(collision, 'constructor')).to.equal('own constructor');
    expect(DataApi.get(collision, 'toString')).to.equal('own toString');
    expect(DataApi.has(collision, 'constructor')).to.be.true;
    expect(DataApi.has(collision, 'toString')).to.be.true;
    const packageCollection = new Collection([packageModel]);
    expect(DataApi.models(packageCollection)).to.deep.equal([packageModel]);
    expect(DataApi.models(packageCollection)).to.not.equal(packageCollection.models);
    expect(DataApi.items).to.be.undefined;
    packageCollection.destroy();
  });
});
