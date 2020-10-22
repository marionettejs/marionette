// Anything viewFilter related

import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/collection-view';
import Region from '../../../src/region';
import View from '../../../src/view';

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
      onBeforeFilter: this.sinon.stub(),
      onFilter: this.sinon.stub(),
      onRenderChildren: this.sinon.stub()
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
        expect(myCollectionView.$el.html()).to.equal(nums.join(''));
      });

      it('should not call "before:filter" event', function() {
        expect(myCollectionView.onBeforeFilter).to.not.have.been.called;
      });

      it('should not call "filter" event', function() {
        expect(myCollectionView.onFilter).to.not.have.been.called;
      });
    });

    describe('when viewFilter is invalid', function() {
      let myCollectionView;

      const viewFilter = 47;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({ collection, viewFilter });
      });

      it('should throw InvalidViewFilterError', function() {
        expect(myCollectionView.render.bind(myCollectionView)).to.throw('"viewFilter" must be a function, predicate object literal, a string indicating a model attribute, or falsy');
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
        expect(myCollectionView.$el.html()).to.equal(nums.join(''));
      });

      it('should call "before:filter" event', function() {
        expect(myCollectionView.onBeforeFilter)
          .to.have.been.calledOnce
          .and.calledWith(myCollectionView);
      });

      it('should call "filter" event', function() {
        const calledWith = myCollectionView.onFilter.firstCall.args;
        expect(myCollectionView.onFilter).to.have.been.calledOnce;
        expect(calledWith[0]).to.equal(myCollectionView);
        expect(_.map(calledWith[1], 'model')).to.have.same.members(collectionOddModels);
        expect(_.map(calledWith[2], 'model')).to.have.same.members(collectionEvenModels);
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
        expect(myCollectionView.$el.html()).to.equal(nums.join(''));
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

    describe('when viewFilter is a string', function() {
      let myCollectionView;

      const viewFilter = 'isOdd';

      beforeEach(function() {
        myCollectionView = new MyCollectionView({ collection, viewFilter });

        myCollectionView.render();
      });

      it('should render only the filtered collection', function() {
        const nums = renderModels(collectionOddModels);
        expect(myCollectionView.$el.html()).to.equal(nums.join(''));
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
      expect(myCollectionView.$el.html()).to.equal(nums.join(''));
    });
  });

  describe('#filter', function() {
    describe('when the view is destroyed', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({
          collection
        });

        this.sinon.spy(myCollectionView, 'filter');

        myCollectionView.destroy();

        myCollectionView.filter();
      });

      it('should not filter the children', function() {
        expect(myCollectionView.onBeforeFilter).to.not.have.been.called;
      });

      it('should not render the children', function() {
        expect(myCollectionView.onRenderChildren).to.not.have.been.called;
      });

      it('should return the collectionView', function() {
        expect(myCollectionView.filter).to.have.returned(myCollectionView);
      });
    });

    describe('when the view collection is empty', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView();

        this.sinon.spy(myCollectionView, 'filter');

        myCollectionView.filter();
      });

      it('should not filter the children', function() {
        expect(myCollectionView.onBeforeFilter).to.not.have.been.called;
      });

      it('should render no children', function() {
        expect(myCollectionView.onRenderChildren)
          .to.have.been.calledOnce
          .and.calledWith(myCollectionView, []);
      });

      it('should return the collectionView', function() {
        expect(myCollectionView.filter).to.have.returned(myCollectionView);
      });
    });

    describe('when filtering with an existing viewFilter', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({
          collection,
          viewFilter: 'isOdd'
        });

        this.sinon.spy(myCollectionView, 'filter');
      });

      describe('when the collectionView has not been rendered', function() {
        beforeEach(function() {
          myCollectionView.filter();
        });

        it('should not filter the children', function() {
          expect(myCollectionView.onBeforeFilter).to.not.have.been.called;
        });

        it('should render no children', function() {
          expect(myCollectionView.onRenderChildren)
            .to.have.been.calledOnce
            .and.calledWith(myCollectionView, []);
        });

        it('should return the collectionView', function() {
          expect(myCollectionView.filter).to.have.returned(myCollectionView);
        });
      });

      describe('when the collectionView has been rendered', function() {
        let filteredViews;

        beforeEach(function() {
          myCollectionView.render();

          myCollectionView.onRenderChildren.reset();
          myCollectionView.onBeforeFilter.reset();

          filteredViews = myCollectionView.children.filter(view => {
            return isOdd(view.model.get('num'));
          });

          this.sinon.spy(myCollectionView.children, '_set');

          myCollectionView.filter();
        });

        it('should filter the children', function() {
          expect(myCollectionView.onBeforeFilter).to.have.been.calledOnce;
        });

        it('should set the children', function() {
          expect(myCollectionView.children._set)
            .to.have.been.calledOnce.and.calledWith(filteredViews);
        });

        it('should render the children', function() {
          expect(myCollectionView.onRenderChildren)
            .to.have.been.calledOnce.and.calledWith(myCollectionView, filteredViews);
        });

        it('should return the collectionView', function() {
          expect(myCollectionView.filter).to.have.returned(myCollectionView);
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

      this.sinon.spy(myCollectionView, 'filter');
    });

    it('should return the collectionView instance', function() {
      this.sinon.spy(myCollectionView, 'setFilter');

      myCollectionView.setFilter();

      expect(myCollectionView.setFilter).to.have.returned(myCollectionView);
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
        expect(myCollectionView.filter).to.have.been.calledOnce;
      });

      describe('when setting with the current viewFilter', function() {
        beforeEach(function() {
          myCollectionView.setFilter(newViewFilter);
        });

        // Note: This is nested inside the first setFilter
        it('should not re-filter the view', function() {
          expect(myCollectionView.filter).to.have.been.calledOnce;
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
        expect(myCollectionView.filter).to.not.have.been.called;
      });
    });
  });

  describe('#removeFilter', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new CollectionView();
      this.sinon.spy(myCollectionView, 'setFilter');
      this.sinon.spy(myCollectionView, 'removeFilter');

      myCollectionView.removeFilter('foo');
    });

    it('should call setFilter', function() {
      expect(myCollectionView.setFilter)
        .to.be.calledOnce
        .and.to.be.calledWith(null, 'foo');
    });

    it('should return the collectionView instance', function() {
      expect(myCollectionView.removeFilter).to.have.returned(myCollectionView);
    });
  });

  describe('#isEmpty', function() {
    let myCollectionView;

    beforeEach(function() {
      myCollectionView = new MyCollectionView({
        collection
      });

      myCollectionView.render();

      this.sinon.spy(myCollectionView, 'isEmpty');
    });

    describe('when all children are filtered', function() {
      beforeEach(function() {
        myCollectionView.setFilter(view => { return false; });
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).to.have.been.calledOnce;
      });

      it('should show the empty view', function() {
        expect(myCollectionView.$el.text()).to.equal('Empty');
      });
    });

    describe('when all children are not filtered', function() {
      beforeEach(function() {
        myCollectionView.setFilter(view => { return true; });
      });

      it('should pass isEmpty false in the 1st argument', function() {
        expect(myCollectionView.isEmpty).to.have.been.calledOnce;
      });

      it('should not show the empty view', function() {
        expect(myCollectionView.$el.text()).to.not.equal('Empty');
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

      attachedChild.onAttach = this.sinon.stub();

      myRegion.show(myCollectionView);

      expect(attachedChild.onAttach).to.have.been.calledOnce;
    });

    it('should not trigger attach on children filtered out', function() {
      const detachedChild = myCollectionView._children.findByIndex(2);

      detachedChild.onAttach = this.sinon.stub();

      myRegion.show(myCollectionView);

      expect(detachedChild.onAttach).to.not.have.been.called;
    });
  });
});
