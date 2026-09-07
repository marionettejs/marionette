import DelegateEntityEventsMixin from '../../../src/mixins/delegate-entity-events';
import { normalizeMethods } from '@marionette/utils';

describe('delegate entity events mixin', function() {
  let obj;
  let model;
  let collection;
  let modelCleanup;
  let collectionCleanup;

  beforeEach(function() {
    model = { type: 'model' };
    collection = { type: 'collection' };
    modelCleanup = this.sinon.spy();
    collectionCleanup = this.sinon.spy();

    obj = Object.assign({
      normalizeMethods,
      onModel: this.sinon.spy(),
      onCollection: this.sinon.spy(),
      Data: {
        subscribe: this.sinon.stub()
      }
    }, DelegateEntityEventsMixin);
    obj.Data.subscribe.withArgs(model).returns(modelCleanup);
    obj.Data.subscribe.withArgs(collection).returns(collectionCleanup);
  });

  describe('#_delegateEntityEvents', function() {
    it('subscribes resolved handlers through DataApi', function() {
      obj.modelEvents = { change: 'onModel' };
      obj.collectionEvents = { update: 'onCollection' };

      obj._delegateEntityEvents(model, collection, obj.Data);

      expect(obj.Data.subscribe.firstCall).to.have.been.calledWithExactly(
        model,
        'change',
        obj.onModel,
        obj
      );
      expect(obj.Data.subscribe.secondCall).to.have.been.calledWithExactly(
        collection,
        'update',
        obj.onCollection,
        obj
      );
      expect(obj._modelEvents).to.equal(obj.modelEvents);
      expect(obj._collectionEvents).to.equal(obj.collectionEvents);
    });

    it('resolves callable maps once', function() {
      const modelEvents = { change: 'onModel' };
      obj.modelEvents = this.sinon.stub().returns(modelEvents);

      obj._delegateEntityEvents(model, null, obj.Data);

      expect(obj.modelEvents).to.have.been.calledOnce.and.calledOn(obj).and.calledWithExactly();
      expect(obj.Data.subscribe).to.have.been.calledOnce;
    });

    it('expands space-separated event names', function() {
      obj.modelEvents = { 'change reset': 'onModel' };

      obj._delegateEntityEvents(model, null, obj.Data);

      expect(obj.Data.subscribe).to.have.callCount(2);
      expect(obj.Data.subscribe.firstCall.args[1]).to.equal('change');
      expect(obj.Data.subscribe.secondCall.args[1]).to.equal('reset');
    });

    it('does not subscribe absent entities or event maps', function() {
      obj._delegateEntityEvents(model, collection, obj.Data);
      obj._delegateEntityEvents(null, null, obj.Data);

      expect(obj.Data.subscribe).to.not.have.been.called;
      expect(obj).to.not.have.property('_modelEventCleanup');
      expect(obj).to.not.have.property('_collectionEventCleanup');
    });

    it('propagates subscription setup errors', function() {
      const error = new Error('subscribe failed');
      obj.modelEvents = { 'first second': 'onModel' };
      obj.Data.subscribe.resetBehavior();
      obj.Data.subscribe.onFirstCall().returns(modelCleanup);
      obj.Data.subscribe.onSecondCall().throws(error);

      expect(() => obj._delegateEntityEvents(model, null, obj.Data)).to.throw(error);
      expect(modelCleanup).to.not.have.been.called;
    });
  });

  describe('#_undelegateEntityEvents', function() {
    it('disposes model and collection subscriptions once', function() {
      obj.modelEvents = { change: 'onModel' };
      obj.collectionEvents = { update: 'onCollection' };
      obj._delegateEntityEvents(model, collection, obj.Data);

      obj._undelegateEntityEvents(model, collection);
      obj._undelegateEntityEvents(model, collection);

      expect(modelCleanup).to.have.been.calledOnce;
      expect(collectionCleanup).to.have.been.calledOnce;
      expect(obj).to.not.have.property('_modelEvents');
      expect(obj).to.not.have.property('_collectionEvents');
    });
  });

  describe('#_deleteEntityEventHandlers', function() {
    it('disposes subscriptions before removing cached maps', function() {
      obj.modelEvents = { change: 'onModel' };
      obj.collectionEvents = { update: 'onCollection' };
      obj._delegateEntityEvents(model, collection, obj.Data);

      obj._deleteEntityEventHandlers();

      expect(modelCleanup).to.have.been.calledOnce;
      expect(collectionCleanup).to.have.been.calledOnce;
      expect(obj).to.not.have.property('_modelEvents');
      expect(obj).to.not.have.property('_collectionEvents');
    });

  });
});
