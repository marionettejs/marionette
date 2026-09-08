import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../../setup/backbone.js';
// Anything testing the integration of the ViewMixin, but not the ViewMixin itself.

import _ from 'underscore';
import Backbone from 'backbone';
import { CollectionView } from 'marionette';
import { View, Behavior } from 'marionette';

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

      initBehaviorsSpy = vi.fn();
      mergeOptions.behaviors.observer = Behavior.extend({ initialize: initBehaviorsSpy });
      initializeSpy = vi.spyOn(MyCollectionView.prototype, 'initialize');
      delegateEntityEventsSpy = vi.spyOn(MyCollectionView.prototype, 'delegateEntityEvents');

      collectionView = new MyCollectionView(mergeOptions);
    });

    _.each(mergeOptions, function(value, key) {
      it(`should merge ViewMixin option ${ key }`, function() {
        expect(collectionView[key]).to.equal(value);
      });
    });

    it('initializes configured behaviors before the host', function() {
      expect(initBehaviorsSpy).toHaveBeenCalledTimes(1);
      expect(initBehaviorsSpy).toHaveBeenCalledBefore(initializeSpy);
    });

    it('should call delegateEntityEvents', function() {
      expect(delegateEntityEventsSpy).toHaveBeenCalledTimes(1);
      expect(delegateEntityEventsSpy).toHaveBeenCalledAfter(initializeSpy);
    });
  });

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

      handlerSpy = vi.fn();
      collectionView.on('childview:foo', handlerSpy);

      collectionView.render();
    });

    it('forwards the public prefixed child event', function() {
      const childView = collectionView.children.findByIndex(0);

      handlerSpy.mockClear();

      childView.triggerMethod(eventArg, dataArg);

      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(handlerSpy).toHaveBeenCalledWith(dataArg);
    });

    describe('when the childView is removed from the collectionView', function() {
      it('stops forwarding events from removed children', function() {
        const childView = collectionView.children.findByIndex(0);

        collectionView.removeChildView(childView);

        handlerSpy.mockClear();

        childView.triggerMethod(eventArg, dataArg);

        expect(handlerSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('public child snapshots', function() {
    let collectionView;

    describe('when empty', function() {
      beforeEach(function() {
        collectionView = new CollectionView();
      });

      it('should return an empty array for public child traversal', function() {
        expect(collectionView.children.toArray())
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

      it('should return an empty array for public child traversal', function() {
        expect(collectionView.children.toArray())
          .to.be.instanceof(Array)
          .and.to.have.length(2)
          .and.to.contain(childOne)
          .and.to.contain(childTwo);
      });
    });
  });

  describe('collection reset', function() {
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

      collectionView.collection.reset();
    });

    it('should empty the children', function() {
      expect(collectionView.children).to.have.lengthOf(0);
    });

    it('should have destroyed all of the children', function() {
      expect(childOne.isDestroyed()).toBe(true);
      expect(childTwo.isDestroyed()).toBe(true);
    });
  });
});
