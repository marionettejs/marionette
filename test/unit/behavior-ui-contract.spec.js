import Behavior from '../../src/modules/behavior';
import CollectionView from '../../src/modules/collection-view';
import View from '../../src/modules/view';

describe('Behavior UI contract', function() {
  it('delegates host-only and host-winning ui references on first construction', function() {
    const onHostOnly = sinon.stub();
    const onShared = sinon.stub();
    const TestBehavior = Behavior.extend({
      ui: {
        shared: '.behavior-shared',
      },
      events: {
        'click @ui.hostOnly': 'onHostOnly',
        'click @ui.shared': 'onShared',
      },
      onHostOnly,
      onShared,
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return [
          '<button class="host-only"></button>',
          '<button class="host-shared"></button>',
          '<button class="behavior-shared"></button>',
        ].join('');
      },
      ui: {
        hostOnly: '.host-only',
        shared: '.host-shared',
      },
    });
    const view = new TestView();

    view.render();
    view.el.querySelector('.host-only').click();
    view.el.querySelector('.behavior-shared').click();
    expect(onHostOnly).to.have.been.calledOnce;
    expect(onShared).not.to.have.been.called;

    view.el.querySelector('.host-shared').click();
    expect(onShared).to.have.been.calledOnce;

    view.destroy();
  });

  it('rejects a missing Behavior DOM event handler during host construction', function() {
    const TestBehavior = Behavior.extend({
      events: {
        click: 'missingHandler',
      },
    });
    const TestView = View.extend({ behaviors: [TestBehavior] });

    expect(() => new TestView())
      .to.throw('The handler "missingHandler" for "click" must resolve to a function.')
      .with.property('code', 'MN0019');
  });

  it('provides the host element while evaluating functional Behavior ui', function() {
    const onClick = sinon.stub();
    const ui = sinon.spy(function() {
      expect(this.el).to.equal(this.view.el);
      return { target: '.target' };
    });
    const TestBehavior = Behavior.extend({
      ui,
      events: { 'click @ui.target': 'onClick' },
      onClick,
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return '<button class="target"></button>';
      },
    });
    const view = new TestView();

    expect(ui).to.have.been.calledOnce;
    view.render();
    view.el.querySelector('.target').click();
    expect(onClick).to.have.been.calledOnce;

    view.destroy();
  });

  it('captures merged UI during host construction with host keys winning', function() {
    const lifecycle = [];
    let behavior;
    let behaviorSelector = '.behavior-first';
    let hostSelector = '.host-first';

    const TestBehavior = Behavior.extend({
      ui() {
        return {
          behaviorOnly: behaviorSelector,
          shared: '.behavior-shared',
        };
      },
      initialize() {
        behavior = this;
        lifecycle.push('behavior:initialize');
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return [
          '<span class="behavior-first"></span>',
          '<span class="behavior-second"></span>',
          '<span class="host-first"></span>',
          '<span class="host-second"></span>',
          '<span class="host-shared"></span>',
        ].join('');
      },
      ui() {
        return {
          hostOnly: hostSelector,
          shared: '.host-shared',
        };
      },
      initialize() {
        lifecycle.push('view:initialize');
      },
    });
    const view = new TestView();

    behaviorSelector = '.behavior-second';
    hostSelector = '.host-second';

    expect(lifecycle).to.deep.equal([
      'behavior:initialize',
      'view:initialize',
    ]);
    expect(behavior.ui).to.deep.equal({
      behaviorOnly: '.behavior-first',
      hostOnly: '.host-first',
      shared: '.host-shared',
    });

    view.render();

    expect(behavior.ui.behaviorOnly[0]).to.equal(view.el.querySelector('.behavior-first'));
    expect(behavior.ui.hostOnly[0]).to.equal(view.el.querySelector('.host-first'));
    expect(behavior.ui.shared[0]).to.equal(view.el.querySelector('.host-shared'));
    expect(view.ui.hostOnly[0]).to.equal(view.el.querySelector('.host-second'));
    expect(view.ui.hostOnly[0]).to.not.equal(behavior.ui.hostOnly[0]);

    view.destroy();
  });

  it('exposes selectors before binding and host-scoped element collections after render', function() {
    let behavior;

    const TestBehavior = Behavior.extend({
      ui: {
        behaviorOnly: '.behavior-only',
        shared: '.behavior-shared',
      },
      initialize() {
        behavior = this;
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return '<button class="behavior-only"></button><button class="host-shared"></button>';
      },
      ui: {
        shared: '.host-shared',
      },
    });
    const view = new TestView();

    expect(behavior.ui).to.deep.equal({
      behaviorOnly: '.behavior-only',
      shared: '.host-shared',
    });

    view.render();

    expect(behavior.ui.behaviorOnly).to.have.length(1);
    expect(behavior.ui.behaviorOnly[0]).to.equal(view.el.querySelector('.behavior-only'));
    expect(behavior.ui.shared).to.have.length(1);
    expect(behavior.ui.shared[0]).to.equal(view.el.querySelector('.host-shared'));

    view.destroy();
  });

  it('pins only that pre-rendered hosts bind host UI before Behavior construction', function() {
    this.setFixtures('<div id="prerendered-host"><button class="shared"></button></div>');
    const hostElement = document.querySelector('#prerendered-host');
    const sharedElement = hostElement.querySelector('.shared');
    let observedHostUI;
    let observedRenderedState;

    const TestBehavior = Behavior.extend({
      initialize() {
        observedHostUI = this.view.ui.shared[0];
        observedRenderedState = this.view.isRendered();
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      ui: {
        shared: '.shared',
      },
    });
    const view = new TestView({ el: hostElement });

    expect(observedRenderedState).to.be.true;
    expect(observedHostUI).to.equal(sharedElement);

    view.destroy();
  });

  it('binds CollectionView Behavior UI automatically only when rendering a template', function() {
    let templatedBehavior;
    let templateLessBehavior;

    const TemplatedBehavior = Behavior.extend({
      ui: {
        action: '.action',
      },
      initialize() {
        templatedBehavior = this;
      },
    });
    const TemplatedCollectionView = CollectionView.extend({
      behaviors: [TemplatedBehavior],
      template() {
        return '<button class="action templated"></button>';
      },
    });
    const templatedView = new TemplatedCollectionView();

    expect(templatedBehavior.ui.action).to.equal('.action');
    templatedView.render();
    expect(templatedBehavior.ui.action[0]).to.equal(templatedView.el.querySelector('.templated'));

    const templateLessElement = document.createElement('div');
    templateLessElement.innerHTML = '<button class="action template-less"></button>';
    const TemplateLessBehavior = Behavior.extend({
      ui: {
        action: '.action',
      },
      initialize() {
        templateLessBehavior = this;
      },
    });
    const TemplateLessCollectionView = CollectionView.extend({
      behaviors: [TemplateLessBehavior],
    });
    const templateLessView = new TemplateLessCollectionView({ el: templateLessElement });

    expect(templateLessBehavior.ui.action).to.equal('.action');
    templateLessView.render();
    expect(templateLessBehavior.ui.action).to.equal('.action');

    templateLessView.bindUIElements();
    expect(templateLessBehavior.ui.action[0]).to.equal(templateLessElement.querySelector('.template-less'));

    templatedView.destroy();
    templateLessView.destroy();
  });

  it('rebinds Behavior UI to replacement elements after host rerender', function() {
    let behavior;
    let renderCount = 0;

    const TestBehavior = Behavior.extend({
      ui: {
        action: '.action',
      },
      initialize() {
        behavior = this;
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        renderCount += 1;
        return `<button class="action" data-render="${renderCount}"></button>`;
      },
    });
    const view = new TestView();

    view.render();
    const firstElement = behavior.ui.action[0];
    const firstCollection = behavior.ui.action;

    view.render();
    const secondElement = behavior.ui.action[0];

    expect(firstCollection[0]).to.equal(firstElement);
    expect(view.el.contains(firstElement)).to.be.false;
    expect(secondElement).to.not.equal(firstElement);
    expect(secondElement.dataset.render).to.equal('2');
    expect(secondElement).to.equal(view.el.querySelector('.action'));

    view.destroy();
  });

  it('limits Behavior UI lookup to the host element', function() {
    this.setFixtures('<div id="behavior-host"></div><button class="action outside"></button>');
    let behavior;

    const TestBehavior = Behavior.extend({
      ui: {
        action: '.action',
      },
      initialize() {
        behavior = this;
      },
    });
    const TestView = View.extend({
      behaviors: [TestBehavior],
      template() {
        return '<button class="action inside"></button>';
      },
    });
    const view = new TestView({ el: document.querySelector('#behavior-host') });
    view.render();

    expect(document.querySelectorAll('.action')).to.have.length(2);
    expect(behavior.ui.action).to.have.length(1);
    expect(behavior.ui.action[0]).to.equal(view.el.querySelector('.inside'));
    expect(behavior.ui.action[0]).to.not.equal(document.querySelector('.outside'));

    view.destroy();
  });
});
