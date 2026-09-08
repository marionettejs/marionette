import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import * as Marionette from '../../../src/index.ts';
import '../../setup/backbone.js';
import Backbone from 'backbone';
import Behavior from '../../../src/modules/behavior';
import CollectionView from '../../../src/modules/collection-view';
import View from '../../../src/modules/view';

describe('view mixin', function() {
  'use strict';

  describe('when creating a view', function() {
    let initializeStub;
    let view;

    beforeEach(function() {
      initializeStub = vi.fn();

      const MyView = View.extend({
        initialize: initializeStub
      });

      view = new MyView();
    });

    it('should call initialize', function() {
      expect(initializeStub).toHaveBeenCalledTimes(1);
    });

    it('should set _behaviors', function() {
      expect(view._behaviors).to.be.eql([]);
    });
  });

  describe('when using listenTo for the "destroy" event on itself, and destroying the view', function() {
    let destroyStub;

    beforeEach(function() {
      destroyStub = vi.fn();
      const view = new View();
      view.listenTo(view, 'destroy', destroyStub);
      view.destroy();
    });

    it('should trigger the "destroy" event', function() {
      expect(destroyStub).toHaveBeenCalled();
    });
  });

  describe('when delegating entity events after destruction starts', function() {
    function buildHost(context, ViewClass, onBeforeDestroy) {
      const stubs = {
        behaviorCollectionHandler: vi.fn(),
        behaviorCollectionEvents: vi.fn(),
        behaviorModelHandler: vi.fn(),
        behaviorModelEvents: vi.fn(),
        hostCollectionHandler: vi.fn(),
        hostCollectionEvents: vi.fn(),
        hostModelHandler: vi.fn(),
        hostModelEvents: vi.fn()
      };
      stubs.behaviorCollectionEvents.mockReturnValue({ update: stubs.behaviorCollectionHandler });
      stubs.behaviorModelEvents.mockReturnValue({ change: stubs.behaviorModelHandler });
      stubs.hostCollectionEvents.mockReturnValue({ update: stubs.hostCollectionHandler });
      stubs.hostModelEvents.mockReturnValue({ change: stubs.hostModelHandler });

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

      Object.values(stubs).forEach(stub => stub.mockClear());

      return { collection, model, stubs, view };
    }

    function expectResolversNotCalled(stubs) {
      expect(stubs.behaviorCollectionEvents).not.toHaveBeenCalled();
      expect(stubs.behaviorModelEvents).not.toHaveBeenCalled();
      expect(stubs.hostCollectionEvents).not.toHaveBeenCalled();
      expect(stubs.hostModelEvents).not.toHaveBeenCalled();
    }

    [
      ['View', View],
      ['CollectionView', CollectionView]
    ].forEach(([name, ViewClass]) => {
      it(`should not evaluate or bind ${ name } entity events while destroying`, function(testContext) {
        let result;
        const { collection, model, stubs, view } = buildHost(testContext, ViewClass, function() {
          result = this.delegateEntityEvents();
          model.trigger('change');
          collection.trigger('update');
        });

        view.destroy();

        expect(result).to.equal(view);
        expect(stubs.hostModelHandler).toHaveBeenCalledTimes(1);
        expect(stubs.hostCollectionHandler).toHaveBeenCalledTimes(1);
        expect(stubs.behaviorModelHandler).toHaveBeenCalledTimes(1);
        expect(stubs.behaviorCollectionHandler).toHaveBeenCalledTimes(1);
        expectResolversNotCalled(stubs);
      });

      it(`should not evaluate or bind ${ name } entity events after destruction`, function(testContext) {
        const { collection, model, stubs, view } = buildHost(testContext, ViewClass);
        view.destroy();
        const result = view.delegateEntityEvents();

        model.trigger('change');
        collection.trigger('update');

        expect(result).to.equal(view);
        expectResolversNotCalled(stubs);
        expect(stubs.hostModelHandler).not.toHaveBeenCalled();
        expect(stubs.hostCollectionHandler).not.toHaveBeenCalled();
        expect(stubs.behaviorModelHandler).not.toHaveBeenCalled();
        expect(stubs.behaviorCollectionHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('when destroying a view', function() {
    let view;
    let onDestroyStub;
    let destroyStub;
    let detachElSpy;

    beforeEach(function() {
      view = new View();

      detachElSpy = vi.spyOn(view.Dom, 'detachEl');
      vi.spyOn(view, '_undelegateEntityEvents');
      vi.spyOn(view, 'destroy');

      onDestroyStub = vi.fn();
      view.onDestroy = onDestroyStub;

      destroyStub = vi.fn();
      view.on('destroy', destroyStub);

      view.destroy({foo: 'bar'});
    });

    it('should trigger the destroy event', function() {
      expect(destroyStub).toHaveBeenCalledTimes(1);
    });

    it('should call an onDestroy method with options argument passed to destroy', function() {
      expect(onDestroyStub).toHaveBeenCalledTimes(1);
      expect(onDestroyStub.mock.calls.map(args => args.slice(0, 2))).toContainEqual([view, {foo: 'bar'}]);
    });

    it('should remove the view', function() {
      expect(detachElSpy).toHaveBeenCalledTimes(1);
    });

    it('should undelegate entity events', function() {
      expect(view._undelegateEntityEvents).toHaveBeenCalledTimes(1);
    });

    it('should set the view _isDestroyed to true', function() {
      expect(view).to.be.have.property('_isDestroyed', true);
    });

    it('should return the View', function() {
      expect(view.destroy).toHaveReturnedWith(view);
    });

    describe('and it has already been destroyed', function() {
      beforeEach(function() {
        view.destroy();
      });

      it('should return the View', function() {
        expect(view.destroy).toHaveReturnedWith(view);
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

      destroyStub = vi.fn();
      view.on('destroy', destroyStub);

      beforeDestroyStub = vi.fn();
      view.on('before:destroy', beforeDestroyStub);

      onDestroyStub = vi.fn();
      view.onDestroy = onDestroyStub;

      onBeforeDestroyStub = vi.fn();
      view.onBeforeDestroy = onBeforeDestroyStub;

      view.render();
      view.destroy();

    });
    it('should trigger the destroy event once', function() {
      expect(destroyStub).toHaveBeenCalledTimes(1);
      expect(onDestroyStub).toHaveBeenCalledTimes(1);
    });
    it('should trigger the before:destroy event once', function() {
      expect(beforeDestroyStub).toHaveBeenCalledTimes(1);
      expect(onBeforeDestroyStub).toHaveBeenCalledTimes(1);
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

      const presetsStub = vi.fn().mockReturnValue(presets);

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

      detachElSpy = vi.spyOn(view.Dom, 'detachEl');
      destroyStub = vi.fn();
      view.on('destroy', destroyStub);

      view.destroy();
      view.destroy();
    });

    it('should not trigger the destroy event', function() {
      expect(destroyStub).toHaveBeenCalledTimes(1);
    });

    it('should not remove the view', function() {
      expect(detachElSpy).toHaveBeenCalledTimes(1);
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
      onChildviewFooClickStub = vi.fn();

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
      expect(onChildviewFooClickStub).toHaveBeenCalledTimes(1);
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

    beforeEach(function(testContext) {
      const LayoutView = View.extend({
        template: _.template('<div class="child"></div>'),

        regions: {
          'child': '.child',
        },

        childViewEventPrefix: 'childview',

        childViewEvents: {
          'boom': 'onBoom'
        },

        onBoom: vi.fn(),

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

        onRattle: vi.fn()
      });

      superView = new SuperView();
      layoutView = new LayoutView();
      childView = new ChildView();
      layoutView.render();
      superView.render();

      layoutEventHandler = vi.fn();
      layoutView.on('childview:boom', layoutEventHandler);

      layoutEventOnHandler = vi.fn();
      layoutView.onChildviewBoom = layoutEventOnHandler;

      layoutViewOnBoomHandler = layoutView.onBoom;

      superViewOnRattleHandler = superView.onRattle;

      childEventsFunction = (function() {
        return {
          'boom': layoutViewOnBoomHandler
        };
      }).bind(testContext);
    });

    describe('when there is not a containing layout', function() {
      beforeEach(function() {
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('does not emit the event on the layout', function() {
        expect(layoutEventHandler).not.toHaveBeenCalled();
      });
    });

    describe('when there is a containing layout', function() {
      beforeEach(function() {
        layoutView.showChildView('child', childView);
        childView.triggerMethod('boom', 'foo', 'bar');
      });

      it('emits the event on the layout', function() {
        expect(layoutEventHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
        expect(layoutEventHandler.mock.contexts).toContain(layoutView);
        expect(layoutEventHandler).toHaveBeenCalledTimes(1);
      });

      it('invokes the layout on handler', function() {
        expect(layoutEventOnHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
        expect(layoutEventOnHandler.mock.contexts).toContain(layoutView);
        expect(layoutEventOnHandler).toHaveBeenCalledTimes(1);
      });

      it('invokes the layout childViewEvents handler', function() {
        expect(layoutViewOnBoomHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
        expect(layoutViewOnBoomHandler.mock.contexts).toContain(layoutView);
        expect(layoutViewOnBoomHandler).toHaveBeenCalledTimes(1);
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
        expect(layoutViewOnBoomHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
        expect(layoutViewOnBoomHandler.mock.contexts).toContain(layoutView);
        expect(layoutViewOnBoomHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('using childViewTriggers', function() {
      beforeEach(function() {
        superView.showChildView('layout', layoutView);
        layoutView.showChildView('child', childView);
        childView.triggerMethod('whack', 'foo', 'bar');
      });

      it('invokes the super trigger handler', function() {
        expect(superViewOnRattleHandler.mock.calls.map(args => args.slice(0, 2))).toContainEqual(['foo', 'bar']);
        expect(superViewOnRattleHandler.mock.contexts).toContain(superView);
        expect(superViewOnRattleHandler).toHaveBeenCalledTimes(1);
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
        expect(layoutEventHandler).not.toHaveBeenCalled();
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
        vi.spyOn(fooView, 'destroy');
        fooView.destroy();

        expect(fooView.destroy).toHaveReturnedWith(fooView);
      });

      it('delegateEntityEvents should return the view', function() {
        vi.spyOn(fooView, 'delegateEntityEvents');
        fooView.delegateEntityEvents();

        expect(fooView.delegateEntityEvents).toHaveReturnedWith(fooView);
      });

      it('undelegateEntityEvents should return the view', function() {
        vi.spyOn(fooView, 'undelegateEntityEvents');
        fooView.undelegateEntityEvents({});

        expect(fooView.undelegateEntityEvents).toHaveReturnedWith(fooView);
      });
    });
  });
});
