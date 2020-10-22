import _ from 'underscore';
import Backbone from 'backbone';
import DelegateEntityEventsMixin from '../../../src/mixins/delegate-entity-events';

describe('delegate entity events mixin', function() {
  let obj;
  let model;
  let collection;

  beforeEach(function() {
    obj = _.extend({
      bindEvents: this.sinon.stub(),
      unbindEvents: this.sinon.stub(),
    }, DelegateEntityEventsMixin);

    model = new Backbone.Model();
    collection = new Backbone.Collection();
  });

  describe('#_delegateEntityEvents', function() {
    describe('when passed a model', function() {
      describe('when modelEvents is an object', function() {
        beforeEach(function() {
          obj.modelEvents = { foo: 'onFoo' };
          obj._delegateEntityEvents(model);
        });

        it('should cache modelEvents', function() {
          expect(obj._modelEvents).to.equal(obj.modelEvents);
        });

        it('should call bindEvents', function() {
          expect(obj.bindEvents)
            .to.have.been.calledOnce
            .to.have.been.calledWith(model, obj.modelEvents);
        });
      });

      describe('when modelEvents is a method', function() {
        const modelEvents = { foo: 'onFoo' };

        beforeEach(function() {
          obj.modelEvents = this.sinon.stub().returns(modelEvents);
          obj._delegateEntityEvents(model);
        });

        it('should cache modelEvents', function() {
          expect(obj._modelEvents).to.equal(modelEvents);
        });

        it('should call bindEvents', function() {
          expect(obj.bindEvents)
            .to.have.been.calledOnce
            .to.have.been.calledWith(model, modelEvents);
        });
      });
    });

    describe('when passed a collection', function() {
      describe('when collectionEvents is an object', function() {
        beforeEach(function() {
          obj.collectionEvents = { foo: 'onFoo' };
          obj._delegateEntityEvents(null, collection);
        });

        it('should cache collectionEvents', function() {
          expect(obj._collectionEvents).to.equal(obj.collectionEvents);
        });

        it('should call bindEvents', function() {
          expect(obj.bindEvents)
            .to.have.been.calledOnce
            .to.have.been.calledWith(collection, obj.collectionEvents);
        });
      });

      describe('when collectionEvents is a method', function() {
        const collectionEvents = { foo: 'onFoo' };

        beforeEach(function() {
          obj.collectionEvents = this.sinon.stub().returns(collectionEvents);
          obj._delegateEntityEvents(null, collection);
        });

        it('should cache modelEvents', function() {
          expect(obj._collectionEvents).to.equal(collectionEvents);
        });

        it('should call bindEvents', function() {
          expect(obj.bindEvents)
            .to.have.been.calledOnce
            .to.have.been.calledWith(collection, collectionEvents);
        });
      });
    });

    describe('when entities are not passed', function() {
      beforeEach(function() {
        obj._delegateEntityEvents();
      });

      it('should not call bindEvents', function() {
        expect(obj.bindEvents).to.not.have.been.called;
      });

      it('should not cache event handlers', function() {
        expect(obj).to.not.have.property('_modelEvents');
        expect(obj).to.not.have.property('_collectionEvents');
      });
    });
  });

  describe('#_undelegateEntityEvents', function() {
    describe('when modelEvents have been cached', function() {
      beforeEach(function() {
        obj._modelEvents = 'foo';
        obj._undelegateEntityEvents(model, collection);
      });

      it('should call unbindEvents', function() {
        expect(obj.unbindEvents)
          .to.have.been.calledOnce
          .to.have.been.calledWith(model, 'foo');
      });

      it('should remove the cache', function() {
        expect(obj).to.not.have.property('_modelEvents');
      });
    });

    describe('when collectionEvents have been cached', function() {
      beforeEach(function() {
        obj._collectionEvents = 'foo';
        obj._undelegateEntityEvents(model, collection);
      });

      it('should call unbindEvents', function() {
        expect(obj.unbindEvents)
          .to.have.been.calledOnce
          .to.have.been.calledWith(collection, 'foo');
      });

      it('should remove the cache', function() {
        expect(obj).to.not.have.property('_collectionEvents');
      });
    });

    describe('when no events are cached', function() {
      it('should not call unbindEvents', function() {
        obj._undelegateEntityEvents(model, collection);
        expect(obj.unbindEvents).to.not.have.been.called;
      });
    });
  });

  describe('_deleteEntityEventHandlers', function() {
    it('should remove cached handlers', function() {
      obj._modelEvents = 'foo';
      obj._collectionEvents = 'bar';
      obj._deleteEntityEventHandlers();

      expect(obj).to.not.have.property('_modelEvents');
      expect(obj).to.not.have.property('_collectionEvents');
    });
  });
});
