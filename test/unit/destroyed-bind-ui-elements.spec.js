import { vi, describe, it, expect } from 'vitest';
import { Behavior } from 'marionette';
import { CollectionView } from 'marionette';
import { View } from 'marionette';
import { MarionetteError } from '@mnjs/utils';

describe('#bindUIElements terminal behavior', function() {
  function buildHost(context, HostClass, onBeforeDestroy) {
    let behavior;
    const ui = vi.fn(() => ({ target: '.target' }));
    const TestBehavior = Behavior.extend({
      ui: { behaviorTarget: '.behavior-target' },
      initialize() {
        behavior = this;
      },
    });
    const TestHost = HostClass.extend({
      behaviors: [TestBehavior],
      onBeforeDestroy,
      template: () => '<button class="target"></button><button class="behavior-target"></button>',
      ui,
    });
    const view = new TestHost();

    view.render();

    const query = vi.spyOn(view, '$');
    const bindBehaviorUIElements = vi.spyOn(behavior, 'bindUIElements');
    ui.mockClear();

    return { behavior, bindBehaviorUIElements, query, ui, view };
  }

  function expectUnbound(getUI) {
    expect(getUI)
      .to.throw(MarionetteError, 'UI elements must be bound before calling getUI().')
      .with.property('code', 'MN0023');
  }

  [
    ['View', View],
    ['CollectionView', CollectionView],
  ].forEach(([name, HostClass]) => {
    it(`does not resolve or bind ${ name } UI while destroying`, function(testContext) {
      let result;
      let tracked;
      tracked = buildHost(testContext, HostClass, function() {
        result = this.bindUIElements();
      });

      tracked.view.destroy();

      expect(result).to.equal(tracked.view);
      expect(tracked.ui).not.toHaveBeenCalled();
      expect(tracked.query).not.toHaveBeenCalled();
      expect(tracked.bindBehaviorUIElements).not.toHaveBeenCalled();
    });

    it(`does not resolve or bind ${ name } UI after destruction`, function(testContext) {
      const tracked = buildHost(testContext, HostClass);
      tracked.view.destroy();
      tracked.query.mockClear();
      tracked.ui.mockClear();

      const result = tracked.view.bindUIElements();

      expect(result).to.equal(tracked.view);
      expect(tracked.ui).not.toHaveBeenCalled();
      expect(tracked.query).not.toHaveBeenCalled();
      expect(tracked.bindBehaviorUIElements).not.toHaveBeenCalled();
      expectUnbound(() => tracked.view.getUI('target'));
      expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
    });

    it(`keeps ${ name } UI cleanup active while destroying`, function(testContext) {
      let hostWasUnbound = false;
      let behaviorWasUnbound = false;
      const tracked = buildHost(testContext, HostClass, function() {
        expect(this.getUI('target')[0]).to.equal(this.el.querySelector('.target'));
        expect(tracked.behavior.getUI('behaviorTarget')[0])
          .to.equal(this.el.querySelector('.behavior-target'));
        expect(this.unbindUIElements()).to.equal(this);
        hostWasUnbound = true;
        expectUnbound(() => this.getUI('target'));
        behaviorWasUnbound = true;
        expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
      });

      tracked.view.destroy();

      expect(hostWasUnbound).toBe(true);
      expect(behaviorWasUnbound).toBe(true);
    });

    it(`continues to bind ${ name } and attached Behavior UI while live`, function(testContext) {
      const tracked = buildHost(testContext, HostClass);
      tracked.view.unbindUIElements();
      tracked.query.mockClear();
      tracked.bindBehaviorUIElements.mockClear();

      const result = tracked.view.bindUIElements();

      expect(result).to.equal(tracked.view);
      expect(tracked.ui).toHaveBeenCalledTimes(1);
      expect(tracked.query).toHaveBeenCalledTimes(3);
      expect(tracked.bindBehaviorUIElements).toHaveBeenCalledTimes(1);
      expect(tracked.view.getUI('target')[0]).to.equal(tracked.view.el.querySelector('.target'));
      expect(tracked.behavior.getUI('behaviorTarget')[0])
        .to.equal(tracked.view.el.querySelector('.behavior-target'));

      tracked.view.destroy();
    });
  });

  it('does not bind retained Behavior UI while its host is destroying', function(testContext) {
    let result;
    let tracked;
    tracked = buildHost(testContext, View, function() {
      result = tracked.behavior.bindUIElements();
    });

    tracked.view.destroy();

    expect(result).to.equal(tracked.behavior);
    expect(tracked.query).not.toHaveBeenCalled();
    expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
  });

  it('does not bind retained Behavior UI after its host is destroyed', function(testContext) {
    const tracked = buildHost(testContext, View);
    tracked.view.destroy();
    tracked.query.mockClear();

    const result = tracked.behavior.bindUIElements();

    expect(result).to.equal(tracked.behavior);
    expect(tracked.query).not.toHaveBeenCalled();
    expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
  });

  it('continues to bind Behavior UI directly while its host is live', function(testContext) {
    const tracked = buildHost(testContext, View);
    tracked.behavior.unbindUIElements();
    tracked.query.mockClear();

    const result = tracked.behavior.bindUIElements();

    expect(result).to.equal(tracked.behavior);
    expect(tracked.query).toHaveBeenCalledTimes(2);
    expect(tracked.behavior.getUI('behaviorTarget')[0])
      .to.equal(tracked.view.el.querySelector('.behavior-target'));

    tracked.view.destroy();
  });
});
