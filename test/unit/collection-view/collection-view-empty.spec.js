// Anything related to emptyView

import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/collection-view';
import View from '../../../src/view';
import Region from '../../../src/region';
import Events from '../../../src/mixins/events';

describe('CollectionView -  Empty', function() {
  let MyEmptyView;
  let MyCollectionView;

  beforeEach(function() {
    const MyChildView = View.extend({
      template: _.noop
    });

    MyEmptyView = View.extend({
      template: _.template('Empty')
    });

    MyCollectionView = CollectionView.extend({
      childView: MyChildView,
      emptyView: MyEmptyView
    });
  });

  describe('when instantiating a CollectionView', function() {
    let myCollectionView;

    beforeEach(function() {
      this.sinon.spy(MyCollectionView.prototype, 'getEmptyRegion');
      myCollectionView = new MyCollectionView();
    });

    it('should be replaceElement: false', function() {
      Region.prototype.replaceElement = true;
      expect(myCollectionView.getEmptyRegion().replaceElement).to.be.false;
      Region.prototype.replaceElement = false;
    });

    it('should instantiate the emptyRegion', function() {
      expect(myCollectionView.getEmptyRegion).to.have.been.calledOnce;
    });

    describe('when destroying the collectionView', function() {
      it('should destroy the region', function() {
        const emptyRegion = myCollectionView.getEmptyRegion();
        myCollectionView.destroy();
        expect(emptyRegion.isDestroyed()).to.be.true;
      });
    });
  });

  describe('when rendering an empty collectionview during instantiation', function() {
    it('should show the view in the emptyRegion', function() {
      const collection = new Backbone.Collection();

      const MyInitCollectionView = MyCollectionView.extend({
        initialize() {
          this.render();
        }
      });

      const myCollectionView = new MyInitCollectionView({ collection });

      expect(myCollectionView.getEmptyRegion().hasView()).to.be.true;
    });
  });

  describe('when an emptyView is rendered', function() {
    let emptyViewRenderStub;
    let myCollectionView;

    beforeEach(function() {
      const collection = new Backbone.Collection();

      emptyViewRenderStub = this.sinon.stub();

      myCollectionView = new MyCollectionView({
        collection,
        childViewEvents: {
          'render': emptyViewRenderStub
        }
      });

      myCollectionView.render();
    });

    it('should trigger child events on the collectionView', function() {
      expect(emptyViewRenderStub).to.have.been.calledOnce;
    });

    describe('when the collection is no longer empty', function() {
      it('should empty the emptyRegion', function() {
        const emptyRegionEmptyStub = this.sinon.stub();
        myCollectionView.getEmptyRegion().on('empty', emptyRegionEmptyStub);
        myCollectionView.collection.add({ id: 1 });
        expect(emptyRegionEmptyStub).to.have.been.calledOnce;
      });
    });
  });

  describe('when rendering in a template', function() {
    it('should show the emptyView inside the childViewContainer', function() {
      const TemplatedCollectionView = MyCollectionView.extend({
        childViewContainer: '#region',
        template: _.template('<div id="region"></div>')
      });

      const cv = new TemplatedCollectionView({
        collection: new Backbone.Collection()
      });

      cv.render();

      expect(cv.$('#region')).to.contain.$text('Empty');
    });
  });

  describe('#getEmptyRegion', function() {
    let collection;
    let myCollectionView;

    beforeEach(function() {
      collection = new Backbone.Collection();
      myCollectionView = new MyCollectionView({ collection });
    });

    it('should return the empty region for the collectionView el', function() {
      expect(myCollectionView.getEmptyRegion().el).to.equal(myCollectionView.el);
    });

    it('should return the same region on subsequent calls', function() {
      const emptyRegion = myCollectionView.getEmptyRegion();

      expect(myCollectionView.getEmptyRegion()).to.equal(emptyRegion);
    });

    // Internal implementation detail, but needs to be tested
    it('should set the parentView', function() {
      expect(myCollectionView.getEmptyRegion()._parentView).to.equal(myCollectionView);
    });

    it('should return a new emptyRegion instance if the current is destroyed', function() {
      const emptyRegion = myCollectionView.getEmptyRegion();
      emptyRegion.destroy();

      expect(myCollectionView.getEmptyRegion()).to.not.equal(emptyRegion);
      expect(myCollectionView.getEmptyRegion().el).to.equal(myCollectionView.el);
    });
  });

  describe('#emptyView', function() {
    const collection = new Backbone.Collection();
    const BBView = Backbone.View.extend();
    _.extend(BBView.prototype, Events);

    describe('when emptyView is falsey', function() {
      it('should not show an emptyView', function() {
        const myCollectionView = new CollectionView({
          collection,
          emptyView: false
        });

        this.sinon.spy(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show).to.not.have.been.called;
      });
    });

    describe('when emptyView is a type of Backbone.View', function() {
      it('should show an emptyView from the defined view', function() {
        const MyView = View.extend({ template: _.noop });
        const myCollectionView = new CollectionView({
          collection,
          emptyView: MyView
        });

        this.sinon.spy(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show)
          .to.be.calledOnce
          .and.calledWith(sinon.match.instanceOf(MyView));
      });
    });

    describe('when emptyView is a Backbone.View', function() {
      it('should show an emptyView from the defined view', function() {
        const myCollectionView = new CollectionView({
          collection,
          emptyView: BBView
        });

        this.sinon.spy(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show)
          .to.be.calledOnce
          .and.calledWith(sinon.match.instanceOf(BBView));
      });
    });

    describe('when emptyView is a function returning a view', function() {
      it('should show an emptyView from the returned view', function() {
        const emptyViewStub = this.sinon.stub();
        emptyViewStub.returns(BBView);

        const myCollectionView = new CollectionView({
          collection,
          emptyView: emptyViewStub
        });

        this.sinon.spy(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show)
          .to.be.calledOnce
          .and.calledWith(sinon.match.instanceOf(BBView));
      });
    });

    describe('when emptyView is not a valid view', function() {
      it('should not show an emptyView', function() {
        const myCollectionView = new CollectionView({
          collection,
          emptyView: 'foo'
        });

        this.sinon.spy(myCollectionView.getEmptyRegion(), 'show');
        myCollectionView.render();

        expect(myCollectionView.getEmptyRegion().show).to.not.have.been.called;
      });
    });
  });

  describe('#emptyViewOptions', function() {
    describe('when emptyViewOptions is a function', function() {
      const collection = new Backbone.Collection();
      const MyView = View.extend({ template: _.noop });
      const emptyViewOptions = { foo: 'bar' };

      let myCollectionView;
      let emptyViewOptionsStub;

      beforeEach(function() {
        emptyViewOptionsStub = this.sinon.stub();
        emptyViewOptionsStub.returns(emptyViewOptions);

        myCollectionView = new CollectionView({
          collection,
          emptyView: MyView,
          emptyViewOptions: emptyViewOptionsStub
        });

        myCollectionView.render();
      });

      it('should show an emptyView with the emptyViewOptions', function() {
        const emptyView = myCollectionView.getEmptyRegion().currentView;
        expect(emptyView.options).to.deep.equal(emptyViewOptions);
      });

      it('should call childViewOptions', function() {
        expect(emptyViewOptionsStub).to.have.been.calledOnce;
      });
    });

    describe('when emptyViewOptions is undefined', function() {
      const collection = new Backbone.Collection();
      const MyView = View.extend({ template: _.noop });
      const childViewOptions = { foo: 'bar' };

      let myCollectionView;
      let childViewOptionsStub;

      beforeEach(function() {
        childViewOptionsStub = this.sinon.stub();
        childViewOptionsStub.returns(childViewOptions);

        myCollectionView = new CollectionView({
          collection,
          emptyView: MyView,
          childViewOptions: childViewOptionsStub
        });

        myCollectionView.render();
      });

      it('should show an emptyView with the emptyViewOptions', function() {
        const emptyView = myCollectionView.getEmptyRegion().currentView;
        expect(emptyView.options).to.deep.equal(childViewOptions);
      });

      it('should call childViewOptions', function() {
        expect(childViewOptionsStub).to.have.been.calledOnce;
      });
    });
  });

  describe('#isEmpty', function() {
    describe('when rendering a collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
        myCollectionView = new MyCollectionView({ collection });
        this.sinon.spy(myCollectionView, 'isEmpty');
        myCollectionView.render();
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).to.be.calledOnce;
      });

      it('should not show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).to.be.false;
      });

      describe('when removing one child', function() {
        beforeEach(function() {
          myCollectionView.isEmpty.resetHistory();
          myCollectionView.removeChildView(myCollectionView.children.first());
        });

        it('should call isEmpty', function() {
          expect(myCollectionView.isEmpty).to.be.calledOnce;
        });

        it('should not show the emptyView', function() {
          expect(myCollectionView.getEmptyRegion().hasView()).to.be.false;
        });
      });

      describe('when removing the only child', function() {
        beforeEach(function() {
          myCollectionView.removeChildView(myCollectionView.children.first());
          myCollectionView.isEmpty.resetHistory();
          myCollectionView.removeChildView(myCollectionView.children.first());
        });

        it('should call isEmpty', function() {
          expect(myCollectionView.isEmpty).to.be.calledOnce;
        });

        it('should show the emptyView', function() {
          expect(myCollectionView.getEmptyRegion().hasView()).to.be.true;
        });
      });
    });

    describe('when rendering an empty collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection();
        myCollectionView = new MyCollectionView({ collection });
        this.sinon.spy(myCollectionView, 'isEmpty');
        myCollectionView.render();
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).to.be.calledOnce;
      });

      it('should show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).to.be.true;
      });
    });

    describe('when filtering some views from a collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection([{ id: 1 }, { id: 2 }]);
        myCollectionView = new MyCollectionView({ collection });
        myCollectionView.render();
        this.sinon.spy(myCollectionView, 'isEmpty');
        myCollectionView.setFilter(view => {
          return view.model.id === 1;
        });
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).to.be.calledOnce;
      });

      it('should not show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).to.be.false;
      });
    });

    describe('when filtering all views from a collectionView', function() {
      let myCollectionView;

      beforeEach(function() {
        const collection = new Backbone.Collection([{ id: 1 }]);
        myCollectionView = new MyCollectionView({ collection });
        myCollectionView.render();
        this.sinon.spy(myCollectionView, 'isEmpty');
        myCollectionView.setFilter(_.constant(false));
      });

      it('should call isEmpty', function() {
        expect(myCollectionView.isEmpty).to.be.calledOnce;
      });

      it('should show the emptyView', function() {
        expect(myCollectionView.getEmptyRegion().hasView()).to.be.true;
      });
    });
  });
});
