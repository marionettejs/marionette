import { vi, describe, it, expect } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import '../setup/backbone.js';
import Backbone from 'backbone';

import Behavior from '../../src/modules/behavior';
import CollectionView from '../../src/modules/collection-view';
import Region from '../../src/modules/region';
import View from '../../src/modules/view';

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

  it('keeps host constructor arguments separate from explicit Behavior state', function() {
    const options = { source: 'options' };
    const extra = { source: 'extra' };
    const initialize = vi.fn(function(receivedOptions, receivedExtra) {
      expect(this.behaviorState).to.equal('set explicitly');
      expect(receivedOptions).to.equal(options);
      expect(receivedExtra).to.equal(extra);
    });
    const TestBehavior = Behavior.extend({
      initialize(behaviorOptions, hostView) {
        expect(behaviorOptions).to.deep.equal({});
        hostView.behaviorState = 'set explicitly';
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      initialize,
    });

    const view = new TestView(options, extra);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith(options, extra);

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

  describe.each([
    ['View', View],
    ['CollectionView', CollectionView],
  ])('%s initialize-time destruction', function(name, HostView) {
    it('keeps destruction terminal after initialize returns', function() {
      const lifecycle = [];
      const model = new Backbone.Model();
      const onModelEvent = vi.fn();

      const TestBehavior = Behavior.extend({
        onInitialize() {
          lifecycle.push('behavior:onInitialize');
        },
        onDestroy() {
          lifecycle.push('behavior:onDestroy');
        },
      });
      const TestView = HostView.extend({
        behaviors: [TestBehavior],
        modelEvents: {
          ping: 'onModelEvent',
        },
        onModelEvent,
        initialize() {
          lifecycle.push('view:initialize');
          this.destroy();
        },
      });

      const view = new TestView({ model });
      model.trigger('ping');

      expect(view.isDestroyed()).to.be.true;
      expect(lifecycle).to.deep.equal([
        'view:initialize',
        'behavior:onDestroy',
      ]);
      expect(onModelEvent).not.toHaveBeenCalled();
      if (view instanceof CollectionView) {
        expect(view.getEmptyRegion().isDestroyed()).to.be.true;
      }
    });
  });

  it('resolves callable events after Behavior initialize and before host initialize', function() {
    const lifecycle = [];
    const onAction = vi.fn();
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
    expect(onAction).toHaveBeenCalledTimes(1);

    view.destroy();
  });

  it('resolves callable triggers after Behavior initialize and before host initialize', function() {
    const lifecycle = [];
    const onAction = vi.fn();
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
    expect(onAction).toHaveBeenCalledTimes(1);

    view.destroy();
  });

  it('keeps one instance through render and attachment transitions', function() {
    setFixtures('<div id="behavior-region"></div>');
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
    const hostEvent = vi.fn();
    const modelEvent = vi.fn();
    const domEvent = vi.fn();
    const beforeDestroy = vi.fn();
    const destroy = vi.fn();
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
    expect(hostEvent).toHaveBeenCalledTimes(1);
    expect(modelEvent).toHaveBeenCalledTimes(1);
    expect(domEvent).toHaveBeenCalledTimes(1);

    vi.spyOn(behavior, 'stopListening');
    expect(behavior.destroy()).to.equal(behavior);

    view.triggerMethod('host:event');
    model.set('value', 2);
    view.el.querySelector('.action').click();
    view.destroy();

    expect(hostEvent).toHaveBeenCalledTimes(1);
    expect(modelEvent).toHaveBeenCalledTimes(1);
    expect(domEvent).toHaveBeenCalledTimes(1);
    expect(beforeDestroy).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    expect(behavior.stopListening).toHaveBeenCalledTimes(1);
  });

  it('keeps a nested Behavior host-owned after directly removing its declarer', function() {
    const parentHostEvent = vi.fn();
    const nestedHostEvent = vi.fn();
    const parentBeforeDestroy = vi.fn();
    const nestedBeforeDestroy = vi.fn();
    const parentDestroy = vi.fn();
    const nestedDestroy = vi.fn();
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
    expect(parentHostEvent).toHaveBeenCalledTimes(1);
    expect(parentHostEvent.mock.contexts).toContain(parentBehavior);
    expect(nestedHostEvent).toHaveBeenCalledTimes(1);
    expect(nestedHostEvent.mock.contexts).toContain(nestedBehavior);

    parentBehavior.destroy();

    view.triggerMethod('host:event');

    expect(parentHostEvent).toHaveBeenCalledTimes(1);
    expect(nestedHostEvent).toHaveBeenCalledTimes(2);

    view.destroy();
    view.destroy();

    expect(parentBeforeDestroy).not.toHaveBeenCalled();
    expect(parentDestroy).not.toHaveBeenCalled();
    expect(nestedBeforeDestroy).toHaveBeenCalledTimes(1);
    expect(nestedBeforeDestroy.mock.contexts).toContain(nestedBehavior);
    expect(nestedDestroy).toHaveBeenCalledTimes(1);
    expect(nestedDestroy.mock.contexts).toContain(nestedBehavior);
  });

  it('cleans up top-level and nested Behaviors once in host destroy order', function() {
    setFixtures('<div id="destroy-region"></div>');
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
    vi.spyOn(parentBehavior, 'stopListening');
    vi.spyOn(nestedBehavior, 'stopListening');

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
    expect(parentBehavior.stopListening).toHaveBeenCalledTimes(1);
    expect(nestedBehavior.stopListening).toHaveBeenCalledTimes(1);
    expect(region.hasView()).to.be.false;

    region.destroy();
  });
});
