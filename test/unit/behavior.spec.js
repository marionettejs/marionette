import { vi, describe, it, expect, beforeEach } from 'vitest';
import Backbone from 'backbone';
import { setFixtures } from '../setup/fixtures.js';
import '../setup/backbone.js';
import _ from 'underscore';
import { Behavior, Region, View, CollectionView } from 'marionette';

describe('Behavior', function() {
  describe('when instantiating a behavior with some options', function() {
    it('should merge the options into instance options', function() {
      const createOptions = {foo: 'bar'};
      const behavior = new Behavior(createOptions, new View());

      expect(behavior.options).to.eql(createOptions);
    });
  });

  describe('setEventDelegator', function() {
    let behavior;

    function buildViewWithBehavior(BehaviorClass) {
      const CapturedBehavior = BehaviorClass.extend({
        initialize(...args) {
          behavior = this;
          BehaviorClass.prototype.initialize.apply(this, args);
        }
      });
      const FooView = View.extend({ behaviors: [CapturedBehavior] });

      const view = new FooView({
        el: document.createElement('div')
      });


      return view;
    }

    it('should set EventDelegator on behavior delegated events', function() {
      const delegate = vi.fn().mockReturnValue(() => {});
      const MyBehavior = Behavior.extend({
        events: {
          'click .foo': 'onFooClick'
        },
        onFooClick() {}
      });

      MyBehavior.setEventDelegator({ delegate });
      const view = buildViewWithBehavior(MyBehavior);

      expect(delegate).toHaveBeenCalledTimes(1);
      expect(delegate.mock.calls.at(0)[0])
        .to.include({
          eventName: 'click',
          selector: '.foo',
          rootEl: view.el
        });
    });

    it('should keep $ proxied through the host view', function() {
      const MyBehavior = Behavior.extend({});
      const view = buildViewWithBehavior(MyBehavior);
      view.$ = vi.fn().mockReturnValue(['host-view-dom']);

      expect(behavior.$('.foo')).to.eql(['host-view-dom']);
      expect(view.$).toHaveBeenCalledTimes(1);
      expect(view.$.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['.foo']);
    });
  });

  describe('behavior parsing', function() {
    let behaviorSpies;
    let FooView;

    beforeEach(function() {
      const Bar = Behavior.extend({});
      const Baz = Behavior.extend({});

      behaviorSpies = {
        foo: vi.fn(function(...args) { return new Behavior(...args); }),
        bar: vi.fn(function(...args) { return new Bar(...args); }),
        baz: vi.fn(function(...args) { return new Baz(...args); })
      };
    });

    describe('with array notation', function() {
      describe('when one behavior', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: [behaviorSpies.foo]
          });
        });

        it('should instantiate the behavior', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
        });
      });

      describe('when multiple behaviors', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: [behaviorSpies.foo, behaviorSpies.bar]
          });
        });

        it('should instantiate the behaviors', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
          expect(behaviorSpies.bar).toHaveBeenCalledTimes(1);
        });
      });

      describe('when behavior class is provided', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: [{behaviorClass: behaviorSpies.foo}]
          });
        });

        it('should instantiate the behavior', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
        });
      });

      describe('when behavior class and constructor are provided', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: [behaviorSpies.foo, behaviorSpies.bar, {
              behaviorClass: behaviorSpies.baz
            }]
          });
        });

        it('should instantiate the behaviors', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
          expect(behaviorSpies.bar).toHaveBeenCalledTimes(1);
          expect(behaviorSpies.baz).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('with object notation', function() {
      describe('when one behavior', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: {x: behaviorSpies.foo}
          });
        });

        it('should instantiate the behavior', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
        });
      });

      describe('when multiple behaviors', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: {x: behaviorSpies.foo, y: behaviorSpies.bar}
          });
        });

        it('should instantiate the behaviors', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
          expect(behaviorSpies.bar).toHaveBeenCalledTimes(1);
        });
      });

      describe('when behavior class is provided', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: {x: {behaviorClass: behaviorSpies.foo}}
          });
        });

        it('should instantiate the behavior', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
        });
      });

      describe('when behavior class and constructor are provided', function() {
        beforeEach(function() {
          FooView = View.extend({
            behaviors: {
              x: behaviorSpies.foo,
              y: behaviorSpies.bar,
              z: {
                behaviorClass: behaviorSpies.baz
              }
            }
          });
        });

        it('should instantiate the behaviors', function() {
          /* eslint-disable no-unused-vars */
          const fooView = new FooView();

          expect(behaviorSpies.foo).toHaveBeenCalledTimes(1);
          expect(behaviorSpies.bar).toHaveBeenCalledTimes(1);
          expect(behaviorSpies.baz).toHaveBeenCalledTimes(1);
        });
      });
    });


  });

  describe('behavior initialize', function() {
    let behavior;
    let view;

    beforeEach(function() {
      const TestBehavior = Behavior.extend({
        initialize: vi.fn()
      });

      view = new View();

      behavior = new TestBehavior({ foo: 'bar' }, view);
    });

    it('should have a cidPrefix', function() {
      expect(behavior.cidPrefix).to.equal('mnb');
    });

    it('should have a cid', function() {
      expect(behavior.cid).to.exist;
    });

    it('should call initialize when a behavior is created', function() {
      expect(behavior.initialize).toHaveBeenCalledTimes(1);
      expect(behavior.initialize.mock.calls.map(args => args.slice(0, 2))).toContainEqual([{ foo: 'bar' }, view]);
    });
  });

  describe('behavior initialize from constructor args', function() {
    let fooStub;
    let barStub;
    let FooView;
    let behaviorSpies;

    beforeEach(function() {
      fooStub = vi.fn();
      barStub = vi.fn();

      behaviorSpies = {
        foo: Behavior.extend({initialize: fooStub}),
        bar: Behavior.extend({initialize: barStub})
      };

      FooView = View.extend({
        behaviors: [behaviorSpies.foo]
      });
    });

    it('should call initialize when a behavior is created', function() {
      /* eslint-disable no-unused-vars */
      const fooView = new FooView({behaviors: [behaviorSpies.bar]});

      expect(barStub).toHaveBeenCalledTimes(1);
      expect(fooStub).not.toHaveBeenCalled();
    });
  });

  describe('behavior events', function() {
    let fooClickStub;
    let barClickStub;
    let bazClickStub;
    let viewClickStub;
    let behaviorSpies;
    let FooView;
    let fooView;

    beforeEach(function() {
      fooClickStub = vi.fn();
      barClickStub = vi.fn();
      bazClickStub = vi.fn();
      viewClickStub = vi.fn();

      behaviorSpies = {
        foo: Behavior.extend({
          events: {
            'click': fooClickStub
          }
        }),
        bar: Behavior.extend({
          events: {
            'click': barClickStub
          }
        }),
        baz: Behavior.extend({
          events: {
            'click': 'handleClick'
          },
          handleClick: bazClickStub
        })
      };

      FooView = View.extend({
        events: {
          'click': viewClickStub
        },
        behaviors: {
          x: behaviorSpies.foo,
          y: behaviorSpies.bar,
          z: behaviorSpies.baz
        }
      });

      fooView = new FooView();
    });

    it('should call first behaviors event', function() {
      fooView.el.click();

      expect(fooClickStub).toHaveBeenCalledTimes(1);
      expect(fooClickStub.mock.contexts).toContainEqual(expect.any(behaviorSpies.foo));
    });

    it('should call second behaviors event', function() {
      fooView.el.click();

      expect(barClickStub).toHaveBeenCalledTimes(1);
      expect(barClickStub.mock.contexts).toContainEqual(expect.any(behaviorSpies.bar));
    });

    it('should call third behaviors event', function() {
      fooView.el.click();

      expect(bazClickStub).toHaveBeenCalledTimes(1);
      expect(bazClickStub.mock.contexts).toContainEqual(expect.any(behaviorSpies.baz));
    });

    it('should call the view click handler', function() {
      fooView.el.click();

      expect(viewClickStub).toHaveBeenCalledTimes(1);
      expect(viewClickStub.mock.contexts).toContain(fooView);
    });

    it('runs every matching host and Behavior declaration without map collisions', function() {
      fooView.el.click();

      expect(fooClickStub).toHaveBeenCalledTimes(1);
      expect(barClickStub).toHaveBeenCalledTimes(1);
      expect(bazClickStub).toHaveBeenCalledTimes(1);
      expect(viewClickStub).toHaveBeenCalledTimes(1);
    });
  });

  describe('behavior triggers', function() {
    let onClickFooStub;
    let triggerMethodViewSpy;
    let triggerMethodSpy;
    let behaviorSpies;
    let fooView;

    beforeEach(function() {
      onClickFooStub = vi.fn();

      behaviorSpies = {
        foo: Behavior.extend({
          triggers: {'click': 'click:foo'},
          onClickFoo: onClickFooStub
        })
      };

      const FooView = View.extend({
        triggers: {
          'click': 'click:foo:view'
        },
        behaviors: [behaviorSpies.foo]
      });

      const fooModel = new Backbone.Model();
      const fooCollection = new Backbone.Collection();

      fooView = new FooView({
        model: fooModel,
        collection: fooCollection
      });

      triggerMethodSpy = vi.fn();
      triggerMethodViewSpy = vi.fn();

      fooView.on('click:foo', triggerMethodSpy);
      fooView.on('click:foo:view', triggerMethodViewSpy);
    });

    it('should call `triggerMethod` with the triggered event', function() {
      fooView.el.click();

      expect(triggerMethodSpy).toHaveBeenCalledTimes(1);
      expect(triggerMethodSpy.mock.contexts).toContain(fooView);
    });

    it('should call the triggered method', function() {
      fooView.el.click();

      expect(onClickFooStub).toHaveBeenCalledTimes(1);
      expect(onClickFooStub.mock.contexts).toContainEqual(expect.any(behaviorSpies.foo));
    });

    it('should not collide with view triggers with same event', function() {
      fooView.el.click();

      expect(triggerMethodViewSpy).toHaveBeenCalledTimes(1);
      expect(triggerMethodViewSpy.mock.contexts).toContain(fooView);
    });
  });

  describe('element synchronization', function() {
    let fooBehavior;
    let fooView;

    beforeEach(function() {
      const behaviorSpies = {
        foo: Behavior.extend({
          initialize: function() {
            fooBehavior = this;
          }
        })
      };

      const FooView = View.extend({
        behaviors: [behaviorSpies.foo]
      });

      fooView = new FooView();
    });

    it('does not proxy $el with the native DomApi', function() {

      expect(fooBehavior).to.not.have.property('$el');
    });

    it('should proxy the views el', function() {

      expect(fooBehavior.el).to.equal(fooView.el);
    });
  });

  describe('behavior UI', function() {
    let fooBehavior;
    let onRenderStub;
    let onBeforeAttachStub;
    let onAttachStub;
    let onDestroyStub;
    let onFooClickStub;
    let onBarClickStub;
    let behaviorSpies;
    let FooView;

    beforeEach(function() {
      onRenderStub = vi.fn();
      onBeforeAttachStub = vi.fn();
      onAttachStub = vi.fn();
      onDestroyStub = vi.fn();
      onFooClickStub = vi.fn();
      onBarClickStub = vi.fn();

      behaviorSpies = {
        foo: Behavior.extend({
          ui: {foo: '.foo'},
          initialize: function() {fooBehavior = this;},
          events: {
            'click @ui.foo': 'onFooClick'
          },

          testBehaviorUI: function() { this.ui.foo[0].dispatchEvent(new Event('test')); },
          onRender: onRenderStub,
          onBeforeAttach: onBeforeAttachStub,
          onAttach: onAttachStub,
          onDestroy: onDestroyStub,
          onFooClick: onFooClickStub,
          onBarClick: onBarClickStub
        })
      };

      FooView = View.extend({
        template: _.template('<div class="foo"></div><div class="bar"></div>'),
        ui: {bar: '.bar'},
        behaviors: [behaviorSpies.foo]
      });
    });

    describe('should call onAttach when inside a CollectionView', function() {
      let region;
      let fooCollection;
      let fooCollectionView;

      beforeEach(function() {
        const FooCollectionView = CollectionView.extend({
          childView: FooView
        });

        fooCollection = new Backbone.Collection([{}]);
        fooCollectionView = new FooCollectionView({collection: fooCollection});

        setFixtures('<div id="region"></div>');

        region = new Region({
          el: '#region'
        });
      });

      it('should call onAttach when inside a CollectionView', function() {
        region.show(fooCollectionView);

        expect(onAttachStub).toHaveBeenCalled();
      });

      it('should call onAttach when already shown and reset', function() {
        region.show(fooCollectionView);
        fooCollection.reset([{id: 1}, {id: 2}]);

        expect(onAttachStub.mock.calls.length).to.equal(3);
      });

      it('should call onAttach when a single model is added and the collectionView is already shown', function() {
        region.show(fooCollectionView);
        fooCollection.add({id: 3});

        expect(onAttachStub.mock.calls.length).to.equal(2);
      });
    });

    describe('view should be able to override predefined behavior ui', function() {
      let barView;

      beforeEach(function() {
        const BarView = View.extend({
          template: _.template('<div class="zip"></div><div class="bar"></div>'),
          ui: {
            bar: '.bar',
            foo: '.zip' // override foo selector behavior
          },
          behaviors: [behaviorSpies.foo]
        });

        barView = new BarView();
        barView.render();
      });

      it('should bind the behavior UI to the overridden selector', function() {
        expect(fooBehavior.getUI('foo')[0]).to.equal(barView.el.querySelector('.zip'));
      });
    });

    describe('within a view', function() {
      let fooView;

      it('should not clobber the event prototype', function() {
        fooView = new FooView();

        expect(behaviorSpies.foo.prototype.events).to.have.property('click @ui.foo', 'onFooClick');
      });

      it('should handle click events after calling delegateEvents', function() {
        fooView = new FooView();
        fooView.render();
        expect(() => fooBehavior.ui.foo[0].click()).to.not.throw();
        expect(() => fooView.ui.bar[0].click()).to.not.throw();
      });

      it('should set the behavior UI element', function() {
        fooView = new FooView();
        fooView.render();

        expect(onRenderStub).toHaveBeenCalledTimes(1);
      });

      it('should make the behavior\'s ui hash available to callbacks', function() {
        fooView = new FooView();
        fooView.render();

        expect(fooBehavior.testBehaviorUI.bind(fooBehavior)).to.not.throw();
      });

      describe('the el', function() {
        beforeEach(function() {
          fooView = new FooView();
          fooView.render();
        });

        it('should handle behavior ui click event', function() {
          fooView.el.querySelector('.foo').click();

          expect(onFooClickStub).toHaveBeenCalledTimes(1);
          expect(onFooClickStub.mock.contexts).toContain(fooBehavior);
        });

        it('has a getUI method which returns the selector', function() {
          expect(fooBehavior.getUI('foo')).to.have.length(1);
        });
      });

      describe('wrapped with jQuery in the test', function() {
        beforeEach(function() {
          fooView = new FooView();
          fooView.render();
        });

        it('should handle behavior ui click event', function() {
          fooView.el.querySelector('.foo').click();

          expect(onFooClickStub).toHaveBeenCalledTimes(1);
          expect(onFooClickStub.mock.contexts).toContain(fooBehavior);
        });

      });
    });

    describe('within a layout', function() {
      let barView;

      beforeEach(function() {
        setFixtures('<div id="layout"></div>');

        const BarView = View.extend({
          el: document.getElementById('layout'),
          template: _.template('<div class="baz"></div>'),
          regions: {bazRegion: '.baz'}
        });

        barView = new BarView();
        barView.render();
      });

      it('should call onBeforeAttach', function() {
        barView.getRegion('bazRegion').show(new FooView());

        expect(onBeforeAttachStub).toHaveBeenCalledTimes(1);
      });

      it('should call onAttach', function() {
        barView.getRegion('bazRegion').show(new FooView());

        expect(onAttachStub).toHaveBeenCalledTimes(1);
      });

      it('should call onDestroy', function() {
        barView.getRegion('bazRegion').show(new FooView());
        barView.destroy();

        expect(onDestroyStub).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('behavior instance events', function() {
    let listenToChangeStub;
    let onFooStub;
    let fooModel;
    let fooView;

    beforeEach(function() {
      fooModel = new Backbone.Model();

      listenToChangeStub = vi.fn();
      onFooStub = vi.fn();

      const FooBehavior = Behavior.extend({
        initialize: function() {
          this.listenTo(fooModel, 'change', listenToChangeStub);
          this.on('foo', onFooStub);
        }
      });

      const FooView = View.extend({
        behaviors: [FooBehavior]
      });

      fooView = new FooView();
      fooView.destroy();
    });

    it('should unbind listenTo on destroy', function() {
      fooModel.set('bar', 'baz');

      expect(listenToChangeStub).not.toHaveBeenCalledTimes(1);
    });
  });

  describe('behavior model events', function() {
    let handleModelChangeStub;
    let handleCollectionResetStub;
    let handleModelFooChangeStub;
    let fooBehavior;
    let FooView;
    let FooCollectionView;
    let fooModel;
    let fooCollection;

    beforeEach(function() {
      handleModelChangeStub = vi.fn();
      handleCollectionResetStub = vi.fn();
      handleModelFooChangeStub = vi.fn();

      const behaviorSpies = {
        foo: Behavior.extend({
          initialize: function() {
            fooBehavior = this;
          },
          modelEvents: {
            'change': handleModelChangeStub,
            'change:foo': 'handleModelFooChange'
          },
          collectionEvents: {
            'reset': handleCollectionResetStub
          },
          handleModelFooChange: handleModelFooChangeStub
        })
      };

      FooCollectionView = CollectionView.extend({
        behaviors: [behaviorSpies.foo]
      });
      FooView = View.extend({
        behaviors: [behaviorSpies.foo]
      });

      fooModel = new Backbone.Model({foo: 'bar'});
      fooCollection = new Backbone.Collection([]);
    });

    it('should proxy model events', function() {
      /* eslint-disable no-unused-vars */
      const fooView = new FooView({model: fooModel});
      fooModel.set('foo', 'baz');

      expect(handleModelChangeStub).toHaveBeenCalledTimes(1);
      expect(handleModelChangeStub.mock.contexts).toContain(fooBehavior);
    });

    it('should proxy model events w/ string cbk', function() {
      /* eslint-disable no-unused-vars */
      const fooView = new FooView({model: fooModel});
      fooModel.set('foo', 'baz');

      expect(handleModelFooChangeStub).toHaveBeenCalledTimes(1);
      expect(handleModelFooChangeStub.mock.contexts).toContain(fooBehavior);
    });

    it('should proxy collection events', function() {
      /* eslint-disable no-unused-vars */
      const fooCollectionView = new FooCollectionView({collection: fooCollection});
      fooCollection.reset();

      expect(handleCollectionResetStub).toHaveBeenCalledTimes(1);
      expect(handleCollectionResetStub.mock.contexts).toContain(fooBehavior);
    });

    it('should unbind model events on view undelegateEntityEvents', function() {
      const fooView = new FooView({model: fooModel});
      fooView.undelegateEntityEvents();
      fooModel.set('foo', 'doge');

      expect(handleModelFooChangeStub).not.toHaveBeenCalled();
    });

    it('should unbind collection events on view undelegateEntityEvents', function() {
      const fooCollectionView = new FooCollectionView({collection: fooCollection});
      fooCollectionView.undelegateEntityEvents();
      fooCollection.reset();

      expect(handleCollectionResetStub).not.toHaveBeenCalled();
    });
  });

  describe('direct behavior entity event delegation', function() {
    function buildHost(context, onBeforeDestroy) {
      const stubs = {
        collectionHandler: vi.fn(),
        collectionEvents: vi.fn(),
        modelHandler: vi.fn(),
        modelEvents: vi.fn()
      };
      stubs.collectionEvents.mockReturnValue({ update: stubs.collectionHandler });
      stubs.modelEvents.mockReturnValue({ change: stubs.modelHandler });

      let behavior;
      const EntityBehavior = Behavior.extend({
        initialize() { behavior = this; },
        collectionEvents: stubs.collectionEvents,
        modelEvents: stubs.modelEvents
      });
      const EntityView = View.extend({
        behaviors: [EntityBehavior],
        onBeforeDestroy
      });
      const collection = new Backbone.Collection();
      const model = new Backbone.Model();
      const view = new EntityView({ collection, model });

      Object.values(stubs).forEach(stub => stub.mockClear());

      return { behavior, collection, model, stubs, view };
    }

    it('should delegate callable maps directly while the owning view is live', function(testContext) {
      const { behavior, collection, model, stubs, view } = buildHost(testContext);
      view.undelegateEntityEvents();

      const result = behavior.delegateEntityEvents();
      model.trigger('change');
      collection.trigger('update');

      expect(result).to.equal(behavior);
      expect(stubs.modelEvents).toHaveBeenCalledTimes(1);
      expect(stubs.modelEvents.mock.contexts).toContain(behavior);
      expect(stubs.collectionEvents).toHaveBeenCalledTimes(1);
      expect(stubs.collectionEvents.mock.contexts).toContain(behavior);
      expect(stubs.modelHandler).toHaveBeenCalledTimes(1);
      expect(stubs.modelHandler.mock.contexts).toContain(behavior);
      expect(stubs.collectionHandler).toHaveBeenCalledTimes(1);
      expect(stubs.collectionHandler.mock.contexts).toContain(behavior);
    });

    it('should not delegate directly while the owning view is destroying', function(testContext) {
      let result;
      const { behavior, collection, model, stubs, view } = buildHost(testContext, function() {
        this.undelegateEntityEvents();
        result = behavior.delegateEntityEvents();
        model.trigger('change');
        collection.trigger('update');
      });

      view.destroy();

      expect(result).to.equal(behavior);
      expect(stubs.modelEvents).not.toHaveBeenCalled();
      expect(stubs.collectionEvents).not.toHaveBeenCalled();
      expect(stubs.modelHandler).not.toHaveBeenCalled();
      expect(stubs.collectionHandler).not.toHaveBeenCalled();
    });

    it('should not delegate a retained behavior after its owning view is destroyed', function(testContext) {
      const { behavior, collection, model, stubs, view } = buildHost(testContext);
      view.destroy();

      const result = behavior.delegateEntityEvents();
      model.trigger('change');
      collection.trigger('update');

      expect(result).to.equal(behavior);
      expect(stubs.modelEvents).not.toHaveBeenCalled();
      expect(stubs.collectionEvents).not.toHaveBeenCalled();
      expect(stubs.modelHandler).not.toHaveBeenCalled();
      expect(stubs.collectionHandler).not.toHaveBeenCalled();
    });
  });

  describe('behavior trigger calls', function() {
    let onRenderStub;
    let fooView;

    beforeEach(function() {
      onRenderStub = vi.fn();

      const behaviorSpies = {
        foo: Behavior.extend({
          onRender: onRenderStub
        })
      };

      const FooView = View.extend({
        behaviors: [behaviorSpies.foo]
      });

      fooView = new FooView();
    });

    it('should call onRender when a view is rendered', function() {
      fooView.triggerMethod('render');

      expect(onRenderStub).toHaveBeenCalledTimes(1);
    });
  });

  describe('behavior is evented', function() {
    let listenToStub;
    let changeStub;
    let behavior;
    let fooModel;

    beforeEach(function() {
      listenToStub = vi.fn();
      changeStub = vi.fn();

      behavior = new Behavior({}, new View());
      fooModel = new Backbone.Model();

      behavior.bindEvents(fooModel, {
        'change': changeStub
      });

      behavior.listenTo(fooModel, 'foo', listenToStub);
    });

    it('should listenTo events', function() {
      fooModel.trigger('foo');

      expect(listenToStub).toHaveBeenCalledTimes(1);
    });

    it('should support bindEntityEvents', function() {
      fooModel.set('foo', 'bar');

      expect(changeStub).toHaveBeenCalledTimes(1);
    });

    it('should execute in the specified context', function() {
      fooModel.trigger('foo');

      expect(listenToStub).toHaveBeenCalledTimes(1);
      expect(listenToStub.mock.contexts).toContain(behavior);
    });
  });

  describe('#destroy', function() {
    it('unsubscribes entity events, host lifecycle events and DOM events', function() {
      let behavior;
      const changed = vi.fn();
      const reset = vi.fn();
      const clicked = vi.fn();
      const rendered = vi.fn();
      const TestBehavior = Behavior.extend({
        initialize() { behavior = this; },
        modelEvents: { change: changed },
        collectionEvents: { reset },
        events: { click: clicked },
        onRender: rendered
      });
      const model = new Backbone.Model();
      const collection = new Backbone.Collection();
      const view = new View({ behaviors: [TestBehavior], model, collection, template: () => 'content' });
      view.render();
      model.set('value', 1);
      collection.reset([]);
      view.el.click();
      expect(changed).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(clicked).toHaveBeenCalledTimes(1);
      expect(rendered).toHaveBeenCalledTimes(1);

      expect(behavior.destroy()).to.equal(behavior);
      expect(behavior.destroy()).to.equal(behavior);
      view.delegateEntityEvents();
      view.delegateEvents();
      view.render();
      model.set('value', 2);
      collection.reset([]);
      view.el.click();
      expect(changed).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledTimes(1);
      expect(clicked).toHaveBeenCalledTimes(1);
      expect(rendered).toHaveBeenCalledTimes(1);
      expect(view.isDestroyed()).to.be.false;
      view.destroy();
    });

    it('stops listening when a directly constructed behavior is destroyed', function() {
      const view = new View();
      const behavior = new Behavior({}, view);
      const listener = vi.fn();
      behavior.listenTo(view, 'custom', listener);
      view.trigger('custom');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(behavior.destroy()).to.equal(behavior);
      view.trigger('custom');
      expect(listener).toHaveBeenCalledTimes(1);
      view.destroy();
    });
  });

});
