import Backbone from 'backbone';
import BackboneApi from '../../../packages/adapters/src/data/backbone.ts';
import View from '../../../src/modules/view';
import CollectionView from '../../../src/modules/collection-view';

describe('BackboneApi', function() {
  it('maps Backbone model and collection data', function() {
    const model = new Backbone.Model({ present: undefined, title: 'one' });
    const collection = new Backbone.Collection([model]);

    expect(BackboneApi.key(model)).to.equal(model.cid);
    expect(BackboneApi.get(model, 'title')).to.equal('one');
    expect(BackboneApi.get(model, 'constructor')).to.be.undefined;
    expect(BackboneApi.has(model, 'constructor')).to.be.false;
    model.set('constructor', 'value');
    expect(BackboneApi.get(model, 'constructor')).to.equal('value');
    expect(BackboneApi.has(model, 'constructor')).to.be.true;
    expect(BackboneApi.has(model, 'present')).to.be.true;
    expect(BackboneApi.has(model, 'missing')).to.be.false;
    expect(BackboneApi.serialize(model)).to.equal(model.attributes);
    const models = BackboneApi.models(collection);
    expect(models).to.deep.equal(collection.models);
    expect(models).to.not.equal(collection.models);
    models.length = 0;
    expect(BackboneApi.models(collection)).to.deep.equal([model]);
    expect(BackboneApi.items).to.be.undefined;
  });

  it('subscribes with context and returns an idempotent cleanup function', function() {
    const model = new Backbone.Model();
    const context = {};
    const callback = this.sinon.spy();
    const off = this.sinon.spy(model, 'off');
    const cleanup = BackboneApi.subscribe(model, 'change', callback, context);

    model.trigger('change', model);
    cleanup();
    cleanup();
    model.trigger('change', model);

    expect(callback).to.have.been.calledOnce.and.calledOn(context).and.calledWith(model);
    expect(off).to.have.been.calledOnce.and.calledWith('change', callback, context);
  });

  it('leaves owned Backbone state source lifecycle to the caller', function() {
    const model = new Backbone.Model();
    const destroy = this.sinon.spy(model, 'destroy');
    const stopListening = this.sinon.spy(model, 'stopListening');
    const off = this.sinon.spy(model, 'off');

    BackboneApi.disposeOwned(model);

    expect(stopListening).to.not.have.been.called;
    expect(off).to.not.have.been.called;
    expect(destroy).to.not.have.been.called;
  });

  it('normalizes structural collection events and disposes them', function() {
    const collection = new Backbone.Collection();
    const callback = this.sinon.spy();
    const added = new Backbone.Model();
    const removed = new Backbone.Model();
    const updated = new Backbone.Model();
    const cleanup = BackboneApi.observeCollection(collection, callback);

    collection.trigger('sort', collection);
    collection.trigger('sort', collection, { add: true });
    collection.trigger('sort', collection, { merge: true });
    collection.trigger('sort', collection, { remove: true });
    collection.trigger('sort', collection);
    collection.trigger('reset', collection, {});
    collection.trigger('update', collection, {
      changes: { added: [added], removed: [removed], merged: [updated] }
    });

    expect(callback).to.have.callCount(4);
    expect(callback.firstCall).to.have.been.calledWithExactly({ kind: 'reorder' });
    expect(callback.secondCall).to.have.been.calledWithExactly({ kind: 'reorder' });
    expect(callback.thirdCall).to.have.been.calledWithExactly({ kind: 'reset' });
    expect(callback.lastCall).to.have.been.calledWithExactly({
      kind: 'update',
      added: [added],
      removed: [removed],
      updated: [{ previous: updated, current: updated }]
    });

    cleanup();
    collection.trigger('reset', collection, {});
    expect(callback).to.have.callCount(4);
  });

  it('retains the v4 notification boundary for a reorder-only set', function() {
    const first = new Backbone.Model({ id: 1 });
    const second = new Backbone.Model({ id: 2 });
    const collection = new Backbone.Collection([first, second]);
    const callback = this.sinon.spy();
    const cleanup = BackboneApi.observeCollection(collection, callback);
    const Child = View.extend({ template: ({ id }) => String(id) });
    Child.setDataApi(BackboneApi);
    const List = CollectionView.extend({ childView: Child });
    List.setDataApi(BackboneApi);
    const view = new List({ collection }).render();

    collection.set([second, first]);

    expect(collection.models).to.deep.equal([second, first]);
    expect(callback).not.to.have.been.called;
    expect(view.el.textContent).to.equal('12');
    view.render();
    expect(view.el.textContent).to.equal('21');
    view.destroy();
    cleanup();
  });

  it('reports sorted additions and merges once, while preserving explicit sorts', function() {
    const collection = new Backbone.Collection([{ id: 1, rank: 1 }, { id: 2, rank: 2 }], {
      comparator: 'rank'
    });
    const callback = this.sinon.spy();
    const cleanup = BackboneApi.observeCollection(collection, callback);

    collection.add({ id: 3, rank: 0 });
    expect(callback).to.have.been.calledOnce;
    expect(callback.firstCall.args[0].kind).to.equal('update');
    expect(callback.firstCall.args[0].added).to.deep.equal([collection.get(3)]);

    collection.set([{ id: 1, rank: -1 }], { remove: false });
    expect(callback).to.have.been.calledTwice;
    expect(callback.secondCall.args[0]).to.deep.equal({
      kind: 'update', added: [], removed: [],
      updated: [{ previous: collection.get(1), current: collection.get(1) }]
    });
    expect(collection.pluck('id')).to.deep.equal([1, 3, 2]);

    collection.sort();
    expect(callback).to.have.been.calledThrice;
    expect(callback.thirdCall.args[0]).to.deep.equal({ kind: 'reorder' });
    cleanup();
  });

});
