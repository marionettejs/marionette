import Backbone from 'backbone';
import Behavior from '../../../src/modules/behavior';
import CollectionView from '../../../src/modules/collection-view';
import Region from '../../../src/modules/region';
import View from '../../../src/modules/view';

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

  describe('when construction fails after rendering', function() {
    it('rolls back CollectionView children, DOM, observer, and empty Region', function() {
      const constructionError = new Error('construction failed');
      const observerCleanup = this.sinon.spy();
      const regionDestroy = this.sinon.spy(Region.prototype, 'destroy');
      const children = [];
      const rollbackStates = [];
      const ChildView = View.extend({
        template: () => 'child',
        initialize() {
          children.push(this);
        },
        destroy() {
          rollbackStates.push(observerCleanup.calledOnce);
          return View.prototype.destroy.call(this);
        }
      });
      const TestView = CollectionView.extend({
        childView: ChildView,
        initialize() {
          this.render();
          throw constructionError;
        }
      });
      TestView.setDataApi({
        observeCollection() {
          return observerCleanup;
        }
      });
      const rootEl = document.createElement('div');

      expect(() => new TestView({
        collection: new Backbone.Collection([{}, {}]),
        el: rootEl
      })).to.throw(constructionError);

      expect(children).to.have.lengthOf(2);
      expect(children.every(child => child.isDestroyed())).to.be.true;
      expect(rootEl).to.have.property('textContent', '');
      expect(observerCleanup).to.have.been.calledOnce;
      expect(regionDestroy).to.have.been.calledOnce;
      expect(rollbackStates).to.deep.equal([true, true]);
    });

    it('continues rollback and preserves construction failure when observer cleanup throws', function() {
      const constructionError = new Error('construction failed');
      const cleanupError = new Error('cleanup failed');
      const observerCleanup = this.sinon.stub().throws(cleanupError);
      const stopListening = this.sinon.spy(CollectionView.prototype, 'stopListening');
      let child;
      const ChildView = View.extend({
        template: () => 'child',
        initialize() {
          child = this;
        }
      });
      const TestView = CollectionView.extend({
        childView: ChildView,
        initialize() {
          this.render();
          throw constructionError;
        }
      });
      TestView.setDataApi({
        observeCollection() {
          return observerCleanup;
        }
      });

      expect(() => new TestView({ collection: new Backbone.Collection([{}]) }))
        .to.throw(constructionError);

      expect(child.isDestroyed()).to.be.true;
      expect(observerCleanup).to.have.been.calledOnce;
      expect(stopListening).to.have.been.called;
    });

    it('attempts every CollectionView child while preserving the construction error', function() {
      const constructionError = new Error('construction failed');
      const teardown = [];
      let failedView;
      let children;
      let emptyRegion;
      const ChildView = View.extend({
        template: false,
        destroy() {
          const id = this.model.id;
          teardown.push(id);
          View.prototype.destroy.call(this);
          if (id === 1) { throw new Error('child destroy failed'); }
          return this;
        }
      });
      const TestView = CollectionView.extend({
        childView: ChildView,
        initialize() {
          failedView = this;
          this.render();
          children = this.children.toArray();
          emptyRegion = this.getEmptyRegion();
          throw constructionError;
        }
      });

      expect(() => new TestView({
        collection: new Backbone.Collection([{ id: 1 }, { id: 2 }, { id: 3 }])
      })).to.throw(constructionError);

      expect(teardown).to.deep.equal([1, 2, 3]);
      expect(children.every(child => child.isDestroyed())).to.be.true;
      expect(failedView.children).to.have.lengthOf(0);
      expect(emptyRegion.isDestroyed()).to.be.true;
    });

    it('destroys a View Region child created before construction fails', function() {
      const constructionError = new Error('construction failed');
      const rootEl = document.createElement('div');
      const child = new View({ template: () => 'child' });
      const TestView = View.extend({
        regions: { content: '.content' },
        template: () => '<div class="content"></div>',
        initialize() {
          this.render();
          this.showChildView('content', child);
          throw constructionError;
        }
      });

      expect(() => new TestView({ el: rootEl })).to.throw(constructionError);

      expect(child.isDestroyed()).to.be.true;
      expect(rootEl.querySelector('.content')).to.have.property('textContent', '');
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

  describe('when delegating entity events after destruction starts', function() {
    function buildHost(context, ViewClass, onBeforeDestroy) {
      const stubs = {
        behaviorCollectionHandler: context.sinon.stub(),
        behaviorCollectionEvents: context.sinon.stub(),
        behaviorModelHandler: context.sinon.stub(),
        behaviorModelEvents: context.sinon.stub(),
        hostCollectionHandler: context.sinon.stub(),
        hostCollectionEvents: context.sinon.stub(),
        hostModelHandler: context.sinon.stub(),
        hostModelEvents: context.sinon.stub()
      };
      stubs.behaviorCollectionEvents.returns({ update: stubs.behaviorCollectionHandler });
      stubs.behaviorModelEvents.returns({ change: stubs.behaviorModelHandler });
      stubs.hostCollectionEvents.returns({ update: stubs.hostCollectionHandler });
      stubs.hostModelEvents.returns({ change: stubs.hostModelHandler });

      const EntityBehavior = Behavior.extend({
        collectionEvents: stubs.behaviorCollectionEvents,
        modelEvents: stubs.behaviorModelEvents
      });
      const TestView = ViewClass.extend({
        behaviors: [EntityBehavior],
        collectionEvents: stubs.hostCollectionEvents,
        modelEvents: stubs.hostModelEvents,
        onBeforeDestroy
      });
      const collection = new Backbone.Collection();
      const model = new Backbone.Model();
      const view = new TestView({ collection, model });

      Object.values(stubs).forEach(stub => stub.resetHistory());

      return { collection, model, stubs, view };
    }

    function expectResolversNotCalled(stubs) {
      expect(stubs.behaviorCollectionEvents).not.to.have.been.called;
      expect(stubs.behaviorModelEvents).not.to.have.been.called;
      expect(stubs.hostCollectionEvents).not.to.have.been.called;
      expect(stubs.hostModelEvents).not.to.have.been.called;
    }

    [
      ['View', View],
      ['CollectionView', CollectionView]
    ].forEach(([name, ViewClass]) => {
      it(`should not evaluate or bind ${ name } entity events while destroying`, function() {
        let result;
        const { collection, model, stubs, view } = buildHost(this, ViewClass, function() {
          result = this.delegateEntityEvents();
          model.trigger('change');
          collection.trigger('update');
        });

        view.destroy();

        expect(result).to.equal(view);
        expect(stubs.hostModelHandler).to.have.been.calledOnce;
        expect(stubs.hostCollectionHandler).to.have.been.calledOnce;
        expect(stubs.behaviorModelHandler).to.have.been.calledOnce;
        expect(stubs.behaviorCollectionHandler).to.have.been.calledOnce;
        expectResolversNotCalled(stubs);
      });

      it(`should not evaluate or bind ${ name } entity events after destruction`, function() {
        const { collection, model, stubs, view } = buildHost(this, ViewClass);
        view.destroy();
        const result = view.delegateEntityEvents();

        model.trigger('change');
        collection.trigger('update');

        expect(result).to.equal(view);
        expectResolversNotCalled(stubs);
        expect(stubs.hostModelHandler).not.to.have.been.called;
        expect(stubs.hostCollectionHandler).not.to.have.been.called;
        expect(stubs.behaviorModelHandler).not.to.have.been.called;
        expect(stubs.behaviorCollectionHandler).not.to.have.been.called;
      });
    });
  });

  describe('when delegating entity events fails', function() {
    it('rolls back host subscriptions when a Behavior subscription fails', function() {
      const error = new Error('behavior subscribe failed');
      const cleanup = this.sinon.spy();
      let subscriptionCount = 0;
      const EntityBehavior = Behavior.extend({ modelEvents: { change: 'onChange' }, onChange() {} });
      const TestView = View.extend({
        behaviors: [EntityBehavior],
        modelEvents: { change: 'onChange' },
        onChange() {}
      });
      TestView.setDataApi({
        subscribe() {
          subscriptionCount++;
          if (subscriptionCount === 2) { throw error; }
          return cleanup;
        }
      });

      expect(() => new TestView({ model: {} })).to.throw(error);
      expect(cleanup).to.have.been.calledOnce;
    });

    it('rolls back subscriptions when Behavior initialization fails', function() {
      const error = new Error('behavior initialize failed');
      const cleanups = [this.sinon.spy(), this.sinon.spy()];
      let subscriptionCount = 0;
      const EntityBehavior = Behavior.extend({
        modelEvents: { change: 'onChange' },
        onChange() {},
        onInitialize() {
          throw error;
        }
      });
      const TestView = View.extend({
        behaviors: [EntityBehavior],
        modelEvents: { change: 'onChange' },
        onChange() {}
      });
      TestView.setDataApi({
        subscribe() {
          return cleanups[subscriptionCount++];
        }
      });

      expect(() => new TestView({ model: {} })).to.throw(error);
      expect(cleanups[0]).to.have.been.calledOnce;
      expect(cleanups[1]).to.have.been.calledOnce;
    });
  });

  describe('when data teardown fails', function() {
    it('attempts all Behavior, host, and observer cleanup before rethrowing', function() {
      const error = new Error('behavior dispose failed');
      const hostCleanup = this.sinon.spy();
      const behaviorCleanup = this.sinon.stub().throws(error);
      const laterBehaviorCleanup = this.sinon.spy();
      const observerCleanup = this.sinon.spy();
      const stopListening = this.sinon.spy(CollectionView.prototype, 'stopListening');
      const cleanups = [
        hostCleanup,
        behaviorCleanup,
        laterBehaviorCleanup
      ];
      let subscriptionCount = 0;
      const EntityBehavior = Behavior.extend({ modelEvents: { change: 'onChange' }, onChange() {} });
      const TestView = CollectionView.extend({
        behaviors: [EntityBehavior, EntityBehavior],
        modelEvents: { change: 'onChange' },
        onChange() {}
      });
      TestView.setDataApi({
        subscribe() {
          return cleanups[subscriptionCount++];
        },
        observeCollection() {
          return observerCleanup;
        }
      });
      const view = new TestView({ collection: new Backbone.Collection(), model: {} });
      view.render();

      expect(() => view.destroy()).to.throw(error);
      expect(behaviorCleanup).to.have.been.calledOnce;
      expect(laterBehaviorCleanup).to.have.been.calledOnce;
      expect(hostCleanup).to.have.been.calledOnce;
      expect(observerCleanup).to.have.been.calledOnce;
      expect(stopListening).to.have.been.calledOn(view);
    });
  });

  describe('when view teardown fails', function() {
    for (const failure of ['detachEl', 'detach', 'removeChildren']) {
      it(`attempts remaining owned cleanup after ${ failure } throws`, function() {
        const error = new Error(`${ failure } failed`);
        const state = {};
        const disposeOwned = this.sinon.spy();
        const onDestroy = this.sinon.spy();
        const baseDom = View.prototype.Dom;
        const TestView = View.extend({
          Dom: {
            ...baseDom,
            detachEl(el) {
              if (failure === 'detachEl') { throw error; }
              return baseDom.detachEl(el);
            }
          },
          onDetach() {
            if (failure === 'detach') { throw error; }
          },
          onDestroy
        });
        TestView.prototype.createState = () => state;
        TestView.setStateApi({ disposeOwned });
        const view = new TestView();
        view.getState();
        const stopListening = this.sinon.spy(view, 'stopListening');
        view._isAttached = true;

        if (failure === 'removeChildren') {
          this.sinon.stub(view, '_removeChildren').throws(error);
        }

        expect(() => view.destroy()).to.throw(error);
        expect(view.isDestroyed()).to.be.true;
        expect(disposeOwned).to.have.been.calledOnceWith(state);
        expect(onDestroy).to.have.been.calledOnce;
        expect(stopListening).to.have.been.called;
      });
    }
  });

  describe('when destroying a view', function() {
    let view;
    let onDestroyStub;
    let destroyStub;
    let detachElSpy;

    beforeEach(function() {
      view = new View();

      detachElSpy = sinon.spy(view.Dom, 'detachEl');
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
      expect(detachElSpy).to.have.been.calledOnce;
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
    let detachElSpy;
    let destroyStub;

    beforeEach(function() {
      view = new View();

      detachElSpy = sinon.spy(view.Dom, 'detachEl');
      destroyStub = sinon.stub();
      view.on('destroy', destroyStub);

      view.destroy();
      view.destroy();
    });

    it('should not trigger the destroy event', function() {
      expect(destroyStub).to.have.been.calledOnce;
    });

    it('should not remove the view', function() {
      expect(detachElSpy).to.have.been.calledOnce;
    });

    it('should leave _isDestroyed as true', function() {
      expect(view).to.be.have.property('_isDestroyed', true);
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
      childView.el.click();
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
        layoutView._buildEventProxies();
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
        layoutView._buildEventProxies();
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('should not emit the event on the layout', function() {
        expect(layoutEventHandler).not.to.have.been.called;
      });
    });

    describe('when childViewEventPrefix is not configured', function() {
      it('should disable prefixed child event forwarding', function() {
        expect(new View()._eventPrefix).to.be.false;
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
        fooView.setElement(fooView.el);

        expect(fooView.setElement).to.have.returned(fooView);
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
