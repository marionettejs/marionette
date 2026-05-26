import _ from 'underscore';
import Behavior from '../../modules/behavior';
import Region from '../../modules/region';
import View from '../../modules/view';
import CollectionView from '../../modules/collection-view';
import { bindEvents } from '../../index.js';

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
      const FooView = View.extend({
        behaviors: [BehaviorClass]
      });

      const view = new FooView({
        el: document.createElement('div')
      });

      behavior = view._behaviors[0];

      return view;
    }

    it('should set EventDelegator on behavior delegated events', function() {
      const delegate = this.sinon.stub();
      const MyBehavior = Behavior.extend({
        events: {
          'click .foo': 'onFooClick'
        },
        onFooClick() {}
      });

      MyBehavior.setEventDelegator({ delegate });
      const view = buildViewWithBehavior(MyBehavior);

      expect(delegate).to.have.been.calledOnce;
      expect(delegate.firstCall.args[0])
        .to.include({
          eventName: 'click',
          selector: '.foo',
          rootEl: view.el
        });
    });

    it('should keep $ proxied through the host view', function() {
      const MyBehavior = Behavior.extend({});
      const view = buildViewWithBehavior(MyBehavior);
      view.$ = this.sinon.stub().returns(['host-view-dom']);

      expect(behavior.$('.foo')).to.eql(['host-view-dom']);
      expect(view.$)
        .to.have.been.calledOnce
        .and.calledWith('.foo');
    });
  });

  describe('behavior parsing', function() {
    let behaviorSpies;
    let FooView;

    beforeEach(function() {
      const Bar = Behavior.extend({});
      const Baz = Behavior.extend({});

      behaviorSpies = {
        foo: this.sinon.spy(Behavior),
        bar: this.sinon.spy(Bar),
        baz: this.sinon.spy(Baz)
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
          expect(behaviorSpies.bar).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
          expect(behaviorSpies.bar).to.have.been.calledOnce;
          expect(behaviorSpies.baz).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
          expect(behaviorSpies.bar).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
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

          expect(behaviorSpies.foo).to.have.been.calledOnce;
          expect(behaviorSpies.bar).to.have.been.calledOnce;
          expect(behaviorSpies.baz).to.have.been.calledOnce;
        });
      });
    });


  });

  describe('behavior initialize', function() {
    let behavior;
    let view;

    beforeEach(function() {
      const TestBehavior = Behavior.extend({
        initialize: this.sinon.stub()
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
      expect(behavior.initialize)
        .to.have.been.calledOnce
        .and.calledWith({ foo: 'bar' }, view);
    });
  });

  describe('behavior initialize from constructor args', function() {
    let fooStub;
    let barStub;
    let FooView;
    let behaviorSpies;

    beforeEach(function() {
      fooStub = this.sinon.stub();
      barStub = this.sinon.stub();

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

      expect(barStub).to.have.been.calledOnce;
      expect(fooStub).not.to.have.been.called;
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
      fooClickStub = this.sinon.stub();
      barClickStub = this.sinon.stub();
      bazClickStub = this.sinon.stub();
      viewClickStub = this.sinon.stub();

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

      expect(fooClickStub).to.have.been.calledOnce.and.calledOn(this.sinon.match.instanceOf(behaviorSpies.foo));
    });

    it('should call second behaviors event', function() {
      fooView.el.click();

      expect(barClickStub).to.have.been.calledOnce.and.calledOn(this.sinon.match.instanceOf(behaviorSpies.bar));
    });

    it('should call third behaviors event', function() {
      fooView.el.click();

      expect(bazClickStub).to.have.been.calledOnce.and.calledOn(this.sinon.match.instanceOf(behaviorSpies.baz));
    });

    it('should call the view click handler', function() {
      fooView.el.click();

      expect(viewClickStub).to.have.been.calledOnce.and.calledOn(fooView);
    });
  });

  describe('behavior triggers', function() {
    let onClickFooStub;
    let triggerMethodViewSpy;
    let triggerMethodSpy;
    let behaviorSpies;
    let fooView;

    beforeEach(function() {
      onClickFooStub = this.sinon.stub();

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

      triggerMethodSpy = this.sinon.spy();
      triggerMethodViewSpy = this.sinon.spy();

      fooView.on('click:foo', triggerMethodSpy);
      fooView.on('click:foo:view', triggerMethodViewSpy);
    });

    it('should call `triggerMethod` with the triggered event', function() {
      fooView.el.click();

      expect(triggerMethodSpy)
        .to.have.been.calledOnce
        .and.calledOn(fooView);
    });

    it('should call the triggered method', function() {
      fooView.el.click();

      expect(onClickFooStub)
        .to.have.been.calledOnce
        .and.have.been.calledOn(this.sinon.match.instanceOf(behaviorSpies.foo));
    });

    it('should not collide with view triggers with same event', function() {
      fooView.el.click();

      expect(triggerMethodViewSpy)
        .to.have.been.calledOnce
        .and.calledOn(fooView);
    });
  });

  describe('proxyViewProperties', function() {
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
      fooView.setElement(document.createElement('bar'));

      expect(fooBehavior).to.not.have.property('$el');
    });

    it('should proxy the views el', function() {
      fooView.setElement(document.createElement('bar'));

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
      onRenderStub = this.sinon.stub();
      onBeforeAttachStub = this.sinon.stub();
      onAttachStub = this.sinon.stub();
      onDestroyStub = this.sinon.stub();
      onFooClickStub = this.sinon.stub();
      onBarClickStub = this.sinon.stub();

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

        this.setFixtures('<div id="region"></div>');

        region = new Region({
          el: '#region'
        });
      });

      it('should call onAttach when inside a CollectionView', function() {
        region.show(fooCollectionView);

        expect(onAttachStub).to.have.been.called;
      });

      it('should call onAttach when already shown and reset', function() {
        region.show(fooCollectionView);
        fooCollection.reset([{id: 1}, {id: 2}]);

        expect(onAttachStub.callCount).to.equal(3);
      });

      it('should call onAttach when a single model is added and the collectionView is already shown', function() {
        region.show(fooCollectionView);
        fooCollection.add({id: 3});

        expect(onAttachStub.callCount).to.equal(2);
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

        expect(onRenderStub).to.have.been.calledOnce;
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

          expect(onFooClickStub).to.have.been.calledOnce.and.calledOn(fooBehavior);
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

          expect(onFooClickStub).to.have.been.calledOnce.and.calledOn(fooBehavior);
        });

      });
    });

    describe('within a layout', function() {
      let barView;

      beforeEach(function() {
        this.setFixtures('<div id="layout"></div>');

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

        expect(onBeforeAttachStub).to.have.been.calledOnce;
      });

      it('should call onAttach', function() {
        barView.getRegion('bazRegion').show(new FooView());

        expect(onAttachStub).to.have.been.calledOnce;
      });

      it('should call onDestroy', function() {
        barView.getRegion('bazRegion').show(new FooView());
        barView.destroy();

        expect(onDestroyStub).to.have.been.calledOnce;
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

      listenToChangeStub = this.sinon.stub();
      onFooStub = this.sinon.stub();

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

      expect(listenToChangeStub).not.to.have.been.calledOnce;
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
      handleModelChangeStub = this.sinon.stub();
      handleCollectionResetStub = this.sinon.stub();
      handleModelFooChangeStub = this.sinon.stub();

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

      expect(handleModelChangeStub).to.have.been.calledOnce.and.calledOn(fooBehavior);
    });

    it('should proxy model events w/ string cbk', function() {
      /* eslint-disable no-unused-vars */
      const fooView = new FooView({model: fooModel});
      fooModel.set('foo', 'baz');

      expect(handleModelFooChangeStub).to.have.been.calledOnce.and.calledOn(fooBehavior);
    });

    it('should proxy collection events', function() {
      /* eslint-disable no-unused-vars */
      const fooCollectionView = new FooCollectionView({collection: fooCollection});
      fooCollection.reset();

      expect(handleCollectionResetStub).to.have.been.calledOnce.and.calledOn(fooBehavior);
    });

    it('should unbind model events on view undelegateEntityEvents', function() {
      const fooView = new FooView({model: fooModel});
      fooView.undelegateEntityEvents();
      fooModel.set('foo', 'doge');

      expect(handleModelFooChangeStub).not.to.have.been.called;
    });

    it('should unbind collection events on view undelegateEntityEvents', function() {
      const fooCollectionView = new FooCollectionView({collection: fooCollection});
      fooCollectionView.undelegateEntityEvents();
      fooCollection.reset();

      expect(handleCollectionResetStub).not.to.have.been.called;
    });
  });

  describe('behavior trigger calls', function() {
    let onRenderStub;
    let fooView;

    beforeEach(function() {
      onRenderStub = this.sinon.stub();

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

      expect(onRenderStub).to.have.been.calledOnce;
    });
  });

  describe('behavior is evented', function() {
    let listenToStub;
    let changeStub;
    let behavior;
    let fooModel;

    beforeEach(function() {
      listenToStub = this.sinon.stub();
      changeStub = this.sinon.stub();

      behavior = new Behavior({}, new View());
      fooModel = new Backbone.Model();

      bindEvents(behavior, fooModel, {
        'change': changeStub
      });

      behavior.listenTo(fooModel, 'foo', listenToStub);
    });

    it('should listenTo events', function() {
      fooModel.trigger('foo');

      expect(listenToStub).to.have.been.calledOnce;
    });

    it('should support bindEntityEvents', function() {
      fooModel.set('foo', 'bar');

      expect(changeStub).to.have.been.calledOnce;
    });

    it('should execute in the specified context', function() {
      fooModel.trigger('foo');

      expect(listenToStub).to.have.been.calledOnce.and.calledOn(behavior);
    });
  });

  describe('#destroy', function() {
    let behavior;
    let view;

    beforeEach(function() {
      view = new View();
      behavior = new Behavior({}, view);
      this.sinon.spy(behavior, '_deleteEntityEventHandlers');
      this.sinon.spy(behavior, 'destroy');
      this.sinon.spy(behavior, 'stopListening');
      this.sinon.spy(view, '_removeBehavior');

      behavior.destroy();
    });

    it('should delete entity event handlers', function() {
      expect(behavior._deleteEntityEventHandlers).to.have.been.calledOnce;
    });

    it('should stopListening', function() {
      expect(behavior.stopListening).to.have.been.calledOnce;
    });

    it('should remove the behavior from the view', function() {
      expect(view._removeBehavior).to.have.been.calledOnce;
    });

    it('should return the behavior', function() {
      expect(behavior.destroy).to.have.returned(behavior);
    });

    it('should destroy an attached behavior and remove it from the view', function() {
      const MyBehavior = Behavior.extend({});
      const MyView = View.extend({
        behaviors: [MyBehavior]
      });
      const myView = new MyView();
      const myBehavior = myView._behaviors[0];

      expect(function() {
        myBehavior.destroy();
      }).to.not.throw();
      expect(myView._behaviors).to.not.include(myBehavior);
    });
  });

});
