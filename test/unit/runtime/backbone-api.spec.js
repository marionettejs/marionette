import Backbone from 'backbone';
import BackboneApi from '../../../packages/adapters/src/backbone-api';

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

  it('rolls back an entity subscription when setup fails', function() {
    const error = new Error('subscribe failed');
    const entity = {
      on: this.sinon.stub().throws(error),
      off: this.sinon.spy()
    };

    expect(() => BackboneApi.subscribe(entity, 'change', () => {})).to.throw(error);
    expect(entity.off).to.have.been.calledOnce;
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
    collection.add(added, { silent: true });
    collection.trigger('sort', collection, { add: true });
    collection.trigger('sort', collection, { merge: true });
    collection.remove(added, { silent: true });
    collection.trigger('sort', collection, { remove: true });
    collection.add(added, { silent: true });
    collection.trigger('sort', collection);
    collection.trigger('reset', collection, {});
    collection.trigger('update', collection, {
      changes: { added: [added], removed: [removed], merged: [updated] }
    });

    expect(callback).to.have.callCount(5);
    expect(callback.firstCall).to.have.been.calledWithExactly({ kind: 'reorder' });
    expect(callback.secondCall).to.have.been.calledWithExactly({ kind: 'reorder' });
    expect(callback.thirdCall).to.have.been.calledWithExactly({ kind: 'reorder' });
    expect(callback.getCall(3)).to.have.been.calledWithExactly({ kind: 'reset' });
    expect(callback.lastCall).to.have.been.calledWithExactly({
      kind: 'update',
      added: [added],
      removed: [removed],
      updated: [{ previous: updated, current: updated }]
    });

    cleanup();
    collection.trigger('reset', collection, {});
    expect(callback).to.have.callCount(5);
  });

  it('reports a comparator-less set that only reorders existing models', function() {
    const first = new Backbone.Model({ id: 1 });
    const second = new Backbone.Model({ id: 2 });
    const collection = new Backbone.Collection([first, second]);
    const callback = this.sinon.spy();
    const cleanup = BackboneApi.observeCollection(collection, callback);

    collection.set([second, first]);

    expect(callback).to.have.been.calledOnce.and.calledWithExactly({ kind: 'reorder' });
    cleanup();
  });

  it('rolls back structural subscriptions when setup fails', function() {
    const error = new Error('reset subscribe failed');
    const collection = {
      get: this.sinon.stub(),
      length: 0,
      models: [],
      on: this.sinon.stub().throws(error),
      off: this.sinon.spy()
    };

    expect(() => BackboneApi.observeCollection(collection, () => {})).to.throw(error);
    expect(collection.on).to.have.been.calledOnce;
    expect(collection.off).to.have.been.calledOnce;
    expect(collection.off.firstCall.args[0]).to.have.all.keys('sort', 'reset', 'update');
  });
});
