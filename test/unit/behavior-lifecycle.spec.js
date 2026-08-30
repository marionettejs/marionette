import Backbone from 'backbone';

import Behavior from '../../modules/behavior';
import CollectionView from '../../modules/collection-view';
import Region from '../../modules/region';
import View from '../../modules/view';

describe('Behavior lifecycle contract', function() {
  it('initializes around its host View in public lifecycle order', function() {
    const lifecycle = [];
    let behavior;

    const TestBehavior = Behavior.extend({
      initialize(options, hostView) {
        behavior = this;
        expect(this.view).to.equal(hostView);
        lifecycle.push('behavior:initialize');
      },
      onInitialize() {
        lifecycle.push('behavior:onInitialize');
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      initialize() {
        lifecycle.push('view:initialize');
      },
    });

    const view = new TestView();

    expect(lifecycle).to.deep.equal([
      'behavior:initialize',
      'view:initialize',
      'behavior:onInitialize',
    ]);
    expect(behavior.view).to.equal(view);
    expect(behavior.el).to.equal(view.el);

    view.destroy();
  });

  describe.each([
    ['View', View],
    ['CollectionView', CollectionView],
  ])('%s preinitialize order', function(name, HostView) {
    it('runs host preinitialize before constructing Behaviors', function() {
      const lifecycle = [];

      const TestBehavior = Behavior.extend({
        initialize(options, hostView) {
          lifecycle.push(`behavior:initialize:${ hostView.preinitialized }`);
        },
      });
      const TestView = HostView.extend({
        behaviors: [TestBehavior],
        preinitialize() {
          this.preinitialized = true;
          lifecycle.push('view:preinitialize');
        },
        initialize() {
          lifecycle.push('view:initialize');
        },
      });

      const view = new TestView();

      expect(lifecycle).to.deep.equal([
        'view:preinitialize',
        'behavior:initialize:true',
        'view:initialize',
      ]);

      view.destroy();
    });
  });

  it('resolves callable events after Behavior initialize and before host initialize', function() {
    const lifecycle = [];
    const onAction = this.sinon.spy();
    const el = document.createElement('div');
    el.innerHTML = '<button class="initialized-action">Action</button>';

    const TestBehavior = Behavior.extend({
      initialize() {
        this.actionSelector = '.initialized-action';
        lifecycle.push('behavior:initialize');
      },
      events() {
        lifecycle.push(`behavior:events:${ this.actionSelector }`);
        return {
          [`click ${ this.actionSelector }`]: 'onAction',
        };
      },
      onAction,
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      initialize() {
        lifecycle.push('view:initialize');
      },
    });

    const view = new TestView({ el });
    el.querySelector('.initialized-action').click();

    expect(lifecycle).to.deep.equal([
      'behavior:initialize',
      'behavior:events:.initialized-action',
      'view:initialize',
    ]);
    expect(onAction).to.have.been.calledOnce;

    view.destroy();
  });

  it('resolves callable triggers after Behavior initialize and before host initialize', function() {
    const lifecycle = [];
    const onAction = this.sinon.spy();
    const el = document.createElement('div');
    el.innerHTML = '<button class="initialized-action">Action</button>';

    const TestBehavior = Behavior.extend({
      initialize() {
        this.actionSelector = '.initialized-action';
        lifecycle.push('behavior:initialize');
      },
      triggers() {
        lifecycle.push(`behavior:triggers:${ this.actionSelector }`);
        return {
          [`click ${ this.actionSelector }`]: 'action',
        };
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      initialize() {
        lifecycle.push('view:initialize');
      },
      onAction,
    });

    const view = new TestView({ el });
    el.querySelector('.initialized-action').click();

    expect(lifecycle).to.deep.equal([
      'behavior:initialize',
      'behavior:triggers:.initialized-action',
      'view:initialize',
    ]);
    expect(onAction).to.have.been.calledOnce;

    view.destroy();
  });

  it('keeps one instance through render and attachment transitions', function() {
    this.setFixtures('<div id="behavior-region"></div>');
    const lifecycle = [];
    let behavior;

    const TestBehavior = Behavior.extend({
      initialize() {
        behavior = this;
        lifecycle.push('behavior:initialize');
      },
      onBeforeRender() {
        lifecycle.push('behavior:before:render');
      },
      onRender() {
        lifecycle.push('behavior:render');
      },
      onBeforeAttach() {
        lifecycle.push('behavior:before:attach');
      },
      onAttach() {
        lifecycle.push('behavior:attach');
      },
      onBeforeDetach() {
        lifecycle.push('behavior:before:detach');
      },
      onDetach() {
        lifecycle.push('behavior:detach');
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return '<span>content</span>';
      },
      onBeforeRender() {
        lifecycle.push('view:before:render');
      },
      onRender() {
        lifecycle.push('view:render');
      },
      onBeforeAttach() {
        lifecycle.push('view:before:attach');
      },
      onAttach() {
        lifecycle.push('view:attach');
      },
      onBeforeDetach() {
        lifecycle.push('view:before:detach');
      },
      onDetach() {
        lifecycle.push('view:detach');
      },
    });
    const view = new TestView();
    const initialBehavior = behavior;
    const region = new Region({ el: '#behavior-region' });
    lifecycle.length = 0;

    region.show(view);
    view.render();
    region.detachView();
    region.show(view);

    expect(behavior).to.equal(initialBehavior);
    expect(lifecycle).to.deep.equal([
      'view:before:render',
      'behavior:before:render',
      'view:render',
      'behavior:render',
      'view:before:attach',
      'behavior:before:attach',
      'view:attach',
      'behavior:attach',
      'view:before:render',
      'behavior:before:render',
      'view:render',
      'behavior:render',
      'view:before:detach',
      'behavior:before:detach',
      'view:detach',
      'behavior:detach',
      'view:before:attach',
      'behavior:before:attach',
      'view:attach',
      'behavior:attach',
    ]);

    region.destroy();
  });

  it('stops host, entity, and DOM participation after direct cleanup', function() {
    const model = new Backbone.Model();
    const hostEvent = this.sinon.spy();
    const modelEvent = this.sinon.spy();
    const domEvent = this.sinon.spy();
    const beforeDestroy = this.sinon.spy();
    const destroy = this.sinon.spy();
    let behavior;

    const TestBehavior = Behavior.extend({
      events: {
        'click .action': 'onAction',
      },
      modelEvents: {
        change: 'onModelChange',
      },
      initialize() {
        behavior = this;
      },
      onAction: domEvent,
      onModelChange: modelEvent,
      onHostEvent: hostEvent,
      onBeforeDestroy: beforeDestroy,
      onDestroy: destroy,
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return '<button class="action">Action</button>';
      },
    });
    const view = new TestView({ model });
    view.render();

    view.triggerMethod('host:event');
    model.set('value', 1);
    view.el.querySelector('.action').click();
    expect(hostEvent).to.have.been.calledOnce;
    expect(modelEvent).to.have.been.calledOnce;
    expect(domEvent).to.have.been.calledOnce;

    this.sinon.spy(behavior, 'stopListening');
    expect(behavior.destroy()).to.equal(behavior);

    view.triggerMethod('host:event');
    model.set('value', 2);
    view.el.querySelector('.action').click();
    view.destroy();

    expect(hostEvent).to.have.been.calledOnce;
    expect(modelEvent).to.have.been.calledOnce;
    expect(domEvent).to.have.been.calledOnce;
    expect(beforeDestroy).to.not.have.been.called;
    expect(destroy).to.not.have.been.called;
    expect(behavior.stopListening).to.have.been.calledOnce;
  });

  it('keeps a nested Behavior host-owned after directly removing its declarer', function() {
    const parentHostEvent = this.sinon.spy();
    const nestedHostEvent = this.sinon.spy();
    const parentBeforeDestroy = this.sinon.spy();
    const nestedBeforeDestroy = this.sinon.spy();
    const parentDestroy = this.sinon.spy();
    const nestedDestroy = this.sinon.spy();
    let parentBehavior;
    let nestedBehavior;

    const NestedBehavior = Behavior.extend({
      initialize() {
        nestedBehavior = this;
      },
      onHostEvent: nestedHostEvent,
      onBeforeDestroy: nestedBeforeDestroy,
      onDestroy: nestedDestroy,
    });
    const ParentBehavior = Behavior.extend({
      behaviors: [NestedBehavior],
      initialize() {
        parentBehavior = this;
      },
      onHostEvent: parentHostEvent,
      onBeforeDestroy: parentBeforeDestroy,
      onDestroy: parentDestroy,
    });
    const TestView = View.extend({ behaviors: [ParentBehavior] });
    const view = new TestView();

    expect(parentBehavior.view).to.equal(view);
    expect(nestedBehavior.view).to.equal(view);
    view.triggerMethod('host:event');
    expect(parentHostEvent).to.have.been.calledOnce.and.calledOn(parentBehavior);
    expect(nestedHostEvent).to.have.been.calledOnce.and.calledOn(nestedBehavior);

    parentBehavior.destroy();

    view.triggerMethod('host:event');

    expect(parentHostEvent).to.have.been.calledOnce;
    expect(nestedHostEvent).to.have.been.calledTwice;

    view.destroy();
    view.destroy();

    expect(parentBeforeDestroy).to.not.have.been.called;
    expect(parentDestroy).to.not.have.been.called;
    expect(nestedBeforeDestroy).to.have.been.calledOnce.and.calledOn(nestedBehavior);
    expect(nestedDestroy).to.have.been.calledOnce.and.calledOn(nestedBehavior);
  });

  it('cleans up top-level and nested Behaviors once in host destroy order', function() {
    this.setFixtures('<div id="destroy-region"></div>');
    const lifecycle = [];
    const behaviors = [];

    const NestedBehavior = Behavior.extend({
      initialize() {
        behaviors.push(this);
      },
      onBeforeDestroy(view) {
        expect(view.isDestroyed()).to.be.false;
        lifecycle.push('nested:before:destroy');
      },
      onDestroy(view) {
        expect(view.isDestroyed()).to.be.true;
        lifecycle.push('nested:destroy');
      },
    });
    const ParentBehavior = Behavior.extend({
      behaviors: [NestedBehavior],
      initialize() {
        behaviors.push(this);
      },
      onBeforeDestroy(view) {
        expect(view.isDestroyed()).to.be.false;
        lifecycle.push('parent:before:destroy');
      },
      onDestroy(view) {
        expect(view.isDestroyed()).to.be.true;
        lifecycle.push('parent:destroy');
      },
    });
    const TestView = View.extend({
      behaviors: [ParentBehavior],
      template() {
        return '<span>content</span>';
      },
      onBeforeDestroy() {
        lifecycle.push('view:before:destroy');
      },
      onDestroy() {
        lifecycle.push('view:destroy');
      },
    });
    const view = new TestView();
    const region = new Region({ el: '#destroy-region' });
    region.show(view);
    const parentBehavior = behaviors[0];
    const nestedBehavior = behaviors[1];
    expect(parentBehavior.view).to.equal(view);
    expect(nestedBehavior.view).to.equal(view);
    this.sinon.spy(parentBehavior, 'stopListening');
    this.sinon.spy(nestedBehavior, 'stopListening');

    expect(view.destroy()).to.equal(view);
    expect(view.destroy()).to.equal(view);

    expect(lifecycle).to.deep.equal([
      'view:before:destroy',
      'parent:before:destroy',
      'nested:before:destroy',
      'view:destroy',
      'parent:destroy',
      'nested:destroy',
    ]);
    expect(parentBehavior.stopListening).to.have.been.calledOnce;
    expect(nestedBehavior.stopListening).to.have.been.calledOnce;
    expect(region.hasView()).to.be.false;

    region.destroy();
  });
});
