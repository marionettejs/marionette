// Life-cycle and base functions

import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/collection-view';
import View from '../../../src/view';
import Events from '../../../src/mixins/events';

describe('CollectionView', function() {
  let MyChildView;
  let MyBbChildView;

  beforeEach(function() {
    MyChildView = View.extend({
      template: _.noop,
      onBeforeRender: this.sinon.stub(),
      onRender: this.sinon.stub(),
      onBeforeDestroy: this.sinon.stub(),
      onDestroy: this.sinon.stub(),
    });

    MyBbChildView = Backbone.View.extend({
      onBeforeRender: this.sinon.stub(),
      onRender: this.sinon.stub(),
      onBeforeDestroy: this.sinon.stub(),
      onDestroy: this.sinon.stub(),
    });
    _.extend(MyBbChildView.prototype, Events);
  });

  describe('#constructor', function() {
    let MyCollectionView;

    beforeEach(function() {
      MyCollectionView = CollectionView.extend({
        childView: MyChildView
      });
    });

    describe('when passing in options', function() {
      let collectionView;

      const mergeOptions = {
        behaviors: {},
        childView: {},
        childViewContainer: {},
        childViewEventPrefix: 'child',
        childViewEvents: {},
        childViewOptions: {},
        childViewTriggers: {},
        collectionEvents: {},
        emptyView: {},
        emptyViewOptions: {},
        modelEvents: {},
        sortWithCollection: {},
        template: {},
        templateContext: {},
        triggers: {},
        ui: {},
        viewComparator: {},
        viewFilter: {}
      };

      beforeEach(function() {
        collectionView = new MyCollectionView(mergeOptions);
      });

      // NOTE: `events` is purposefully left out as it is handled by
      // backbone.js and is mutated on instantiation
      _.each(mergeOptions, function(value, key) {
        it(`should merge option ${ key }`, function() {
          expect(collectionView[key]).to.equal(value);
        });
      });

      // _setOptions
      it('should attach options to the collectionView', function() {
        expect(collectionView.options).to.deep.equal(mergeOptions);
      });
    });

    it('should setup the lifecycle monitor before initialize', function() {
      this.sinon.stub(MyCollectionView.prototype, 'initialize').callsFake(function() {
        expect(this._areViewEventsMonitored).to.be.true;
      });

      new MyCollectionView();
    });

    it('should have a valid inheritance chain back to Backbone.View', function() {
      const options = {foo: 'bar'};
      const customParam = {foo: 'baz'};

      const TestView = MyCollectionView.extend({
        initialize: this.sinon.stub()
      })

      const testView = new TestView(options, customParam);

      expect(testView.initialize).to.have.been.calledOnce.and.calledWith(options, customParam);
    });

    it('should call initialize prior to delegateEntityEvents', function() {
      this.sinon.stub(MyCollectionView.prototype, 'initialize');
      this.sinon.stub(MyCollectionView.prototype, 'delegateEntityEvents');

      const myCollectionView = new MyCollectionView();

      expect(myCollectionView.initialize).to.be.calledBefore(myCollectionView.delegateEntityEvents);
    });

    it('should trigger `initialize` on the behaviors', function() {
      this.sinon.stub(MyCollectionView.prototype, '_triggerEventOnBehaviors');

      const myCollectionView = new MyCollectionView({ foo: 'bar' });

      // _triggerEventOnBehaviors comes from Behaviors mixin
      expect(myCollectionView._triggerEventOnBehaviors)
        .to.be.calledOnce.and.calledWith('initialize', myCollectionView, { foo: 'bar' });
    });
  });

  describe('#childView', function() {
    const collection = new Backbone.Collection([{ id: 1 }]);
    const model = collection.get(1);

    beforeEach(function() {
      this.sinon.spy(CollectionView.prototype, 'buildChildView');
    });

    describe('when childView is falsey', function() {
      it('should throw NoChildViewError', function() {
        const myCollectionView = new CollectionView({ collection });

        expect(myCollectionView.render.bind(myCollectionView)).to.throw('A "childView" must be specified');
      });
    });

    describe('when childView is a type of Backbone.View', function() {
      it('should build children from the defined view', function() {
        const MyView = View.extend({ template: _.noop });
        const myCollectionView = new CollectionView({
          collection,
          childView: MyView
        });
        myCollectionView.render();

        expect(myCollectionView.buildChildView).to.be.calledWith(model, MyView);
      });
    });

    describe('when childView is a Backbone.View', function() {
      it('should build children from the defined view', function() {
        let BBView = Backbone.View.extend();
        _.extend(BBView.prototype, Events);
        const myCollectionView = new CollectionView({
          collection,
          childView: BBView
        });
        myCollectionView.render();

        expect(myCollectionView.buildChildView).to.be.calledWith(model, BBView);
      });
    });

    describe('when childView is a function returning a view', function() {
      let myCollectionView;
      let childViewStub;
      let BBView = Backbone.View.extend();
      _.extend(BBView.prototype, Events);
      beforeEach(function() {
        childViewStub = this.sinon.stub();
        childViewStub.returns(BBView);

        myCollectionView = new CollectionView({
          collection,
          childView: childViewStub
        });
        myCollectionView.render();
      });

      it('should build children from the returned view', function() {
        expect(myCollectionView.buildChildView).to.be.calledWith(model, BBView);
      });

      it('should call childView with the model', function() {
        expect(childViewStub)
          .to.have.been.calledOnce
          .and.calledWith(model);
      });
    });

    describe('when childView is not a valid view', function() {
      it('should throw InvalidChildViewError', function() {
        const myCollectionView = new CollectionView({
          collection,
          childView: 'foo'
        });

        expect(myCollectionView.render.bind(myCollectionView)).to.throw('"childView" must be a view class or a function that returns a view class');
      });
    });
  });

  describe('#childViewOptions', function() {
    describe('when childViewOptions is a function', function() {
      const collection = new Backbone.Collection([{ id: 1 }]);
      const model = collection.get(1);
      const childViewOptions = {};

      let myCollectionView;
      let childViewOptionsStub;
      let childView;

      beforeEach(function() {
        childView = MyBbChildView;

        childViewOptionsStub = this.sinon.stub();
        childViewOptionsStub.returns(childViewOptions);
        this.sinon.spy(CollectionView.prototype, 'buildChildView');

        myCollectionView = new CollectionView({
          collection,
          childView,
          childViewOptions: childViewOptionsStub
        });

        myCollectionView.render();
      });

      it('should call buildChildView with childViewOptions results', function() {
        expect(myCollectionView.buildChildView).to.be.calledWith(model, childView, childViewOptions);
      });

      it('should call childViewOptions with child model', function() {
        expect(childViewOptionsStub)
          .to.have.been.calledOnce
          .and.calledWith(model);
      });
    });
  });

  describe('#buildChildView', function() {
    it('should call buildChildView with arguments', function() {
      const collection = new Backbone.Collection([{ id: 1 }]);
      const model = collection.get(1);
      const childView = MyBbChildView;
      const childViewOptions = {};

      this.sinon.spy(CollectionView.prototype, 'buildChildView');

      const myCollectionView = new CollectionView({
        collection,
        childView,
        childViewOptions
      });

      myCollectionView.render();
      expect(myCollectionView.buildChildView).to.be.calledWith(model, childView, childViewOptions);
    });
  });

  describe('#setElement', function() {

    it('should call Backbone.View.setElement with all arguments', function() {
      const myCollectionView = new CollectionView();
      const bBSetElement = this.sinon.spy(Backbone.View.prototype, 'setElement');

      myCollectionView.setElement('#foo',2,3,4);

      expect(bBSetElement).to.be.calledWith('#foo',2,3,4);
    });

    it('should return the collectionView instance', function() {
      const myCollectionView = new CollectionView();
      this.sinon.spy(myCollectionView, 'setElement');

      myCollectionView.setElement();

      expect(myCollectionView.setElement).to.have.returned(myCollectionView);
    });


    describe('when the view does not have an attach el', function() {
      it('should not mark the view as attached', function() {
        const myCollectionView = new CollectionView({ el: $('<div>') });

        expect(myCollectionView.isAttached()).to.be.false;
      });
    });

    describe('when the view is given an attach el', function() {
      it('should mark the view as attached', function() {
        this.setFixtures('<div id="attached"></div>');
        const myCollectionView = new CollectionView({ el: $('#attached') });

        expect(myCollectionView.isAttached()).to.be.true;
      });
    });
  });

  describe('#render', function() {
    let myCollectionView;

    beforeEach(function() {
      const MyCollectionView = CollectionView.extend({
        onBeforeRender: this.sinon.stub(),
        onRender: this.sinon.stub(),
      });

      myCollectionView = new MyCollectionView();
      this.sinon.spy(myCollectionView, 'render');
    });

    describe('when the view is not destroyed', function() {
      beforeEach(function() {
        myCollectionView.render();
      });

      it('should set isRendered to true', function() {
        expect(myCollectionView.isRendered()).to.be.true;
      });

      it('should call "before:render" event', function() {
        expect(myCollectionView.onBeforeRender)
          .to.have.been.calledOnce
          .and.calledWith(myCollectionView);
      });

      it('should call "render" event', function() {
        expect(myCollectionView.onRender)
          .to.have.been.calledOnce
          .and.calledWith(myCollectionView);
      });

      it('should return the collectionView instance', function() {
        expect(myCollectionView.render).to.have.returned(myCollectionView);
      });

    });

    describe('when the view is destroyed', function() {
      beforeEach(function() {
        myCollectionView.destroy();
        myCollectionView.render();
      });

      it('should not call "before:render" event', function() {
        expect(myCollectionView.onBeforeRender).to.not.have.been.called;
      });

      it('should not call "render" event', function() {
        expect(myCollectionView.onRender).to.not.have.been.called;
      });

      it('should return the collectionView instance', function() {
        expect(myCollectionView.render).to.have.returned(myCollectionView);
      });
    });
  });
});
