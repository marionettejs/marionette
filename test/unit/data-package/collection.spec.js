import { Collection, DataApi, Model } from '../../../packages/data/src/index.js';

describe('@marionette/data Collection', function() {
  let collection;
  let changes;
  let dispose;

  beforeEach(function() {
    collection = new Collection([{ id: 1, name: 'one' }, { id: 2, name: 'two' }]);
    changes = [];
    dispose = DataApi.observeCollection(collection, change => changes.push(change));
  });

  afterEach(function() {
    dispose();
    collection.destroy();
  });

  it('provides ordered collection access and iteration', function() {
    expect(collection.length).to.equal(2);
    expect(collection.at(0)).to.equal(collection.get(1));
    expect(collection.indexOf(collection.get(2))).to.equal(1);
    expect(collection.map(entry => entry.id)).to.deep.equal([1, 2]);
    const ids = [];
    collection.forEach(model => ids.push(model.id));
    expect(ids).to.deep.equal([1, 2]);
    expect([...collection].map(model => model.id)).to.deep.equal([1, 2]);
    expect(collection.toJSON()).to.deep.equal([
      { id: 1, name: 'one' },
      { id: 2, name: 'two' }
    ]);
  });

  it('adds and removes exact models with one normalized change each', function() {
    const add = this.sinon.spy();
    const remove = this.sinon.spy();
    const update = this.sinon.spy();
    collection.on('add', add);
    collection.on('remove', remove);
    collection.on('update', update);
    const third = collection.add({ id: 3, name: 'three' }, { at: 1 });

    expect(third).to.be.instanceOf(Model);
    expect(collection.map(model => model.id)).to.deep.equal([1, 3, 2]);
    expect(changes).to.deep.equal([
      { kind: 'update', added: [third], removed: [], updated: [] }
    ]);
    expect(add).to.have.been.calledOnceWith(third, collection);
    expect(update).to.have.been.calledOnce;
    expect(update.firstCall.args[1].changes).to.equal(changes[0]);

    expect(collection.add({ id: 3 })).to.be.undefined;
    expect(collection.remove(3)).to.equal(third);
    expect(remove).to.have.been.calledOnceWith(third, collection);
    expect(changes[1]).to.deep.equal({
      kind: 'update', added: [], removed: [third], updated: []
    });
    expect(update.secondCall.args[1].changes).to.equal(changes[1]);
  });

  it('deduplicates additions in one linear batch', function() {
    const third = new Model({ id: 3 });
    const added = collection.add([third, third, { id: 3 }, { id: 4 }]);

    expect(added.map(model => model.id)).to.deep.equal([3, 4]);
    expect(added[0]).to.equal(third);
    expect(collection.map(model => model.id)).to.deep.equal([1, 2, 3, 4]);
  });

  it('does not construct models for duplicate raw identities', function() {
    let initializeCount = 0;
    const CountingModel = Model.extend({
      idAttribute: 'uuid',
      initialize() {
        initializeCount++;
      }
    });
    const counted = new Collection([{ uuid: 1 }], { model: CountingModel });

    const added = counted.add([
      { uuid: 1 },
      { uuid: 2 },
      { uuid: 2 },
      { name: 'keyless' }
    ]);

    expect(added.map(model => model.id)).to.deep.equal([2, undefined]);
    expect(initializeCount).to.equal(3);
    counted.destroy();
  });

  it('rolls back identity ownership when model event binding fails', function() {
    const model = new Model({ id: 3 });
    const error = new Error('binding failed');
    this.sinon.stub(model, 'on').throws(error);

    expect(() => collection.add(model)).to.throw(error);
    expect(model.set('id', 4)).to.equal(model);
    expect(collection.models).to.not.include(model);
  });

  it('removes a partially registered listener when binding rollback throws', function() {
    const model = new Model({ id: 3 });
    const forwarded = this.sinon.spy();
    const bindingError = new Error('binding failed');
    const on = model.on.bind(model);
    this.sinon.stub(model, 'on').callsFake(function(...args) {
      on(...args);
      throw bindingError;
    });
    this.sinon.stub(model, 'off').throws(new Error('unbinding failed'));
    collection.on('change:name', forwarded);

    expect(() => collection.add(model)).to.throw(bindingError);
    model.set('name', 'not forwarded');

    expect(forwarded).to.not.have.been.called;
    expect(model.set('id', 4)).to.equal(model);
    expect(collection.models).to.not.include(model);
  });

  it('rolls back a partially bound batch without changing membership', function() {
    const first = collection.get(1);
    const third = new Model({ id: 3 });
    const fourth = new Model({ id: 4 });
    const error = new Error('binding failed');
    this.sinon.stub(fourth, 'on').throws(error);

    expect(() => collection.reset([third, fourth])).to.throw(error);
    expect(collection.map(entry => entry.id)).to.deep.equal([1, 2]);
    expect(() => first.set('id', 10)).to.throw(TypeError, 'cannot change a Model id');
    expect(third.set('id', 30)).to.equal(third);
    expect(fourth.set('id', 40)).to.equal(fourth);
  });

  it('rolls back a partially bound batch into an empty Collection', function() {
    const empty = new Collection();
    const first = new Model({ id: 1 });
    const second = new Model({ id: 2 });
    const forwarded = this.sinon.spy();
    const error = new Error('binding failed');
    const off = this.sinon.stub(first, 'off').throws(new Error('rollback failed'));
    this.sinon.stub(second, 'on').throws(error);
    empty.on('change:name', forwarded);

    expect(() => empty.reset([first, second])).to.throw(error);
    off.restore();
    first.set('name', 'not forwarded');

    expect(empty.models).to.deep.equal([]);
    expect(first.set('id', 10)).to.equal(first);
    expect(forwarded).to.not.have.been.called;
    empty.destroy();
  });

  it('keeps the previous model when replacement binding fails', function() {
    const previous = collection.get(1);
    const current = new Model({ id: 3 });
    const error = new Error('binding failed');
    this.sinon.stub(current, 'on').throws(error);

    expect(() => collection.replace(previous, current)).to.throw(error);
    expect(collection.get(1)).to.equal(previous);
    expect(collection.get(3)).to.be.undefined;
    expect(() => previous.set('id', 10)).to.throw(TypeError, 'cannot change a Model id');
    expect(current.set('id', 30)).to.equal(current);
  });

  it('restores membership and ownership when unbinding fails', function() {
    const model = collection.get(1);
    const current = new Model({ id: 3 });
    const forwarded = this.sinon.spy();
    collection.on('change:name', forwarded);
    const off = model.off.bind(model);
    const error = new Error('unbinding failed');
    const stub = this.sinon.stub(model, 'off').callsFake(function(...args) {
      off(...args);
      throw error;
    });

    expect(() => collection.reset([current])).to.throw(error);
    stub.restore();
    expect(collection.get(1)).to.equal(model);
    expect(collection.length).to.equal(2);
    expect(() => model.set('id', 10)).to.throw(TypeError, 'cannot change a Model id');
    expect(current.set('id', 30)).to.equal(current);
    model.set('name', 'forwarded once');
    expect(forwarded).to.have.been.calledOnce;
  });

  it('restores every binding when an empty reset fails', function() {
    const first = collection.get(1);
    const second = collection.get(2);
    const forwarded = this.sinon.spy();
    const error = new Error('unbinding failed');
    const off = second.off.bind(second);
    const stub = this.sinon.stub(second, 'off').callsFake(function(...args) {
      off(...args);
      throw error;
    });
    collection.on('change:name', forwarded);

    expect(() => collection.reset()).to.throw(error);
    stub.restore();
    first.set('name', 'first');
    second.set('name', 'second');

    expect(collection.models).to.deep.equal([first, second]);
    expect(() => first.set('id', 10)).to.throw(TypeError, 'cannot change a Model id');
    expect(() => second.set('id', 20)).to.throw(TypeError, 'cannot change a Model id');
    expect(forwarded).to.have.been.calledTwice;
  });

  it('does not duplicate forwarding when unbinding fails before removing the handler', function() {
    const model = collection.get(1);
    const current = new Model({ id: 3 });
    const forwarded = this.sinon.spy();
    const error = new Error('unbinding failed');
    const stub = this.sinon.stub(model, 'off').throws(error);
    collection.on('change:name', forwarded);

    expect(() => collection.reset([current])).to.throw(error);
    stub.restore();
    model.set('name', 'forwarded once');

    expect(collection.get(1)).to.equal(model);
    expect(forwarded).to.have.been.calledOnce;
  });

  it('restores bindings canonically when overridable event methods fail', function() {
    const model = collection.get(1);
    const current = new Model({ id: 3 });
    const forwarded = this.sinon.spy();
    const unbindingError = new Error('unbinding failed');
    const off = this.sinon.stub(model, 'off').throws(unbindingError);
    const on = this.sinon.stub(model, 'on').throws(new Error('binding failed'));
    collection.on('change:name', forwarded);

    expect(() => collection.reset([current])).to.throw(unbindingError);
    off.restore();
    on.restore();
    model.set('name', 'forwarded once');

    expect(collection.get(1)).to.equal(model);
    expect(() => model.set('id', 10)).to.throw(TypeError, 'cannot change a Model id');
    expect(forwarded).to.have.been.calledOnce;
    expect(current.set('id', 30)).to.equal(current);
    expect(model.destroy()).to.equal(model);
    expect(collection.get(1)).to.be.undefined;
  });

  it('handles array, keyless, custom-model, and empty mutation boundaries', function() {
    const CustomModel = Model.extend({});
    const custom = new Collection(null, { model: CustomModel });
    const keyless = new CustomModel({ name: 'keyless' });

    expect(custom.add(null)).to.be.undefined;
    expect(custom.add([])).to.deep.equal([]);
    expect(custom.add([keyless, keyless])).to.deep.equal([keyless]);
    expect(custom.remove([keyless, keyless])).to.deep.equal([keyless]);
    expect(custom.remove([])).to.deep.equal([]);
    expect(custom.reset(null)).to.equal(custom);

    custom.destroy();
  });

  it('does not resolve nullish identities to a keyless Model', function() {
    const keyless = new Model({ name: 'keyless' });
    collection.reset([keyless], { silent: true });

    expect(collection.get(null)).to.be.undefined;
    expect(collection.get(undefined)).to.be.undefined;
    expect(collection.remove(undefined)).to.be.undefined;
    expect(collection.replace(null, { id: 2 })).to.be.undefined;
    expect(collection.touch(undefined)).to.be.undefined;
    expect(collection.move(null, 0)).to.be.undefined;
    expect(collection.models).to.deep.equal([keyless]);
  });

  it('uses SameValueZero matching for NaN ids', function() {
    const model = new Model({ id: NaN, name: 'one' });
    collection.reset([model], { silent: true });

    expect(collection.get(NaN)).to.equal(model);
    expect(collection.add({ id: NaN })).to.be.undefined;
    model.set('name', 'two');
    const replacement = collection.replace(NaN, { id: NaN, name: 'three' });
    expect(changes[0].updated).to.deep.equal([{ previous: model, current: replacement }]);
    expect(collection.remove(NaN)).to.equal(replacement);
  });

  it('treats null construction and mutation options as no options', function() {
    const custom = new Collection([], null);
    const first = custom.add({ id: 1 }, null);
    const second = custom.add({ id: 2 }, null);

    expect(custom.touch(first, null)).to.equal(first);
    expect(custom.move(first, 1, null)).to.equal(first);
    expect(custom.swap(first, second, null)).to.equal(custom);
    expect(custom.sort('id', null)).to.equal(custom);
    expect(custom.replace(first, { id: 3 }, null).id).to.equal(3);
    expect(custom.remove(second, null)).to.equal(second);
    expect(custom.reset([], null)).to.equal(custom);
    custom.destroy();
  });

  it('rejects invalid observation targets with the stable adapter error', function() {
    for (const target of [null, undefined, 1, 'collection']) {
      expect(() => DataApi.observeCollection(target, () => {}))
        .to.throw(TypeError, 'own Collection');
    }
  });

  it('rejects duplicate reset and replacement snapshots without changing membership', function() {
    const first = collection.get(1);
    const second = collection.get(2);

    expect(() => collection.reset([first, first])).to.throw(TypeError, 'unique instances and ids');
    expect(() => collection.reset([{ id: 3 }, { id: 3 }]))
      .to.throw(TypeError, 'unique instances and ids');
    expect(() => collection.replace(first, second)).to.throw(TypeError, 'unique instances and ids');
    expect(() => collection.replace(first, { id: 2 })).to.throw(TypeError, 'unique instances and ids');
    expect(collection.models).to.deep.equal([first, second]);
    expect(changes).to.deep.equal([]);
    expect(() => first.set('id', 3)).to.throw(TypeError, 'cannot change a Model id');
  });

  it('resets, swaps, moves, and sorts with exact records', function() {
    const reset = this.sinon.spy();
    const reorder = this.sinon.spy();
    collection.on('reset', reset);
    collection.on('reorder', reorder);

    collection.swap(1, 2);
    expect(collection.map(model => model.id)).to.deep.equal([2, 1]);
    collection.move(2, 1);
    expect(collection.map(model => model.id)).to.deep.equal([1, 2]);
    collection.sort((left, right) => right.id - left.id);
    expect(collection.map(model => model.id)).to.deep.equal([2, 1]);
    collection.sort('name');
    expect(collection.map(model => model.id)).to.deep.equal([1, 2]);
    collection.reset([{ id: 4 }]);

    expect(changes.map(change => change.kind)).to.deep.equal([
      'reorder', 'reorder', 'reorder', 'reorder', 'reset'
    ]);
    expect(reorder).to.have.callCount(4);
    expect(reset).to.have.been.calledOnceWith(collection);
  });

  it('reports stable-key replacement separately from identity replacement and touch', function() {
    const previous = collection.get(1);
    const current = collection.replace(previous, { id: 1, name: 'ONE' });
    expect(changes[0]).to.deep.equal({
      kind: 'update', added: [], removed: [],
      updated: [{ previous, current }]
    });

    const replacement = collection.replace(current, { id: 3, name: 'three' });
    expect(changes[1]).to.deep.equal({
      kind: 'update', added: [replacement], removed: [current], updated: []
    });
    expect(collection.touch(replacement)).to.equal(replacement);
    expect(changes[2].updated).to.deep.equal([{ previous: replacement, current: replacement }]);
  });

  it('re-emits model events without structural notifications', function() {
    const changeName = this.sinon.spy();
    const onChangeName = this.sinon.spy();
    collection.onChangeName = onChangeName;
    collection.on('change:name', changeName);
    const model = collection.get(1);

    model.set('name', 'ONE');
    expect(changeName).to.have.been.calledOnceWith(model, 'ONE');
    expect(onChangeName).to.have.been.calledOnceWith(model, 'ONE');
    expect(changes).to.deep.equal([]);
    model.destroy();
    expect(collection.get(1)).to.be.undefined;
    expect(changes[0].removed).to.deep.equal([model]);
  });

  it('removes a directly destroyed Model from every owning Collection', function() {
    const model = collection.get(1);
    const other = new Collection([model]);
    const otherChanges = [];
    const stopObserving = DataApi.observeCollection(other, change => otherChanges.push(change));

    model.destroy();

    expect(collection.get(1)).to.be.undefined;
    expect(other.get(1)).to.be.undefined;
    expect(changes[0].removed).to.deep.equal([model]);
    expect(otherChanges[0].removed).to.deep.equal([model]);
    stopObserving();
    other.destroy();
  });

  it('removes a destroyed Model from every owner when custom unbinding throws', function() {
    const model = collection.get(1);
    const other = new Collection([model]);
    const forwarded = this.sinon.spy();
    const destructionError = new Error('unbinding failed');
    this.sinon.stub(model, 'off').throws(destructionError);
    collection.on('change:name', forwarded);

    expect(() => model.destroy()).to.throw(destructionError);
    model.trigger('change:name', model, 'not forwarded');

    expect(collection.get(1)).to.be.undefined;
    expect(other.get(1)).to.be.undefined;
    expect(changes[0].removed).to.deep.equal([model]);
    expect(forwarded).to.not.have.been.called;
    other.destroy();
  });

  it('removes a destroyed Model from every owner before a destroy handler throws', function() {
    const model = collection.get(1);
    const other = new Collection([model]);
    const destructionError = new Error('destruction failed');
    model.on('destroy', () => { throw destructionError; });

    expect(() => model.destroy()).to.throw(destructionError);

    expect(collection.get(1)).to.be.undefined;
    expect(other.get(1)).to.be.undefined;
    other.destroy();
  });

  it('supports silent and no-op mutations', function() {
    const first = collection.get(1);
    expect(collection.move(first, 0)).to.equal(first);
    expect(() => collection.move(first, 1.5)).to.throw(TypeError, 'requires an integer index');
    expect(collection.swap(first, first)).to.equal(collection);
    expect(collection.move('missing', 0)).to.be.undefined;
    expect(collection.replace('missing', {})).to.be.undefined;
    expect(collection.touch('missing')).to.be.undefined;
    expect(collection.remove('missing')).to.be.undefined;
    expect(collection.sort()).to.equal(collection);
    collection.add({ id: 3 }, { silent: true });
    collection.remove(3, { silent: true });
    collection.touch(first, { silent: true });
    collection.move(first, 1, { silent: true });
    collection.swap(1, 2, { silent: true });
    collection.sort((left, right) => right.id - left.id, { silent: true });
    collection.sort((left, right) => right.id - left.id);
    collection.reset([], { silent: true });
    expect(changes).to.deep.equal([]);
  });

  it('keeps stable order when sorting equal string values', function() {
    collection.reset([
      { id: 1, name: 'same' },
      { id: 2, name: 'zebra' },
      { id: 3, name: 'same' }
    ], { silent: true });

    collection.sort('name');
    expect(collection.map(model => model.id)).to.deep.equal([1, 3, 2]);
  });

  it('uses cid keys for keyless replacement records', function() {
    const keyless = new Model({ name: 'one' });
    collection.reset([keyless], { silent: true });

    expect(collection.replace(keyless, keyless)).to.equal(keyless);
    expect(changes[0].updated).to.deep.equal([{ previous: keyless, current: keyless }]);
  });

  it('releases structural and model observation on idempotent destroy', function() {
    const destroy = this.sinon.spy();
    const modelChange = this.sinon.spy();
    const model = collection.get(1);
    collection.on('destroy', destroy);
    collection.on('change', modelChange);

    dispose();
    dispose();
    collection.destroy({ source: 'test' });
    collection.destroy();
    model.set('name', 'ignored by collection');
    collection.add({ id: 3 });
    collection.sort((left, right) => right.id - left.id);

    expect(collection.add([])).to.deep.equal([]);
    expect(collection.remove(1)).to.be.undefined;
    expect(collection.remove([1])).to.deep.equal([]);
    expect(collection.reset()).to.equal(collection);
    expect(collection.replace(1, { id: 1 })).to.be.undefined;
    expect(collection.touch(model)).to.be.undefined;
    expect(collection.move(model, 0)).to.be.undefined;
    expect(collection.swap(model, { id: 2 })).to.equal(collection);
    expect(collection.map(entry => entry.id)).to.deep.equal([1, 2]);

    expect(destroy).to.have.been.calledOnceWith(collection, { source: 'test' });
    expect(modelChange).to.not.have.been.called;
    expect(collection.isDestroyed()).to.be.true;
    expect(changes).to.deep.equal([]);
    expect(() => DataApi.observeCollection(collection, () => {}))
      .to.throw(TypeError, 'own Collection');
  });

  it('releases model ownership and listeners when construction or destruction throws', function() {
    const source = new Model();
    const model = new Model({ id: 10 });
    const callback = this.sinon.spy();
    const constructionError = new Error('construction failed');
    let failedCollection;
    const BrokenCollection = Collection.extend({
      initialize() {
        failedCollection = this;
        this.listenTo(source, 'change', callback);
        throw constructionError;
      }
    });

    expect(() => new BrokenCollection([model])).to.throw(constructionError);
    expect(failedCollection.isDestroyed()).to.be.true;
    expect(failedCollection.add({ id: 12 })).to.be.undefined;
    expect(failedCollection.reset()).to.equal(failedCollection);
    expect(failedCollection.destroy()).to.equal(failedCollection);
    expect(model.set('id', 11)).to.equal(model);
    source.set('phase', 'after-construction');
    expect(callback).to.not.have.been.called;

    const ownedModel = collection.get(1);
    const destructionError = new Error('destruction failed');
    collection.on('destroy', () => { throw destructionError; });
    expect(() => collection.destroy()).to.throw(destructionError);
    expect(ownedModel.set('id', 5)).to.equal(ownedModel);
    expect(() => DataApi.observeCollection(collection, () => {}))
      .to.throw(TypeError, 'own Collection');
  });

  it('removes model listeners when custom unbinding throws during destruction', function() {
    const model = collection.get(1);
    const unbindError = new Error('unbinding failed');
    this.sinon.stub(model, 'off').throws(unbindError);

    expect(() => collection.destroy()).to.throw(unbindError);
    const forwarded = this.sinon.spy();
    collection.on('change:name', forwarded);
    model.set('name', 'not forwarded');

    expect(forwarded).to.not.have.been.called;
    expect(model.set('id', 5)).to.equal(model);
  });

  [undefined, null, false, 0, ''].forEach(error => {
    const label = error === '' ? 'an empty string' : String(error);
    it(`preserves ${label} thrown during unbinding and restores membership`, function() {
      const model = collection.get(1);
      const off = model.off;
      model.off = () => { throw error; };
      let caught = false;
      let received;

      try {
        collection.remove(model);
      } catch (value) {
        caught = true;
        received = value;
      } finally {
        model.off = off;
      }

      expect(caught).to.be.true;
      expect(received).to.equal(error);
      expect(collection.get(1)).to.equal(model);
      expect(collection.length).to.equal(2);
      const forwarded = this.sinon.spy();
      collection.on('change:name', forwarded);
      model.set('name', 'still owned');
      expect(forwarded).to.have.been.calledOnce;
    });

    it(`releases model listeners when unbinding throws ${label} during destruction`, function() {
      const model = collection.get(1);
      const off = model.off;
      model.off = () => { throw error; };
      let caught = false;
      let received;

      try {
        collection.destroy();
      } catch (value) {
        caught = true;
        received = value;
      } finally {
        model.off = off;
      }

      expect(caught).to.be.true;
      expect(received).to.equal(error);
      const forwarded = this.sinon.spy();
      collection.on('change:name', forwarded);
      model.set('name', 'no longer owned');
      expect(forwarded).not.to.have.been.called;
      expect(model.set('id', 5)).to.equal(model);
    });
  });
});
