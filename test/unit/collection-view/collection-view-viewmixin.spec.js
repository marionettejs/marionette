// Anything testing the integration of the ViewMixin, but not the ViewMixin itself.

import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/collection-view';
import View from '../../../src/view';

describe('CollectionView - ViewMixin', function() {

  describe('when initializing a CollectionView', function() {
    let collectionView;
    let initBehaviorsSpy;
    let initializeSpy;
    let delegateEntityEventsSpy;

    const mergeOptions = {
      behaviors: {},
      childViewEventPrefix: 'child',
      childViewEvents: {},
      childViewTriggers: {},
      collectionEvents: {},
      modelEvents: {},
      triggers: {},
      ui: {}
    };

    beforeEach(function() {
      const MyCollectionView = CollectionView.extend();

      initBehaviorsSpy = this.sinon.spy(MyCollectionView.prototype, '_initBehaviors');
      initializeSpy = this.sinon.spy(MyCollectionView.prototype, 'initialize');
      delegateEntityEventsSpy = this.sinon.spy(MyCollectionView.prototype, 'delegateEntityEvents');

      collectionView = new MyCollectionView(mergeOptions);
    });

    _.each(mergeOptions, function(value, key) {
      it(`should merge ViewMixin option ${ key }`, function() {
        expect(collectionView[key]).to.equal(value);
      });
    });

    it('should call _initBehaviors', function() {
      expect(initBehaviorsSpy)
        .to.have.been.calledOnce
        .and.calledBefore(initializeSpy);
    });

    it('should call delegateEntityEvents', function() {
      expect(delegateEntityEventsSpy)
        .to.have.been.calledOnce
        .and.calledAfter(initializeSpy);
    });
  });

  // _childViewEventHandler
  describe('when an event is triggered on a childView', function() {
    let collectionView;
    let handlerSpy;

    const eventArg = 'foo';
    const dataArg = 'bar';

    beforeEach(function() {
      const MyCollectionView = CollectionView.extend({
        childView: View.extend({ template: _.noop })
      });
      const collection = new Backbone.Collection([{}, {}]);

      collectionView = new MyCollectionView({ collection, childViewEventPrefix: 'childview' });

      handlerSpy = this.sinon.spy(collectionView, '_childViewEventHandler');

      collectionView.render();
    });

    it('should call _childViewEventHandler', function() {
      const childView = collectionView.children.findByIndex(0);

      handlerSpy.resetHistory();

      childView.triggerMethod(eventArg, dataArg);

      expect(handlerSpy)
        .to.be.calledOnce
        .and.calledWith(eventArg, dataArg);
    });

    describe('when the childView is removed from the collectionView', function() {
      it('should not call _childViewEventHandler', function() {
        const childView = collectionView.children.findByIndex(0);

        collectionView.removeChildView(childView);

        handlerSpy.resetHistory();

        childView.triggerMethod(eventArg, dataArg);

        expect(handlerSpy).to.not.be.called;
      });
    });
  });

  describe('#_getImmediateChildren', function() {
    let collectionView;

    describe('when empty', function() {
      beforeEach(function() {
        collectionView = new CollectionView();
      });

      it('should return an empty array for getImmediateChildren', function() {
        expect(collectionView._getImmediateChildren())
          .to.be.instanceof(Array)
          .and.to.have.length(0);
      });
    });

    describe('when there are children', function() {
      let childOne;
      let childTwo;

      beforeEach(function() {
        collectionView = new CollectionView({
          collection: new Backbone.Collection([{}, {}]),
          childView: View.extend({ template: _.noop })
        });
        collectionView.render();

        const children = collectionView.children;

        childOne = children.findByIndex(0);
        childTwo = children.findByIndex(1);
      });

      it('should return an empty array for getImmediateChildren', function() {
        expect(collectionView._getImmediateChildren())
          .to.be.instanceof(Array)
          .and.to.have.length(2)
          .and.to.contain(childOne)
          .and.to.contain(childTwo);
      });
    });
  });

  describe('#_removeChildren', function() {
    let collectionView;
    let childOne;
    let childTwo;

    beforeEach(function() {
      collectionView = new CollectionView({
        collection: new Backbone.Collection([{}, {}]),
        childView: View.extend({ template: _.noop })
      });
      collectionView.render();

      const children = collectionView.children;

      childOne = children.findByIndex(0);
      childTwo = children.findByIndex(1);

      collectionView._removeChildren();
    });

    it('should empty the children', function() {
      expect(collectionView.children).to.have.lengthOf(0);
    });

    it('should have destroyed all of the children', function() {
      expect(childOne.isDestroyed()).to.be.true;
      expect(childTwo.isDestroyed()).to.be.true;
    });
  });
});
