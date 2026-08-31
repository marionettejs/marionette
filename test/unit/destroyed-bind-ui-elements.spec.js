import Behavior from '../../modules/behavior';
import CollectionView from '../../modules/collection-view';
import View from '../../modules/view';
import MarionetteError from '../../utils/error';

describe('#bindUIElements terminal behavior', function() {
  function buildHost(context, HostClass, onBeforeDestroy) {
    let behavior;
    const ui = context.sinon.spy(() => ({ target: '.target' }));
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

    const query = context.sinon.spy(view, '$');
    const bindBehaviorUIElements = context.sinon.spy(behavior, 'bindUIElements');
    ui.resetHistory();

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
    it(`does not resolve or bind ${ name } UI while destroying`, function() {
      let result;
      let tracked;
      tracked = buildHost(this, HostClass, function() {
        result = this.bindUIElements();
      });

      tracked.view.destroy();

      expect(result).to.equal(tracked.view);
      expect(tracked.ui).not.to.have.been.called;
      expect(tracked.query).not.to.have.been.called;
      expect(tracked.bindBehaviorUIElements).not.to.have.been.called;
    });

    it(`does not resolve or bind ${ name } UI after destruction`, function() {
      const tracked = buildHost(this, HostClass);
      tracked.view.destroy();
      tracked.query.resetHistory();
      tracked.ui.resetHistory();

      const result = tracked.view.bindUIElements();

      expect(result).to.equal(tracked.view);
      expect(tracked.ui).not.to.have.been.called;
      expect(tracked.query).not.to.have.been.called;
      expect(tracked.bindBehaviorUIElements).not.to.have.been.called;
      expectUnbound(() => tracked.view.getUI('target'));
      expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
    });

    it(`keeps ${ name } UI cleanup active while destroying`, function() {
      let hostWasUnbound = false;
      let behaviorWasUnbound = false;
      const tracked = buildHost(this, HostClass, function() {
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

      expect(hostWasUnbound).to.be.true;
      expect(behaviorWasUnbound).to.be.true;
    });

    it(`continues to bind ${ name } and attached Behavior UI while live`, function() {
      const tracked = buildHost(this, HostClass);
      tracked.view.unbindUIElements();
      tracked.query.resetHistory();
      tracked.bindBehaviorUIElements.resetHistory();

      const result = tracked.view.bindUIElements();

      expect(result).to.equal(tracked.view);
      expect(tracked.ui).to.have.been.calledOnce;
      expect(tracked.query).to.have.been.calledThrice;
      expect(tracked.bindBehaviorUIElements).to.have.been.calledOnce;
      expect(tracked.view.getUI('target')[0]).to.equal(tracked.view.el.querySelector('.target'));
      expect(tracked.behavior.getUI('behaviorTarget')[0])
        .to.equal(tracked.view.el.querySelector('.behavior-target'));

      tracked.view.destroy();
    });
  });

  it('allows binding again after a failed before:destroy clears the terminal gate', function() {
    let firstAttempt = true;
    let terminalBindResult;
    let tracked;
    tracked = buildHost(this, View, function() {
      if (!firstAttempt) { return; }

      firstAttempt = false;
      this.unbindUIElements();
      terminalBindResult = this.bindUIElements();
      throw new Error('stop destruction');
    });

    expect(() => tracked.view.destroy()).to.throw('stop destruction');
    expect(terminalBindResult).to.equal(tracked.view);
    expectUnbound(() => tracked.view.getUI('target'));
    tracked.query.resetHistory();
    tracked.ui.resetHistory();
    tracked.bindBehaviorUIElements.resetHistory();

    expect(tracked.view.bindUIElements()).to.equal(tracked.view);
    expect(tracked.ui).to.have.been.calledOnce;
    expect(tracked.query).to.have.been.calledThrice;
    expect(tracked.bindBehaviorUIElements).to.have.been.calledOnce;
    expect(tracked.view.getUI('target')[0]).to.equal(tracked.view.el.querySelector('.target'));

    tracked.view.destroy();
  });

  it('does not bind retained Behavior UI while its host is destroying', function() {
    let result;
    let tracked;
    tracked = buildHost(this, View, function() {
      result = tracked.behavior.bindUIElements();
    });

    tracked.view.destroy();

    expect(result).to.equal(tracked.behavior);
    expect(tracked.query).not.to.have.been.called;
    expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
  });

  it('does not bind retained Behavior UI after its host is destroyed', function() {
    const tracked = buildHost(this, View);
    tracked.view.destroy();
    tracked.query.resetHistory();

    const result = tracked.behavior.bindUIElements();

    expect(result).to.equal(tracked.behavior);
    expect(tracked.query).not.to.have.been.called;
    expectUnbound(() => tracked.behavior.getUI('behaviorTarget'));
  });

  it('continues to bind Behavior UI directly while its host is live', function() {
    const tracked = buildHost(this, View);
    tracked.behavior.unbindUIElements();
    tracked.query.resetHistory();

    const result = tracked.behavior.bindUIElements();

    expect(result).to.equal(tracked.behavior);
    expect(tracked.query).to.have.been.calledTwice;
    expect(tracked.behavior.getUI('behaviorTarget')[0])
      .to.equal(tracked.view.el.querySelector('.behavior-target'));

    tracked.view.destroy();
  });
});
