import Behavior from '../../modules/behavior';
import CollectionView from '../../modules/collection-view';
import View from '../../modules/view';
import MarionetteError from '../../utils/error';

describe('getUI binding diagnostics', function() {
  function expectUndeclared(getUI) {
    expect(getUI)
      .to.throw(MarionetteError, 'A ui map must be declared before calling getUI().')
      .with.property('code', 'MN0023');
  }

  function expectUnbound(getUI) {
    expect(getUI)
      .to.throw(MarionetteError, 'UI elements must be bound before calling getUI().')
      .with.property('code', 'MN0023');
  }

  function verifyViewClass(ViewClass) {
    const view = new ViewClass();

    expectUnbound(() => view.getUI('target'));

    view.render();

    expect(view.getUI('target')[0]).to.equal(view.el.querySelector('.target'));
    expect(view.getUI('missing')).to.be.undefined;

    view.unbindUIElements();
    expectUnbound(() => view.getUI('target'));

    view.destroy();
  }

  it('requires a ui map to be declared', function() {
    const view = new View();

    expectUndeclared(() => view.getUI('target'));

    view.destroy();
  });

  it('requires View UI elements to be bound', function() {
    const TestView = View.extend({
      template: () => '<button class="target"></button>',
      ui: { target: '.target' },
    });

    verifyViewClass(TestView);
  });

  it('requires CollectionView UI elements to be bound', function() {
    const TestCollectionView = CollectionView.extend({
      template: () => '<button class="target"></button>',
      ui: { target: '.target' },
    });

    verifyViewClass(TestCollectionView);
  });

  it('requires Behavior UI elements to be bound', function() {
    let behavior;
    const TestBehavior = Behavior.extend({
      ui: { target: '.target' },
      initialize() {
        behavior = this;
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template: () => '<button class="target"></button>',
    });
    const view = new TestView();

    expectUnbound(() => behavior.getUI('target'));

    view.render();

    expect(behavior.getUI('target')[0]).to.equal(view.el.querySelector('.target'));
    expect(behavior.getUI('missing')).to.be.undefined;

    view.unbindUIElements();
    expectUnbound(() => behavior.getUI('target'));

    view.destroy();
  });
});
