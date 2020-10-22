import { setEnabled } from '../../../src/backbone.marionette';
import CollectionView from '../../../src/collection-view';
import View from '../../../src/view';

describe('view mixin', function() {
  'use strict';

  describe('when creating a view', function() {
    let initializeStub;
    let view;

    beforeEach(function() {
      initializeStub = sinon.stub();

      const MyView = View.extend({
        initialize: initializeStub
      });

      view = new MyView();
    });

    it('should call initialize', function() {
      expect(initializeStub).to.have.been.calledOnce;
    });

    it('should set _behaviors', function() {
      expect(view._behaviors).to.be.eql([]);
    });
  });

  describe('when using listenTo for the "destroy" event on itself, and destroying the view', function() {
    let destroyStub;

    beforeEach(function() {
      destroyStub = sinon.stub();
      const view = new View();
      view.listenTo(view, 'destroy', destroyStub);
      view.destroy();
    });

    it('should trigger the "destroy" event', function() {
      expect(destroyStub).to.have.been.called;
    });
  });

  describe('when destroying a view', function() {
    let view;
    let onDestroyStub;
    let destroyStub;

    beforeEach(function() {
      view = new View();

      sinon.spy(view, '_removeElement');
      sinon.spy(view, '_deleteEntityEventHandlers');
      sinon.spy(view, 'destroy');

      onDestroyStub = sinon.stub();
      view.onDestroy = onDestroyStub;

      destroyStub = sinon.stub();
      view.on('destroy', destroyStub);

      view.destroy({foo: 'bar'});
    });

    it('should trigger the destroy event', function() {
      expect(destroyStub).to.have.been.calledOnce;
    });

    it('should call an onDestroy method with options argument passed to destroy', function() {
      expect(onDestroyStub)
        .to.have.been.calledOnce
        .and.calledWith(view, {foo: 'bar'});
    });

    it('should remove the view', function() {
      expect(view._removeElement).to.have.been.calledOnce;
    });

    it('should delete entity event handlers', function() {
      expect(view._deleteEntityEventHandlers).to.have.been.calledOnce;
    });

    it('should set the view _isDestroyed to true', function() {
      expect(view).to.be.have.property('_isDestroyed', true);
    });

    it('should return the View', function() {
      expect(view.destroy).to.have.returned(view);
    });

    describe('and it has already been destroyed', function() {
      beforeEach(function() {
        view.destroy();
      });

      it('should return the View', function() {
        expect(view.destroy).to.have.returned(view);
      });
    });

    describe('_isDestroyed property', function() {
      beforeEach(function() {
        view = new View();
      });

      it('should be set to false before destroy', function() {
        expect(view).to.be.have.property('_isDestroyed', false);
      });

      it('should be set to true after destroying', function() {
        view.destroy();
        expect(view).to.be.have.property('_isDestroyed', true);
      });
    });
  });

  describe('when destroying a view with listeners for destroy', function() {
    let view;
    let destroyStub;
    let beforeDestroyStub;
    let onDestroyStub;
    let onBeforeDestroyStub;

    beforeEach(function() {

      view = new View({
        template: () => '<div data-foo-region></div>',
        regions: {child: '[data-foo-region]'},
        onRender() {
          const childView = new View({ template: false });
          this.listenTo(childView, 'destroy', this.destroy);
          this.showChildView('child', childView);
        }
      });

      destroyStub = sinon.stub();
      view.on('destroy', destroyStub);

      beforeDestroyStub = sinon.stub();
      view.on('before:destroy', beforeDestroyStub);

      onDestroyStub = sinon.stub();
      view.onDestroy = onDestroyStub;

      onBeforeDestroyStub = sinon.stub();
      view.onBeforeDestroy = onBeforeDestroyStub;

      view.render();
      view.destroy();

    });
    it('should trigger the destroy event once', function() {
      expect(destroyStub).to.have.been.calledOnce;
      expect(onDestroyStub).to.have.been.calledOnce;
    });
    it('should trigger the before:destroy event once', function() {
      expect(beforeDestroyStub).to.have.been.calledOnce;
      expect(onBeforeDestroyStub).to.have.been.calledOnce;
    });
  });

  describe('constructing a view with default options', function() {
    let presets;
    let options;
    let MyView;
    let ViewPresets;
    let ViewPresetsFn;

    beforeEach(function() {
      presets = {foo: 'foo'};
      options = {foo: 'bar'};

      const presetsStub = sinon.stub().returns(presets);

      MyView = View.extend();
      ViewPresets = View.extend({options: presets});
      ViewPresetsFn = View.extend({options: presetsStub});
    });

    it('should take and store view options', function() {
      const view = new MyView(options);
      expect(view.options).to.deep.equal(options);
    });

    it('should have an empty hash of options by default', function() {
      const view = new MyView();
      expect(view.options).to.deep.equal({});
    });

    it('should retain options set on view class', function() {
      const view = new ViewPresets();
      expect(view.options).to.deep.equal(presets);
    });

    it('should retain options set on view class as a function', function() {
      const view = new ViewPresetsFn();
      expect(view.options).to.deep.equal(presets);
    });
  });

  // http://backbonejs.org/#View-constructor
  describe('should expose its options in the constructor', function() {
    let options;
    let view;

    beforeEach(function() {
      options = {foo: 'bar'};
      view = new View(options);
    });

    it('should be able to access instance options', function() {
      expect(view.options).to.deep.equal(options);
    });
  });

  describe('when destroying a view that is already destroyed', function() {
    let view;
    let removeSpy;
    let destroyStub;

    beforeEach(function() {
      view = new View();

      removeSpy = sinon.spy(view, '_removeElement');
      destroyStub = sinon.stub();
      view.on('destroy', destroyStub);

      view.destroy();
      view.destroy();
    });

    it('should not trigger the destroy event', function() {
      expect(destroyStub).to.have.been.calledOnce;
    });

    it('should not remove the view', function() {
      expect(removeSpy).to.have.been.calledOnce;
    });

    it('should leave _isDestroyed as true', function() {
      expect(view).to.be.have.property('_isDestroyed', true);
    });
  });

  describe('#delegateEvents', function() {
    describe('when passing events', function() {
      let events;
      let view;

      beforeEach(function() {
        const FooView = View.extend({
          events: {
            'click': 'onClick'
          },
          onClick: this.sinon.stub()
        });

        view = new FooView();

        events = {
          'click': this.sinon.stub()
        };

        view.delegateEvents(events);

        view.$el.trigger('click');
      });

      it('should delegate the passed events', function() {
        expect(events.click).to.have.been.calledOnce;
      });

      it('should not delegate instance events', function() {
        expect(view.onClick).to.not.have.been.called;
      });
    });
  });

  describe('when serializing a model', function() {
    const modelData = {foo: 'bar'};
    let view;

    beforeEach(function() {
      const model = new Backbone.Model(modelData);
      view = new View({
        model: model
      });
    });

    it('should return all attributes', function() {
      expect(view.serializeModel()).to.be.eql(modelData);
    });
  });

  describe('triggering events through a child view', function() {
    let onChildviewFooClickStub;
    let MyView;
    let MyCollectionView;
    let collection;
    let collectionView;
    let childView;

    beforeEach(function() {
      onChildviewFooClickStub = this.sinon.stub();

      MyView = View.extend({
        template: _.template('foo'),
        triggers: {'click': 'foo:click'}
      });

      MyCollectionView = CollectionView.extend({
        childView: MyView,
        childViewEventPrefix: 'childview',
        onChildviewFooClick: onChildviewFooClickStub
      });

      collection = new Backbone.Collection([{foo: 'bar'}]);
      collectionView = new MyCollectionView({
        collection: collection
      });

      collectionView.render();
      childView = collectionView.children.findByModel(collection.at(0));
      childView.$el.click();
    });

    it('should fire the event method once', function() {
      expect(onChildviewFooClickStub).to.have.been.calledOnce;
    });
  });

  describe('when proxying events to a parent layout', function() {
    let superView;
    let layoutView;
    let childView;
    let layoutEventHandler;
    let layoutEventOnHandler;
    let layoutViewOnBoomHandler;
    let superViewOnRattleHandler;
    let childEventsFunction;

    beforeEach(function() {
      const LayoutView = View.extend({
        template: _.template('<div class="child"></div>'),

        regions: {
          'child': '.child',
        },

        childViewEventPrefix: 'childview',

        childViewEvents: {
          'boom': 'onBoom'
        },

        onBoom: this.sinon.stub(),

        childViewTriggers: {
          'whack': 'rattle'
        }
      });

      const ChildView = View.extend({
        template: _.noop
      });

      const SuperView = View.extend({
        template: _.template('<div class="layout"></div>'),

        regions: {
          'layout': '.layout',
        },

        childViewEvents: {
          rattle: 'onRattle'
        },

        onRattle: this.sinon.stub()
      });

      superView = new SuperView();
      layoutView = new LayoutView();
      childView = new ChildView();
      layoutView.render();
      superView.render();

      layoutEventHandler = sinon.spy();
      layoutView.on('childview:boom', layoutEventHandler);

      layoutEventOnHandler = sinon.spy();
      layoutView.onChildviewBoom = layoutEventOnHandler;

      layoutViewOnBoomHandler = layoutView.onBoom;

      superViewOnRattleHandler = superView.onRattle;

      childEventsFunction = (function() {
        return {
          'boom': layoutViewOnBoomHandler
        };
      }).bind(this);
    });

    describe('when there is not a containing layout', function() {
      beforeEach(function() {
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('does not emit the event on the layout', function() {
        expect(layoutEventHandler).not.to.have.been.called;
      });
    });

    describe('when there is a containing layout', function() {
      beforeEach(function() {
        layoutView.showChildView('child', childView);
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('emits the event on the layout', function() {
        expect(layoutEventHandler)
          .to.have.been.calledWith('foo', 'bar')
          .and.to.have.been.calledOn(layoutView)
          .and.calledOnce;
      });

      it('invokes the layout on handler', function() {
        expect(layoutEventOnHandler)
          .to.have.been.calledWith('foo', 'bar')
          .and.to.have.been.calledOn(layoutView)
          .and.calledOnce;
      });

      it('invokes the layout childViewEvents handler', function() {
        expect(layoutViewOnBoomHandler)
          .to.have.been.calledWith('foo', 'bar')
          .and.to.have.been.calledOn(layoutView)
          .and.calledOnce;
      });
    });

    describe('when childViewEvents was passed as a function', function() {
      beforeEach(function() {
        // use the function definition of childViewEvents instead of the hash
        layoutView.childViewEvents = childEventsFunction;
        layoutView.delegateEvents();
        layoutView.showChildView('child', childView);
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('invokes the layout childViewEvents handler', function() {
        expect(layoutViewOnBoomHandler)
          .to.have.been.calledWith('foo', 'bar')
          .and.to.have.been.calledOn(layoutView)
          .and.calledOnce;
      });
    });

    describe('using childViewTriggers', function() {
      beforeEach(function() {
        superView.showChildView('layout', layoutView);
        layoutView.showChildView('child', childView);
        childView.triggerMethod('whack', 'foo', 'bar');
      });

      it('invokes the super trigger handler', function() {
        expect(superViewOnRattleHandler)
          .to.have.been.calledWith('foo', 'bar')
          .to.have.been.calledOn(superView)
          .and.calledOnce;
      });
    });

    describe('when childViewEventPrefix is false', function() {
      beforeEach(function() {
        layoutView.showChildView('child', childView);
        layoutView.childViewEventPrefix = false;
        layoutView.delegateEvents();
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('should not emit the event on the layout', function() {
        expect(layoutEventHandler).not.to.have.been.called;
      });
    });

    describe('when childViewEventPrefix flag is false', function() {
      let myView;

      beforeEach(function() {
        setEnabled('childViewEventPrefix', false);
        myView = new View();
      });

      afterEach(function() {
        setEnabled('childViewEventPrefix', true);
      });

      it('should set childViewEventPrefix to false', function() {
        expect(myView._eventPrefix).to.be.false;
      });
    });

    describe('when childViewEventPrefix flag is true', function() {
      let myView;

      beforeEach(function() {
        setEnabled('childViewEventPrefix', true);
        myView = new View();
      });

      afterEach(function() {
        setEnabled('childViewEventPrefix', false);
      });

      it('should set childViewEventPrefix to "childview"', function() {
        expect(myView._eventPrefix).to.equal('childview:');
      });
    });

    describe('return values of wrapped methods', function() {
      let fooView;

      beforeEach(function() {
        fooView = new Marionette.View();
      });

      it('destroy should return the view', function() {
        this.sinon.spy(fooView, 'destroy');
        fooView.destroy();

        expect(fooView.destroy).to.have.returned(fooView);
      });

      it('setElement should return the view', function() {
        this.sinon.spy(fooView, 'setElement');
        fooView.setElement(fooView.$el);

        expect(fooView.setElement).to.have.returned(fooView);
      });

      it('delegateEvents should return the view', function() {
        this.sinon.spy(fooView, 'delegateEvents');
        fooView.delegateEvents();

        expect(fooView.delegateEvents).to.have.returned(fooView);
      });

      it('undelegateEvents should return the view', function() {
        this.sinon.spy(fooView, 'undelegateEvents');
        fooView.undelegateEvents({});

        expect(fooView.undelegateEvents).to.have.returned(fooView);
      });

      it('delegateEntityEvents should return the view', function() {
        this.sinon.spy(fooView, 'delegateEntityEvents');
        fooView.delegateEntityEvents();

        expect(fooView.delegateEntityEvents).to.have.returned(fooView);
      });

      it('undelegateEntityEvents should return the view', function() {
        this.sinon.spy(fooView, 'undelegateEntityEvents');
        fooView.undelegateEntityEvents({});

        expect(fooView.undelegateEntityEvents).to.have.returned(fooView);
      });
    });
  });
});
