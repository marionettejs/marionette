import { vi, describe, it, expect } from 'vitest';
import { Behavior, Region, View } from '../../src/index';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

function createTrackedView(context) {
  const template = vi.fn(() => '<div class="content">Content</div>');
  const beforeRender = vi.fn();
  const render = vi.fn();
  const bindBehaviorUIElements = vi.fn();
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
  const getTemplate = vi.spyOn(view, 'getTemplate');
  const bindUIElements = vi.spyOn(view, 'bindUIElements');
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
  tracked.beforeRender.mockClear();
  tracked.bindBehaviorUIElements.mockClear();
  tracked.bindUIElements.mockClear();
  tracked.getTemplate.mockClear();
  tracked.render.mockClear();
  tracked.template.mockClear();
}

function expectNoRenderSideEffects(tracked, expectedState, html) {
  expect(tracked.getTemplate).not.toHaveBeenCalled();
  expect(tracked.template).not.toHaveBeenCalled();
  expect(tracked.beforeRender).not.toHaveBeenCalled();
  expect(tracked.render).not.toHaveBeenCalled();
  expect(tracked.bindUIElements).not.toHaveBeenCalled();
  expect(tracked.bindBehaviorUIElements).not.toHaveBeenCalled();
  expect(tracked.view.el.innerHTML).to.equal(html);
  expect(state(tracked.view)).to.deep.equal(expectedState);
}

describe('View#getRegions', function() {
  it('returns safe own-key snapshots without rendering an unrendered View', function(testContext) {
    const tracked = createTrackedView(testContext);
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

  it('does not change a rendered View while snapshotting its Regions', function(testContext) {
    const tracked = createTrackedView(testContext);
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

  it('returns fresh empty snapshots without rendering a destroyed View', function(testContext) {
    const tracked = createTrackedView(testContext);
    const { view } = tracked;
    view.destroy();
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;
    const renderMethod = vi.spyOn(view, 'render');

    const first = view.getRegions();
    const second = view.getRegions();

    expect(first).to.deep.equal({});
    expect(second).to.deep.equal({});
    expect(second).not.to.equal(first);
    expect(renderMethod).not.toHaveBeenCalled();
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
    const empty = vi.fn(function() {
      return Region.prototype.empty.apply(this, arguments);
    });
    const TrackingRegion = Region.extend({
      initialize() {
        regions.push(this);
      },
      empty,
    });
    const EmptyingView = View.extend({
      getRegions: vi.fn(function() {
        return View.prototype.getRegions.call(this);
      }),
      onRender() {
        this.addRegion('late', { el: '.late', regionClass: TrackingRegion });
      },
      render: vi.fn(function() {
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
    expect(view.render).toHaveBeenCalledTimes(1);
    expect(view.getRegions).toHaveBeenCalledTimes(1);
    expect(view.getRegions.mock.contexts).toContain(view);
    expect(view.getRegions).toHaveBeenCalledWith();
    expect(empty).toHaveBeenCalledTimes(2);
    expect(empty.mock.contexts.at(0)).to.equal(regions[0]);
    expect(empty.mock.calls.at(0)).to.deep.equal([]);
    expect(empty.mock.contexts.at(1)).to.equal(regions[1]);
    expect(empty.mock.calls.at(1)).to.deep.equal([]);
    expect(view.render).toHaveBeenCalledBefore(view.getRegions);
    expect(view.getRegions).toHaveBeenCalledBefore(empty);
    expect(view.isRendered()).to.be.true;
    expect(view.$('.content')[0].innerHTML).to.equal('');
    expect(view.$('.late')[0].innerHTML).to.equal('');

    view.destroy();
  });

  it('stops before getRegions and Region emptying when render throws', function() {
    const error = new Error('render failed');
    const region = new Region({ el: '.content' });
    const getRegions = vi.fn(() => ({ content: region }));
    const TestView = View.extend({ getRegions });
    const view = new TestView({ regions: { content: region } });
    vi.spyOn(region, 'empty');
    vi.spyOn(view, 'render').mockImplementation(() => undefined).mockImplementation(() => { throw error; });

    expect(() => view.emptyRegions()).to.throw(error);
    expect(getRegions).not.toHaveBeenCalled();
    expect(region.empty).not.toHaveBeenCalled();
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
    const getRegions = vi.fn(() => { throw error; });
    const TestView = View.extend({
      getRegions,
      template: () => '<div class="content"></div>',
    });
    const view = new TestView({
      regions: {
        content: { el: '.content', regionClass: TrackingRegion },
      },
    });
    vi.spyOn(region, 'empty');

    expect(() => view.emptyRegions()).to.throw(error);
    expect(getRegions).toHaveBeenCalledTimes(1);
    expect(getRegions.mock.contexts).toContain(view);
    expect(getRegions).toHaveBeenCalledWith();
    expect(region.empty).not.toHaveBeenCalled();
    expect(view.isRendered()).to.be.true;

    view.destroy();
  });

  it('stops emptying later snapshot entries when a Region throws', function() {
    const error = new Error('empty failed');
    const first = { empty: vi.fn() };
    const failing = { empty: vi.fn().mockImplementation(() => { throw error; }) };
    const last = { empty: vi.fn() };
    const getRegions = vi.fn(() => ({ first, failing, last }));
    const TestView = View.extend({ getRegions, template: false });
    const view = new TestView();

    expect(() => view.emptyRegions()).to.throw(error);
    expect(getRegions).toHaveBeenCalledTimes(1);
    expect(getRegions.mock.contexts).toContain(view);
    expect(getRegions).toHaveBeenCalledWith();
    expect(first.empty).toHaveBeenCalledTimes(1);
    expect(first.empty).toHaveBeenCalledWith();
    expect(failing.empty).toHaveBeenCalledTimes(1);
    expect(failing.empty).toHaveBeenCalledWith();
    expect(last.empty).not.toHaveBeenCalled();

    view.destroy();
  });
});
