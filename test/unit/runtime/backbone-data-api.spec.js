import Backbone from 'backbone';
import BackboneDataApi from '../../../runtime/backbone-data-api';

describe('BackboneDataApi', function() {
  it('maps Backbone model and collection data', function() {
    const model = new Backbone.Model({ present: undefined, title: 'one' });
    const collection = new Backbone.Collection([model]);

    expect(BackboneDataApi.key(model)).to.equal(model.cid);
    expect(BackboneDataApi.get(model, 'title')).to.equal('one');
    expect(BackboneDataApi.has(model, 'present')).to.be.true;
    expect(BackboneDataApi.has(model, 'missing')).to.be.false;
    expect(BackboneDataApi.has(model, 'constructor')).to.be.false;
    expect(BackboneDataApi.serialize(model)).to.equal(model.attributes);
    expect(BackboneDataApi.items(collection)).to.equal(collection.models);
  });

  it('subscribes with context and returns an idempotent disposer', function() {
    const model = new Backbone.Model();
    const context = {};
    const callback = this.sinon.spy();
    const off = this.sinon.spy(model, 'off');
    const unsubscribe = BackboneDataApi.subscribe(model, 'change', callback, context);

    model.trigger('change', model);
    unsubscribe();
    unsubscribe();
    model.trigger('change', model);

    expect(callback).to.have.been.calledOnce.and.calledOn(context).and.calledWith(model);
    expect(off).to.have.been.calledOnce.and.calledWith('change', callback, context);
  });

  it('normalizes structural collection events and disposes them', function() {
    const collection = new Backbone.Collection();
    const callback = this.sinon.spy();
    const added = new Backbone.Model();
    const removed = new Backbone.Model();
    const updated = new Backbone.Model();
    const unsubscribe = BackboneDataApi.observeCollection(collection, callback);

    collection.trigger('sort', collection, {});
    collection.trigger('sort', collection, { add: true });
    collection.trigger('reset', collection, {});
    collection.trigger('update', collection, {
      changes: { added: [added], removed: [removed], merged: [updated] }
    });

    expect(callback).to.have.callCount(3);
    expect(callback.firstCall).to.have.been.calledWithExactly({ type: 'reorder' });
    expect(callback.secondCall).to.have.been.calledWithExactly({ type: 'reset' });
    expect(callback.thirdCall).to.have.been.calledWithExactly({
      type: 'update',
      added: [added],
      removed: [removed],
      updated: [updated]
    });

    unsubscribe();
    collection.trigger('reset', collection, {});
    expect(callback).to.have.callCount(3);
  });

  it('rolls back structural subscriptions when setup fails', function() {
    const error = new Error('reset subscribe failed');
    const collection = {
      on: this.sinon.stub(),
      off: this.sinon.spy()
    };
    collection.on.onSecondCall().throws(error);

    expect(() => BackboneDataApi.observeCollection(collection, () => {})).to.throw(error);
    expect(collection.on).to.have.been.calledTwice;
    expect(collection.off).to.have.been.calledOnce;
    expect(collection.off.firstCall.args[0]).to.equal('sort');
  });
});
