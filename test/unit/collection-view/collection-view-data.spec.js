// Anything related to Bb.collection events

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/collection-view';
import View from '../../../src/view';

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
        expect($(attachHtmlEls).children()).to.have.lengthOf(5);
      });

      it('should append to the el', function() {
        this.sinon.stub(myCollectionView, 'attachHtml');
        collection.add([{ id: 4 }, { id: 5 }]);

        const callArgs = myCollectionView.attachHtml.args[0];
        const $el = callArgs[1];
        expect($el).to.equal(myCollectionView.$el);
      });

      it('should still have all children attached', function() {
        collection.add([{ id: 4 }, { id: 5 }]);

        expect(myCollectionView.$el.children()).to.have.lengthOf(5);
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

        expect(myCollectionView.$el.children()).to.have.lengthOf(5);
      });
    });
  });

  describe('when only removing models from a collection', function() {
    let myCollectionView;
    let collection;

    beforeEach(function() {
      const emptyView = View.extend({ template: _.template('empty') });

      collection = new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }]);

      myCollectionView = new MyCollectionView({ collection, emptyView });
      myCollectionView.render();
    });

    it('should still have the originally added children in the el', function() {
      collection.remove({ id: 1 });

      expect(myCollectionView.$el.children()).to.have.lengthOf(2);
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
