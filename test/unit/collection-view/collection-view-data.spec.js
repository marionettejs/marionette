// Anything related to Bb.collection events

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../modules/collection-view';
import View from '../../../modules/view';

describe('CollectionView Data', function() {
  let MyCollectionView;

  beforeEach(function() {
    const MyChildView = View.extend({
      template: _.noop
    });

    MyCollectionView = CollectionView.extend({
      childView: MyChildView
    });
  });

  describe('when the collection sorts', function() {
    let collection;

    beforeEach(function() {
      collection = new Backbone.Collection([{ id: 1 }, { id: 3 }, { id: 2 }], { comparator: 'id' });
    });

    describe('when sortWithCollection is false', function() {
      let myCollectionView;

      beforeEach(function() {
        myCollectionView = new MyCollectionView({
          collection,
          sortWithCollection: false
        });

        myCollectionView.render();

        this.sinon.spy(myCollectionView, 'sort');

        myCollectionView.collection.sort();
      });

      it('should not call the sort method', function() {
        expect(myCollectionView.sort).to.not.have.been.called;
      });
    });

    describe('when sortWithCollection is true', function() {
      let myCollectionView;

      beforeEach(function() {
        // sortWithCollection is true by default
        myCollectionView = new MyCollectionView({ collection });

        myCollectionView.render();

        this.sinon.spy(myCollectionView, 'sort');

        myCollectionView.collection.sort();
      });

      it('should call the sort method', function() {
        expect(myCollectionView.sort).to.have.been.calledOnce;
      });
    });

    describe('when sort is triggered from the collection changing', function() {
      let myCollectionView;

      beforeEach(function() {
        // sortWithCollection is true by default
        myCollectionView = new MyCollectionView({ collection });

        myCollectionView.render();

        this.sinon.spy(myCollectionView, 'sort');

        myCollectionView.collection.add({ id: 5 });
      });

      it('should only sort once', function() {
        expect(myCollectionView.sort).to.have.been.calledOnce;
      });
    });

    describe('when the collection resets', function() {
      let myCollectionView;
      let renderChildrenStub;
      let destroyChildrenStub;

      beforeEach(function() {
        renderChildrenStub = this.sinon.stub();
        destroyChildrenStub = this.sinon.stub();

        myCollectionView = new MyCollectionView({
          collection: new Backbone.Collection([{ id: 1 }], { id: 2 })
        });

        myCollectionView.render();

        this.sinon.spy(myCollectionView.children, '_init');

        myCollectionView.on({
          'render:children': renderChildrenStub,
          'destroy:children': destroyChildrenStub
        });

        myCollectionView.collection.reset([{ id: 3 }]);
      });

      it('should destroy the children', function() {
        expect(destroyChildrenStub).to.have.been.calledOnce;
      });

      it('should re init the children', function() {
        expect(myCollectionView.children._init).to.have.been.calledOnce;
      });

      it('should only contain the new children', function() {
        const myModel = myCollectionView.collection.get(3);
        const childView = myCollectionView.children.findByModel(myModel);

        expect(childView).to.not.be.undefined;
        expect(myCollectionView.children).to.have.lengthOf(1);
      });

      it('should render the new children', function() {
        expect(renderChildrenStub).to.have.been.calledOnce;
      });
    });
  });

  describe('when managing models in a collectionView.collection', function() {
    let myCollectionView;
    let collection;
    let attachingModel;
    let detachingModel;

    beforeEach(function() {
      collection = new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);
      attachingModel = new Backbone.Model({ id: 'attaching '});
      detachingModel = collection.at(1);
      myCollectionView = new MyCollectionView({ collection });
    });

    describe('when rendering a collectionView', function() {
      it('should add each of the models as children', function() {
        myCollectionView.render();
        expect(myCollectionView.children.length).to.equal(collection.length);
        myCollectionView.children.each((view, index) => {
          expect(view.model).to.equal(collection.at(index));
        });
      });
    });

    describe('when a collection model changes before a render', function() {
      it('should not trigger any events', function() {
        const collectionViewEventStub = this.sinon.stub();
        myCollectionView.on('all', collectionViewEventStub);
        collection.add(attachingModel);
        collection.remove(detachingModel);

        expect(collectionViewEventStub).to.not.have.been.called;
      });
    });

    describe('when a collection model changes after a render', function() {
      let addChildStub;
      let removeChildStub;
      let renderChildrenStub;
      let removingView;
      let removingViewDestroyStub;

      beforeEach(function() {
        addChildStub = this.sinon.stub();
        removeChildStub = this.sinon.stub();
        renderChildrenStub = this.sinon.stub();
        removingViewDestroyStub = this.sinon.stub();

        myCollectionView.render();

        myCollectionView.on({
          'add:child': addChildStub,
          'remove:child': removeChildStub,
          'render:children': renderChildrenStub
        });

        this.sinon.spy(myCollectionView, 'detachHtml');

        removingView = myCollectionView.children.findByModel(detachingModel);

        removingView.on('destroy', removingViewDestroyStub);

        collection.set([collection.at(0), collection.at(2), attachingModel]);
      });

      it('should remove a child before adding one', function() {
        expect(addChildStub).to.be.calledOnce;
        expect(removeChildStub).to.be.calledOnce;
        expect(addChildStub).to.be.calledAfter(removeChildStub);
      });

      it('should render the children', function() {
        expect(myCollectionView.children.length).to.equal(collection.length);
        myCollectionView.children.each((view, index) => {
          expect(view.model).to.equal(collection.at(index));
        });
      });

      it('should detach the child', function() {
        expect(myCollectionView.detachHtml).to.have.been.calledOnce.and.calledWith(removingView);
      });

      it('should destroy the child', function() {
        expect(removingViewDestroyStub).to.have.been.calledOnce;
      });
    });
  });

  describe('when adding models only to the end of the collection', function() {
    let myCollectionView;
    let collection;

    describe('when children are sorted', function() {
      beforeEach(function() {
        collection = new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);

        myCollectionView = new MyCollectionView({ collection });
        myCollectionView.render();
      });

      it('should append all of the children', function() {
        this.sinon.stub(myCollectionView, 'attachHtml');
        collection.add([{ id: 4 }, { id: 5 }]);

        const callArgs = myCollectionView.attachHtml.args[0];
        const attachHtmlEls = callArgs[0];
        expect($(attachHtmlEls).children()).to.have.lengthOf(2);
      });

      it('should append to the el', function() {
        this.sinon.stub(myCollectionView, 'attachHtml');
        collection.add([{ id: 4 }, { id: 5 }]);

        const callArgs = myCollectionView.attachHtml.args[0];
        const el = callArgs[1];
        expect(el).to.equal(myCollectionView.el);
      });

      it('should still have all children attached', function() {
        collection.add([{ id: 4 }, { id: 5 }]);

        expect(myCollectionView.el.children).to.have.lengthOf(5);
      });
    });

    describe('when children are not sorted', function() {
      beforeEach(function() {
        collection = new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);

        myCollectionView = new MyCollectionView({ collection, viewComparator: false });
        myCollectionView.render();
      });

      it('should only append the added children', function() {
        this.sinon.stub(myCollectionView, 'attachHtml');
        collection.add([{ id: 4 }, { id: 5 }]);

        const callArgs = myCollectionView.attachHtml.args[0];
        const attachHtmlEls = callArgs[0];
        expect($(attachHtmlEls).children()).to.have.lengthOf(2);
      });

      it('should still have all children attached', function() {
        collection.add([{ id: 4 }, { id: 5 }]);

        expect(myCollectionView.el.children).to.have.lengthOf(5);
      });
    });
  });

  describe('when only removing models from a collection', function() {
    let myCollectionView;
    let collection;
    let emptyView;

    beforeEach(function() {
      emptyView = View.extend({ template: _.template('empty') });

      collection = new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);

      myCollectionView = new MyCollectionView({ collection, emptyView });
      myCollectionView.render();
    });

    it('should still have the originally added children in the el', function() {
      collection.remove({ id: 1 });

      expect(myCollectionView.el.children).to.have.lengthOf(2);
    });

    it('does not move or rerender survivors without a comparator or filter', function() {
      myCollectionView.destroy();

      myCollectionView = new MyCollectionView({
        collection,
        emptyView,
        viewComparator: false
      });
      myCollectionView.render();

      const removedView = myCollectionView.children.findByModel(collection.at(1));
      const survivors = [
        myCollectionView.children.findByModel(collection.at(0)),
        myCollectionView.children.findByModel(collection.at(2))
      ];
      const survivorNodes = survivors.map(view => view.el);

      this.sinon.spy(removedView, 'destroy');
      this.sinon.spy(myCollectionView.Dom, 'moveEl');
      survivors.forEach(view => this.sinon.spy(view, 'render'));

      collection.remove(removedView.model);

      expect(myCollectionView.Dom.moveEl).to.not.have.been.called;
      survivors.forEach(view => expect(view.render).to.not.have.been.called);
      expect([...myCollectionView.el.children]).to.deep.equal(survivorNodes);
      expect(removedView.destroy).to.have.been.calledOnce;
    });

    it('reconciles multiple removals and keeps survivor indexes aligned', function() {
      myCollectionView.destroy();

      collection = new Backbone.Collection([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
      ]);
      myCollectionView = new MyCollectionView({
        collection,
        emptyView,
        viewComparator: false
      });
      myCollectionView.render();

      const survivors = [
        myCollectionView.children.findByModel(collection.get(1)),
        myCollectionView.children.findByModel(collection.get(3)),
        myCollectionView.children.findByModel(collection.get(5))
      ];
      const beforeRenderChildren = this.sinon.stub();
      const renderChildren = this.sinon.stub();
      myCollectionView.on({
        'before:render:children': beforeRenderChildren,
        'render:children': renderChildren
      });

      collection.remove([collection.get(2), collection.get(4)]);

      expect(beforeRenderChildren).to.have.been.calledOnce;
      expect(renderChildren).to.have.been.calledOnce;
      expect([...myCollectionView.children]).to.deep.equal(survivors);
      expect(myCollectionView.children.findByIndex(0)).to.equal(survivors[0]);
      expect(myCollectionView.children.findByIndex(1)).to.equal(survivors[1]);
      expect(myCollectionView.children.findByIndex(2)).to.equal(survivors[2]);
      expect([...myCollectionView.el.children])
        .to.deep.equal(survivors.map(view => view.el));
    });

    it('does not move survivors when collection sorting is disabled', function() {
      myCollectionView.destroy();

      myCollectionView = new MyCollectionView({
        collection,
        emptyView,
        sortWithCollection: false
      });
      myCollectionView.render();

      const survivorNodes = [
        myCollectionView.el.children[0],
        myCollectionView.el.children[2]
      ];
      this.sinon.spy(myCollectionView.Dom, 'moveEl');

      collection.remove(collection.at(1));

      expect(myCollectionView.Dom.moveEl).to.not.have.been.called;
      expect([...myCollectionView.el.children]).to.deep.equal(survivorNodes);
    });

    it('does not move survivors with the default collection order', function() {
      const survivorNodes = [
        myCollectionView.el.children[0],
        myCollectionView.el.children[2]
      ];
      const beforeSort = this.sinon.stub();
      const sort = this.sinon.stub();
      myCollectionView.on({
        'before:sort': beforeSort,
        sort
      });
      this.sinon.spy(myCollectionView.Dom, 'moveEl');

      collection.remove(collection.at(1));

      expect(myCollectionView.Dom.moveEl).to.not.have.been.called;
      expect(beforeSort).to.have.been.calledOnce;
      expect(sort).to.have.been.calledOnce;
      expect([...myCollectionView.el.children]).to.deep.equal(survivorNodes);
    });

    it('keeps default-order bookkeeping aligned for a later addition', function() {
      collection.remove(collection.at(1));
      collection.add({ id: 4 });

      const childViews = [...myCollectionView.children];
      expect(childViews.map(view => view.model)).to.deep.equal(collection.models);
      expect([...myCollectionView.el.children])
        .to.deep.equal(childViews.map(view => view.el));
    });

    it('keeps the render path when a custom comparator is active', function() {
      myCollectionView.destroy();

      myCollectionView = new MyCollectionView({
        collection,
        emptyView,
        viewComparator: 'id'
      });
      myCollectionView.render();

      const beforeRenderChildren = this.sinon.stub();
      const renderChildren = this.sinon.stub();
      myCollectionView.on({
        'before:render:children': beforeRenderChildren,
        'render:children': renderChildren
      });
      this.sinon.spy(myCollectionView, 'attachHtml');

      collection.remove(collection.at(1));

      expect(myCollectionView.attachHtml).to.have.been.calledOnce;
      expect(beforeRenderChildren).to.have.been.calledOnce;
      expect(renderChildren).to.have.been.calledOnce;
    });

    it('preserves survivors inside a childViewContainer', function() {
      myCollectionView.destroy();

      const ChildContainerView = MyCollectionView.extend({
        template: _.template('<div class="children"></div>'),
        childViewContainer: '.children'
      });
      myCollectionView = new ChildContainerView({
        collection,
        emptyView,
        viewComparator: false
      });
      myCollectionView.render();

      const survivorNodes = [
        myCollectionView.container.children[0],
        myCollectionView.container.children[2]
      ];

      collection.remove(collection.at(1));

      expect([...myCollectionView.container.children]).to.deep.equal(survivorNodes);
    });

    it('keeps the render path when a filter is active', function() {
      myCollectionView.destroy();

      myCollectionView = new MyCollectionView({
        collection,
        emptyView,
        viewComparator: false,
        viewFilter() { return true; }
      });
      myCollectionView.render();
      this.sinon.spy(myCollectionView, 'attachHtml');

      collection.remove(collection.at(1));

      expect(myCollectionView.attachHtml).to.have.been.calledOnce;
    });

    it('keeps the render path when the comparator query is overridden', function() {
      myCollectionView.destroy();

      const CustomCollectionView = MyCollectionView.extend({
        viewComparator: false,
        getComparator() { return false; }
      });
      myCollectionView = new CustomCollectionView({ collection, emptyView });
      myCollectionView.render();
      this.sinon.spy(myCollectionView, 'attachHtml');

      collection.remove(collection.at(1));

      expect(myCollectionView.attachHtml).to.have.been.calledOnce;
    });

    it('keeps the render path when the filter query is overridden', function() {
      myCollectionView.destroy();

      const CustomCollectionView = MyCollectionView.extend({
        viewComparator: false,
        getFilter() { return false; }
      });
      myCollectionView = new CustomCollectionView({ collection, emptyView });
      myCollectionView.render();
      this.sinon.spy(myCollectionView, 'attachHtml');

      collection.remove(collection.at(1));

      expect(myCollectionView.attachHtml).to.have.been.calledOnce;
    });

    it('keeps the render path when sort is overridden', function() {
      myCollectionView.destroy();

      const sort = this.sinon.spy(MyCollectionView.prototype, 'sort');
      const CustomCollectionView = MyCollectionView.extend({
        viewComparator: false,
        sort
      });
      myCollectionView = new CustomCollectionView({ collection, emptyView });
      myCollectionView.render();
      sort.resetHistory();

      collection.remove(collection.at(1));

      expect(sort).to.have.been.calledOnce;
    });

    it('keeps the render path when filter is overridden', function() {
      myCollectionView.destroy();

      const filter = this.sinon.spy(MyCollectionView.prototype, 'filter');
      const CustomCollectionView = MyCollectionView.extend({
        viewComparator: false,
        filter
      });
      myCollectionView = new CustomCollectionView({ collection, emptyView });
      myCollectionView.render();
      filter.resetHistory();

      collection.remove(collection.at(1));

      expect(filter).to.have.been.calledOnce;
    });

    it('shows the empty view after removing the last child', function() {
      myCollectionView.destroy();

      collection = new Backbone.Collection([{ id: 1 }]);
      myCollectionView = new MyCollectionView({
        collection,
        emptyView
      });
      myCollectionView.render();

      collection.remove(collection.at(0));

      expect(myCollectionView.children).to.have.lengthOf(0);
      expect(myCollectionView.getEmptyRegion().currentView)
        .to.be.instanceof(emptyView);
    });

    it('preserves 1,000 visible survivors without reattachment', function() {
      myCollectionView.destroy();

      collection = new Backbone.Collection(
        Array.from({ length: 1001 }, (value, id) => ({ id }))
      );
      myCollectionView = new MyCollectionView({
        collection,
        viewComparator: false
      });
      myCollectionView.render();

      const firstNode = myCollectionView.el.firstElementChild;
      const lastNode = myCollectionView.el.lastElementChild;
      this.sinon.spy(myCollectionView.Dom, 'moveEl');

      collection.remove(collection.at(500));

      expect(myCollectionView.Dom.moveEl).to.not.have.been.called;
      expect(myCollectionView.el.children).to.have.lengthOf(1000);
      expect(myCollectionView.el.firstElementChild).to.equal(firstNode);
      expect(myCollectionView.el.lastElementChild).to.equal(lastNode);
    });
  });

  describe('when removing a model that does not match a children view model', function() {
    let myCollectionView;
    let collection;

    beforeEach(function() {
      collection = new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const BuildCollectionView = MyCollectionView.extend({
        buildChildView(child, ChildViewClass) {
          return new ChildViewClass({ model: new Backbone.Model() });
        }
      });

      myCollectionView = new BuildCollectionView({ collection });
      myCollectionView.render();
    });

    it('should not throw an error', function() {
      expect(collection.remove({ id: 1 })).to.not.throw;
    });
  });
});
