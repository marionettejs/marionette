import '../../setup/fixtures.js';
import { vi, describe, it, expect, beforeEach, beforeAll as before } from 'vitest';
import '../../setup/backbone.js';
// Anything viewFilter related

import _ from 'underscore';
import Backbone from 'backbone';
import DataApi from '../../../src/runtime/data-api';
import CollectionView from '../../../src/modules/collection-view';
import Region from '../../../src/modules/region';
import View from '../../../src/modules/view';

function renderModels(models) {
  return _.map(models, model => `<li>${ model.get('num') }</li>`);
}

function isOdd(num) {
  return !!(num % 2);
}

describe('CollectionView - Filtering', function() {
  let collection;
  let collectionOddModels;
  let collectionEvenModels;

  before(function() {
    collection = new Backbone.Collection();

    _.times(50, (n) => { collection.add({ num: n, isOdd: isOdd(n) }); });

    const partition = collection.partition(model => { return isOdd(model.get('num')); });

    collectionOddModels = partition[0];
    collectionEvenModels = partition[1];
  });

  let MyChildView;
  let MyEmptyView;
  let MyCollectionView;

  beforeEach(function() {
    MyEmptyView = View.extend({
      tagName: 'li',
      template: _.template('Empty')
    });

    MyChildView = View.extend({
      tagName: 'li',
      template: _.template('<%- num %>')
    });

    MyCollectionView = CollectionView.extend({
      tagName: 'ul',
      childView: MyChildView,
      emptyView: MyEmptyView,
      onBeforeFilter: vi.fn(),
      onFilter: vi.fn(),
      onRenderChildren: vi.fn()
    });
  });

  describe('#viewFilter', function() {
    describe('when viewFilter is falsy', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({ collection });

        myCollectionView.render();
      });

      it('should render the entire collection', function() {
        const nums = renderModels(collection.models);
        expect(myCollectionView.el.innerHTML).to.equal(nums.join(''));
      });

      it('should not call "before:filter" event', function() {
        expect(myCollectionView.onBeforeFilter).not.toHaveBeenCalled();
      });

      it('should not call "filter" event', function() {
        expect(myCollectionView.onFilter).not.toHaveBeenCalled();
      });
    });

    describe('when viewFilter is a function', function() {
      let myCollectionView;

      const viewFilter = function(view) { return isOdd(view.model.get('num')); };

      beforeEach(function() {
        myCollectionView = new MyCollectionView({ collection, viewFilter });

        myCollectionView.render();
      });

      it('should render only the filtered collection', function() {
        const nums = renderModels(collectionOddModels);
        expect(myCollectionView.el.innerHTML).to.equal(nums.join(''));
      });

      it('should call "before:filter" event', function() {
        expect(myCollectionView.onBeforeFilter).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onBeforeFilter.mock.calls.map(args => args.slice(0, 1))).toContainEqual([myCollectionView]);
      });

      it('should call "filter" event', function() {
        const calledWith = myCollectionView.onFilter.mock.calls.at(0);
        expect(myCollectionView.onFilter).toHaveBeenCalledTimes(1);
        expect(calledWith[0]).to.equal(myCollectionView);
        expect(_.map(calledWith[1], 'model')).to.have.same.members(collectionOddModels);
        expect(_.map(calledWith[2], 'model')).to.have.same.members(collectionEvenModels);
      });

      it('uses the CollectionView receiver and a dense initial-length snapshot', function() {
        const calls = [];
        let expectedLength;
        let mutationView;
        const mutationFilter = function(view, index, children) {
          calls.push([this, view, index, children]);
          if (index === 0) {
            expectedLength = children.length;
            mutationView = {};
            children.push(mutationView);
          }
          if (index === expectedLength - 1) {
            expect(children.pop()).to.equal(mutationView);
          }
          return true;
        };
        const mutationCollection = new Backbone.Collection([
          { num: 1 },
          { num: 2 },
          { num: 3 },
        ]);
        const mutationCollectionView = new MyCollectionView({
          collection: mutationCollection,
          viewFilter: mutationFilter,
        });

        try {
          mutationCollectionView.render();

          expect(calls).to.have.lengthOf(expectedLength);
          expect(calls.map(call => call[0]))
            .to.deep.equal(Array(expectedLength).fill(mutationCollectionView));
          expect(calls.map(call => call[2])).to.deep.equal([0, 1, 2]);
          expect(calls.every(call => call[3] === mutationCollectionView._children._views))
            .to.be.true;
        } finally {
          mutationCollectionView.destroy();
        }
      });
    });

    describe('when viewFilter is an object', function() {
      let myCollectionView;

      const viewFilter = { isOdd: false };

      beforeEach(function() {
        myCollectionView = new MyCollectionView({ collection, viewFilter });

        myCollectionView.render();
      });

      it('should render only the filtered collection', function() {
        const nums = renderModels(collectionEvenModels);
        expect(myCollectionView.el.innerHTML).to.equal(nums.join(''));
      });

      describe('when children has a view without a model', function() {
        beforeEach(function() {
          myCollectionView.addChildView(new View({ template: _.noop }));
        });

        it('should filter without error', function() {
          expect(myCollectionView.filter.bind(myCollectionView)).to.not.throw();
        });
      });

      it('snapshots own enumerable string predicates with strict attribute equality', function() {
        const expected = {};
        const inherited = { inherited: true };
        const predicate = Object.create(inherited);
        const readExpected = vi.fn().mockReturnValue(expected);
        Object.defineProperties(predicate, {
          expected: {
            configurable: true,
            enumerable: true,
            get: readExpected,
          },
          hidden: {
            get() {
              throw new Error('hidden predicate was read');
            },
          },
          [Symbol('ignored')]: {
            enumerable: true,
            get() {
              throw new Error('symbol predicate was read');
            },
          },
        });
        const predicateCollection = new Backbone.Collection([
          { expected, num: 1 },
          { expected: {}, num: 2 },
          { num: 3 },
        ]);
        const predicateView = new MyCollectionView({
          collection: predicateCollection,
          viewFilter: predicate,
        });

        try {
          predicateView.render();
          Object.defineProperty(predicate, 'expected', {
            enumerable: true,
            value: {},
          });

          expect(predicateView.children.pluck('model'))
            .to.deep.equal([predicateCollection.at(0)]);
          expect(readExpected).toHaveBeenCalledTimes(1);
        } finally {
          predicateView.destroy();
        }
      });

      it('requires an undefined predicate key to be present', function() {
        const presenceView = new MyCollectionView({ viewFilter: { optional: undefined } });
        presenceView.Data = DataApi;
        const filter = presenceView._getFilter();
        const presentAttributes = {};
        Object.defineProperty(presentAttributes, 'optional', {
          enumerable: true,
          value: undefined,
        });

        try {
          expect(filter({ model: {} })).to.be.false;
          expect(filter({ model: presentAttributes })).to.be.true;
        } finally {
          presenceView.destroy();
        }
      });

      it('checks attribute presence before reading it', function() {
        const presenceView = new MyCollectionView({ viewFilter: { optional: undefined } });
        presenceView.Data = {
          get: vi.fn().mockImplementation(() => { throw new Error('missing attribute was read'); }),
          has: vi.fn().mockReturnValue(false),
        };
        const filter = presenceView._getFilter();
        const model = {};

        try {
          expect(filter({ model })).to.be.false;
          expect(presenceView.Data.has).toHaveBeenCalledTimes(1);
          expect(presenceView.Data.has.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, 'optional']);
          expect(presenceView.Data.get).not.toHaveBeenCalled();
        } finally {
          presenceView.destroy();
        }
      });
    });

    describe('when viewFilter is a string', function() {
      let myCollectionView;

      const viewFilter = 'isOdd';

      beforeEach(function() {
        myCollectionView = new MyCollectionView({ collection, viewFilter });

        myCollectionView.render();
      });

      it('should render only the filtered collection', function() {
        const nums = renderModels(collectionOddModels);
        expect(myCollectionView.el.innerHTML).to.equal(nums.join(''));
      });

      it('checks attribute presence before reading it', function() {
        const presenceView = new MyCollectionView({ viewFilter: 'optional' });
        presenceView.Data = {
          get: vi.fn().mockImplementation(() => { throw new Error('missing attribute was read'); }),
          has: vi.fn().mockReturnValue(false),
        };
        const filter = presenceView._getFilter();
        const model = {};

        try {
          expect(filter({ model })).to.be.false;
          expect(presenceView.Data.has).toHaveBeenCalledTimes(1);
          expect(presenceView.Data.has.mock.calls.map(args => args.slice(0, 2))).toContainEqual([model, 'optional']);
          expect(presenceView.Data.get).not.toHaveBeenCalled();
        } finally {
          presenceView.destroy();
        }
      });

      describe('when children has a view without a model', function() {
        beforeEach(function() {
          myCollectionView.addChildView(new View({ template: _.noop }));
        });

        it('should filter without error', function() {
          expect(myCollectionView.filter.bind(myCollectionView)).to.not.throw();
        });
      });
    });
  });

  describe('#getFilter', function() {
    let myCollectionView;

    beforeEach(function() {
      MyCollectionView = MyCollectionView.extend({
        getFilter() {
          return { isOdd: false }
        }
      });

      myCollectionView = new MyCollectionView({
        collection,
        viewFilter: 'isOdd'
      });

      myCollectionView.render();
    });

    it('should render only the filtered collection', function() {
      const nums = renderModels(collectionEvenModels);
      expect(myCollectionView.el.innerHTML).to.equal(nums.join(''));
    });
  });

  describe('#filter', function() {
    describe('when the view is destroyed', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({
          collection
        });

        vi.spyOn(myCollectionView, 'filter');

        myCollectionView.destroy();

        myCollectionView.filter();
      });

      it('should not filter the children', function() {
        expect(myCollectionView.onBeforeFilter).not.toHaveBeenCalled();
      });

      it('should not render the children', function() {
        expect(myCollectionView.onRenderChildren).not.toHaveBeenCalled();
      });

      it('should return the collectionView', function() {
        expect(myCollectionView.filter).toHaveReturnedWith(myCollectionView);
      });
    });

    describe('when the view collection is empty', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView();

        vi.spyOn(myCollectionView, 'filter');

        myCollectionView.filter();
      });

      it('should not filter the children', function() {
        expect(myCollectionView.onBeforeFilter).not.toHaveBeenCalled();
      });

      it('should render no children', function() {
        expect(myCollectionView.onRenderChildren).toHaveBeenCalledTimes(1);
        expect(myCollectionView.onRenderChildren.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, []]);
      });

      it('should return the collectionView', function() {
        expect(myCollectionView.filter).toHaveReturnedWith(myCollectionView);
      });
    });

    describe('when filtering with an existing viewFilter', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({
          collection,
          viewFilter: 'isOdd'
        });

        vi.spyOn(myCollectionView, 'filter');
      });

      describe('when the collectionView has not been rendered', function() {
        beforeEach(function() {
          myCollectionView.filter();
        });

        it('should not filter the children', function() {
          expect(myCollectionView.onBeforeFilter).not.toHaveBeenCalled();
        });

        it('should render no children', function() {
          expect(myCollectionView.onRenderChildren).toHaveBeenCalledTimes(1);
          expect(myCollectionView.onRenderChildren.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, []]);
        });

        it('should return the collectionView', function() {
          expect(myCollectionView.filter).toHaveReturnedWith(myCollectionView);
        });
      });

      describe('when the collectionView has been rendered', function() {
        let filteredViews;

        beforeEach(function() {
          myCollectionView.render();

          myCollectionView.onRenderChildren.mockClear();
          myCollectionView.onBeforeFilter.mockClear();

          filteredViews = myCollectionView.children.filter(view => {
            return isOdd(view.model.get('num'));
          });

          vi.spyOn(myCollectionView.children, '_set');

          myCollectionView.filter();
        });

        it('should filter the children', function() {
          expect(myCollectionView.onBeforeFilter).toHaveBeenCalledTimes(1);
        });

        it('should set the children', function() {
          expect(myCollectionView.children._set).toHaveBeenCalledTimes(1);
          expect(myCollectionView.children._set.mock.calls.map(args => args.slice(0, 1))).toContainEqual([filteredViews]);
        });

        it('should render the children', function() {
          expect(myCollectionView.onRenderChildren).toHaveBeenCalledTimes(1);
          expect(myCollectionView.onRenderChildren.mock.calls.map(args => args.slice(0, 2))).toContainEqual([myCollectionView, filteredViews]);
        });

        it('should return the collectionView', function() {
          expect(myCollectionView.filter).toHaveReturnedWith(myCollectionView);
        });
      });
    });
  });

  describe('#setFilter', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({
        collection,
        viewFilter: 'isOdd'
      });

      vi.spyOn(myCollectionView, 'filter');
    });

    it('should return the collectionView instance', function() {
      vi.spyOn(myCollectionView, 'setFilter');

      myCollectionView.setFilter();

      expect(myCollectionView.setFilter).toHaveReturnedWith(myCollectionView);
    });

    describe('when setting with a new viewFilter', function() {

      const newViewFilter = { isOdd: false };

      beforeEach(function() {
        myCollectionView.setFilter(newViewFilter);
      });

      it('should set the viewFilter', function() {
        expect(myCollectionView.viewFilter).to.equal(newViewFilter);
      });

      it('should re-filter the view', function() {
        expect(myCollectionView.filter).toHaveBeenCalledTimes(1);
      });

      describe('when setting with the current viewFilter', function() {
        beforeEach(function() {
          myCollectionView.setFilter(newViewFilter);
        });

        // Note: This is nested inside the first setFilter
        it('should not re-filter the view', function() {
          expect(myCollectionView.filter).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('when setting with preventRender option', function() {
      const newViewFilter = { isOdd: false };

      beforeEach(function() {
        myCollectionView.setFilter(newViewFilter, { preventRender: true });
      });

      it('should set the viewFilter', function() {
        expect(myCollectionView.viewFilter).to.equal(newViewFilter);
      });

      it('should not re-filter the view', function() {
        expect(myCollectionView.filter).not.toHaveBeenCalled();
      });
    });
  });

  describe('#removeFilter', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new CollectionView();
      vi.spyOn(myCollectionView, 'setFilter');
      vi.spyOn(myCollectionView, 'removeFilter');

      myCollectionView.removeFilter('foo');
    });

    it('should call setFilter', function() {
      expect(myCollectionView.setFilter).toHaveBeenCalledTimes(1);
      expect(myCollectionView.setFilter.mock.calls.map(args => args.slice(0, 2))).toContainEqual([null, 'foo']);
    });

    it('should return the collectionView instance', function() {
      expect(myCollectionView.removeFilter).toHaveReturnedWith(myCollectionView);
    });
  });

  describe('#isEmpty', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({
        collection
      });

      myCollectionView.render();

      vi.spyOn(myCollectionView, 'isEmpty');
    });

    describe('when all children are filtered', function() {
      beforeEach(function() {
        myCollectionView.setFilter(view => { return false; });
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
      });

      it('should show the empty view', function() {
        expect(myCollectionView.el.textContent).to.equal('Empty');
      });
    });

    describe('when all children are not filtered', function() {
      beforeEach(function() {
        myCollectionView.setFilter(view => { return true; });
      });

      it('should pass isEmpty false in the 1st argument', function() {
        expect(myCollectionView.isEmpty).toHaveBeenCalledTimes(1);
      });

      it('should not show the empty view', function() {
        expect(myCollectionView.el.textContent).to.not.equal('Empty');
      });
    });
  });

  describe('when attaching a collectionview with filtered children', function() {
    let myCollectionView;
    let myRegion;

    beforeEach(function() {
      const viewFilter = 'isOdd';
      myRegion = new Region({ el: '#fixtures' });

      myCollectionView = new MyCollectionView({ collection, viewFilter });

      myCollectionView.render();
    });

    it('should trigger attach on attached children', function() {
      const attachedChild = myCollectionView._children.findByIndex(1);

      attachedChild.onAttach = vi.fn();

      myRegion.show(myCollectionView);

      expect(attachedChild.onAttach).toHaveBeenCalledTimes(1);
    });

    it('should not trigger attach on children filtered out', function() {
      const detachedChild = myCollectionView._children.findByIndex(2);

      detachedChild.onAttach = vi.fn();

      myRegion.show(myCollectionView);

      expect(detachedChild.onAttach).not.toHaveBeenCalled();
    });
  });
});
