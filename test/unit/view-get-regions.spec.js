import { Behavior, Region, View } from '../../src/index';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

function createTrackedView(context) {
  const template = context.sinon.spy(() => '<div class="content">Content</div>');
  const beforeRender = context.sinon.spy();
  const render = context.sinon.spy();
  const bindBehaviorUIElements = context.sinon.spy();
  const TestBehavior = Behavior.extend({ bindUIElements: bindBehaviorUIElements });
  const regions = Object.create({ inherited: '.inherited' });
  Object.assign(regions, {
    constructor: '.constructor',
    content: '.content',
    length: '.length',
    toString: '.to-string',
  });
  const view = new View({
    behaviors: [TestBehavior],
    regions,
    template,
    ui: { content: '.content' },
  });
  const getTemplate = context.sinon.spy(view, 'getTemplate');
  const bindUIElements = context.sinon.spy(view, 'bindUIElements');
  view.on('before:render', beforeRender);
  view.on('render', render);

  return {
    beforeRender,
    bindBehaviorUIElements,
    bindUIElements,
    getTemplate,
    render,
    template,
    view,
  };
}

function resetRenderSpies(tracked) {
  tracked.beforeRender.resetHistory();
  tracked.bindBehaviorUIElements.resetHistory();
  tracked.bindUIElements.resetHistory();
  tracked.getTemplate.resetHistory();
  tracked.render.resetHistory();
  tracked.template.resetHistory();
}

function expectNoRenderSideEffects(tracked, expectedState, html) {
  expect(tracked.getTemplate).to.not.have.been.called;
  expect(tracked.template).to.not.have.been.called;
  expect(tracked.beforeRender).to.not.have.been.called;
  expect(tracked.render).to.not.have.been.called;
  expect(tracked.bindUIElements).to.not.have.been.called;
  expect(tracked.bindBehaviorUIElements).to.not.have.been.called;
  expect(tracked.view.el.innerHTML).to.equal(html);
  expect(state(tracked.view)).to.deep.equal(expectedState);
}

describe('View#getRegions', function() {
  it('returns safe own-key snapshots without rendering an unrendered View', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;

    const first = view.getRegions();
    expect(Object.keys(first)).to.deep.equal([
      'constructor',
      'content',
      'length',
      'toString',
    ]);
    expect(Object.getPrototypeOf(first)).to.equal(Object.prototype);
    expect(first).not.to.have.own.property('inherited');
    const contentRegion = first.content;
    delete first.content;
    first.added = 'snapshot only';
    const unchanged = view.getRegions();
    expect(unchanged).to.have.own.property('content', contentRegion);
    expect(unchanged).not.to.have.own.property('added');

    const dynamicRegion = view.addRegion('dynamic', '.dynamic');
    const second = view.getRegions();
    expect(second).not.to.equal(first);
    expect(first).not.to.have.own.property('dynamic');
    expect(second).to.have.own.property('dynamic', dynamicRegion);
    view.removeRegion('dynamic');
    expect(view.getRegions()).not.to.have.own.property('dynamic');
    expect(second).to.have.own.property('dynamic', dynamicRegion);

    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);

    view.destroy();
  });

  it('does not change a rendered View while snapshotting its Regions', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    view.render();
    const html = view.el.innerHTML;
    resetRenderSpies(tracked);

    const first = view.getRegions();
    const second = view.getRegions();

    expect(second).not.to.equal(first);
    expect(second.content).to.equal(first.content);
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: true,
    }, html);

    view.destroy();
  });

  it('returns fresh empty snapshots without rendering a destroyed View', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    view.destroy();
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;
    const renderMethod = this.sinon.spy(view, 'render');

    const first = view.getRegions();
    const second = view.getRegions();

    expect(first).to.deep.equal({});
    expect(second).to.deep.equal({});
    expect(second).not.to.equal(first);
    expect(renderMethod).to.not.have.been.called;
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: true,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);
  });
});

describe('View#emptyRegions', function() {
  it('renders before calling overridable getRegions and emptying its snapshot', function() {
    const regions = [];
    const empty = this.sinon.spy(function() {
      return Region.prototype.empty.apply(this, arguments);
    });
    const TrackingRegion = Region.extend({
      initialize() {
        regions.push(this);
      },
      empty,
    });
    const EmptyingView = View.extend({
      getRegions: this.sinon.spy(function() {
        return View.prototype.getRegions.call(this);
      }),
      onRender() {
        this.addRegion('late', { el: '.late', regionClass: TrackingRegion });
      },
      render: this.sinon.spy(function() {
        return View.prototype.render.call(this);
      }),
      template: () => `
        <div class="content">Content</div>
        <div class="late">Late</div>
      `,
    });
    const view = new EmptyingView({
      regions: {
        content: { el: '.content', regionClass: TrackingRegion },
      },
    });

    const result = view.emptyRegions();

    expect(Object.keys(result)).to.deep.equal(['content', 'late']);
    expect(result.content).to.equal(regions[0]);
    expect(result.late).to.equal(regions[1]);
    expect(view.render).to.have.been.calledOnce;
    expect(view.getRegions)
      .to.have.been.calledOnce
      .and.calledOn(view)
      .and.calledWithExactly();
    expect(empty).to.have.been.calledTwice;
    expect(empty.getCall(0).thisValue).to.equal(regions[0]);
    expect(empty.getCall(0).args).to.deep.equal([]);
    expect(empty.getCall(1).thisValue).to.equal(regions[1]);
    expect(empty.getCall(1).args).to.deep.equal([]);
    expect(view.render).to.have.been.calledBefore(view.getRegions);
    expect(view.getRegions).to.have.been.calledBefore(empty);
    expect(view.isRendered()).to.be.true;
    expect(view.$('.content')[0].innerHTML).to.equal('');
    expect(view.$('.late')[0].innerHTML).to.equal('');

    view.destroy();
  });

  it('stops before getRegions and Region emptying when render throws', function() {
    const error = new Error('render failed');
    const region = new Region({ el: '.content' });
    const getRegions = this.sinon.spy(() => ({ content: region }));
    const TestView = View.extend({ getRegions });
    const view = new TestView({ regions: { content: region } });
    this.sinon.spy(region, 'empty');
    this.sinon.stub(view, 'render').throws(error);

    expect(() => view.emptyRegions()).to.throw(error);
    expect(getRegions).to.not.have.been.called;
    expect(region.empty).to.not.have.been.called;
    expect(view.isRendered()).to.be.false;

    view.destroy();
  });

  it('stops before Region emptying when the getRegions override throws', function() {
    const error = new Error('getRegions failed');
    let region;
    const TrackingRegion = Region.extend({
      initialize() {
        region = this;
      },
    });
    const getRegions = this.sinon.spy(() => { throw error; });
    const TestView = View.extend({
      getRegions,
      template: () => '<div class="content"></div>',
    });
    const view = new TestView({
      regions: {
        content: { el: '.content', regionClass: TrackingRegion },
      },
    });
    this.sinon.spy(region, 'empty');

    expect(() => view.emptyRegions()).to.throw(error);
    expect(getRegions).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
    expect(region.empty).to.not.have.been.called;
    expect(view.isRendered()).to.be.true;

    view.destroy();
  });

  it('stops emptying later snapshot entries when a Region throws', function() {
    const error = new Error('empty failed');
    const first = { empty: this.sinon.spy() };
    const failing = { empty: this.sinon.stub().throws(error) };
    const last = { empty: this.sinon.spy() };
    const getRegions = this.sinon.spy(() => ({ first, failing, last }));
    const TestView = View.extend({ getRegions, template: false });
    const view = new TestView();

    expect(() => view.emptyRegions()).to.throw(error);
    expect(getRegions).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
    expect(first.empty).to.have.been.calledOnce.and.calledWithExactly();
    expect(failing.empty).to.have.been.calledOnce.and.calledWithExactly();
    expect(last.empty).to.not.have.been.called;

    view.destroy();
  });
});
