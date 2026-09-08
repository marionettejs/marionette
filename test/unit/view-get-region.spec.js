import { vi, describe, it, expect } from 'vitest';
import { Behavior, MarionetteError, Region, View } from 'marionette';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

function createTrackedView(context) {
  const template = vi.fn(() => '<div class="content"></div>');
  const beforeRender = vi.fn();
  const render = vi.fn();
  const bindBehaviorUIElements = vi.fn();
  const TestBehavior = Behavior.extend({ bindUIElements: bindBehaviorUIElements });
  const regions = Object.create({ inherited: '.inherited' });
  Object.assign(regions, {
    constructor: '.constructor',
    content: '.content',
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

describe('#getRegion', function() {
  it('queries own Regions without rendering a live unrendered View', function(testContext) {
    const tracked = createTrackedView(testContext);
    const { view } = tracked;
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;

    const content = view.getRegion('content');
    expect(content).to.be.instanceOf(Region);
    expect(view.getRegion('constructor')).to.be.instanceOf(Region);
    expect(view.getRegion('toString')).to.be.instanceOf(Region);
    expect(view.getRegion('inherited')).toBeUndefined();
    expect(view.getRegion('valueOf')).toBeUndefined();
    expect(view.getRegion('missing')).toBeUndefined();

    const dynamic = view.addRegion('dynamic', '.dynamic');
    expect(view.getRegion('dynamic')).to.equal(dynamic);
    view.removeRegion('dynamic');
    expect(view.getRegion('dynamic')).toBeUndefined();

    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);

    view.destroy();
  });

  it('does not change a rendered View while looking up a Region', function(testContext) {
    const tracked = createTrackedView(testContext);
    const { view } = tracked;
    view.render();
    const html = view.el.innerHTML;
    const content = view.getRegion('content');
    resetRenderSpies(tracked);

    expect(view.getRegion('content')).to.equal(content);
    expect(view.getRegion('missing')).toBeUndefined();
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: true,
    }, html);

    view.destroy();
  });

  it('returns missing without dispatching render on a destroyed View', function(testContext) {
    const tracked = createTrackedView(testContext);
    const { view } = tracked;
    view.destroy();
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;
    const publicRender = vi.spyOn(view, 'render');

    expect(view.getRegion('content')).toBeUndefined();
    expect(view.getRegion('missing')).toBeUndefined();

    expect(publicRender).not.toHaveBeenCalled();
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: true,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);
  });

  it('does not render the parent when directly showing through a Region lookup', function(testContext) {
    const tracked = createTrackedView(testContext);
    const { view } = tracked;
    const child = new View({ template: () => '<span>Child</span>' });
    const region = view.getRegion('content');

    expect(() => region.show(child)).to.throw(MarionetteError).and.include({
      code: 'MN0005',
    });
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: false,
    }, '');
    expect(child.isRendered()).toBe(false);
    expect(child.isDestroyed()).toBe(false);
    expect(region.hasView()).toBe(false);

    child.destroy();
    region.el = '.content';
    view.destroy();
  });
});

const childOperations = [
  {
    method: 'showChildView',
    execute(view, child, options) {
      return view.showChildView('content', child, options);
    },
    populateOnRender: false,
  },
  {
    method: 'detachChildView',
    execute(view) {
      return view.detachChildView('content');
    },
    populateOnRender: true,
  },
  {
    method: 'getChildView',
    execute(view) {
      return view.getChildView('content');
    },
    populateOnRender: true,
  },
];

for (const operation of childOperations) {
  describe(`#${operation.method}`, function() {
    it('renders before overridable getRegion and preserves its result', function() {
      let region;
      const child = new View({ template: () => '<span>Child</span>' });
      const options = { replaceElement: false };
      const TrackingRegion = Region.extend({
        initialize() {
          region = this;
        },
      });
      const getRegion = vi.fn(function() {
        return View.prototype.getRegion.apply(this, arguments);
      });
      const render = vi.fn(function() {
        return View.prototype.render.apply(this, arguments);
      });
      const TestView = View.extend({
        getRegion,
        onRender() {
          if (operation.populateOnRender) {
            region.show(child);
          }
        },
        render,
        template: () => '<div class="content"></div>',
      });
      const view = new TestView({
        regions: {
          content: { el: '.content', regionClass: TrackingRegion },
        },
      });
      const show = vi.spyOn(region, 'show');
      const detach = vi.spyOn(region, 'detachView');

      const result = operation.execute(view, child, options);

      expect(result).to.equal(child);
      expect(render).toHaveBeenCalledTimes(1);
      expect(render.mock.contexts).toContain(view);
      expect(render).toHaveBeenCalledWith();
      expect(getRegion).toHaveBeenCalledTimes(1);
      expect(getRegion.mock.contexts).toContain(view);
      expect(getRegion).toHaveBeenCalledWith('content');
      expect(render).toHaveBeenCalledBefore(getRegion);
      if (operation.method === 'showChildView') {
        expect(show).toHaveBeenCalledTimes(1);
        expect(show).toHaveBeenCalledWith(child, options);
        expect(region.currentView).to.equal(child);
      } else if (operation.method === 'detachChildView') {
        expect(detach).toHaveBeenCalledTimes(1);
        expect(detach).toHaveBeenCalledWith();
        expect(region.hasView()).toBe(false);
        expect(child.isDestroyed()).toBe(false);
      } else {
        expect(region.currentView).to.equal(child);
      }

      child.destroy();
      view.destroy();
    });

    it('does not render an already rendered View again', function() {
      const child = new View({ template: false });
      const view = new View({
        regions: { content: '.content' },
        template: () => '<div class="content"></div>',
      });
      view.render();
      const region = view.getRegion('content');
      if (operation.populateOnRender) {
        region.show(child);
      }
      const render = vi.spyOn(view, 'render');

      const result = operation.execute(view, child);

      expect(result).to.equal(child);
      expect(render).not.toHaveBeenCalled();

      view.destroy();
      if (!child.isDestroyed()) {
        child.destroy();
      }
    });

    it('preserves MN0020 for a missing name after rendering', function() {
      const child = new View();
      const view = new View({ template: () => '<div></div>' });
      const render = vi.spyOn(view, 'render');

      expect(() => operation.execute(view, child)).to.throw(MarionetteError).and.include({
        code: 'MN0020',
      });
      expect(render).toHaveBeenCalledTimes(1);
      expect(render).toHaveBeenCalledWith();

      child.destroy();
      view.destroy();
    });

    it('dispatches the destroyed render no-op before reporting MN0020', function() {
      const child = new View();
      const view = new View({ regions: { content: '.content' } });
      view.destroy();
      const render = vi.spyOn(view, 'render');

      expect(() => operation.execute(view, child)).to.throw(MarionetteError).and.include({
        code: 'MN0020',
      });
      expect(render).toHaveBeenCalledTimes(1);
      expect(render.mock.contexts).toContain(view);
      expect(render).toHaveBeenCalledWith();

      child.destroy();
    });

    if (operation.method === 'showChildView') {

      it('preserves the destroyed View diagnostic', function() {
        const child = new View();
        const view = new View({
          regions: { content: '.content' },
          template: () => '<div class="content"></div>',
        });
        child.destroy();

        expect(() => view.showChildView('content', child))
          .to.throw(MarionetteError).and.include({ code: 'MN0007' });
        expect(view.getChildView('content')).toBeUndefined();

        view.destroy();
      });

      it('uses a Region added during render through an aliasing getRegion override', function() {
        const child = new View({ template: false });
        const getRegion = vi.fn(function(name) {
          return View.prototype.getRegion.call(this, name === 'alias' ? 'content' : name);
        });
        const TestView = View.extend({
          getRegion,
          onRender() {
            this.addRegion('content', '.content');
          },
          template: () => '<div class="content"></div>',
        });
        const view = new TestView();

        expect(view.showChildView('alias', child)).to.equal(child);
        expect(getRegion).toHaveBeenCalledTimes(1);
        expect(getRegion.mock.contexts).toContain(view);
        expect(getRegion).toHaveBeenCalledWith('alias');
        expect(view.getChildView('content')).to.equal(child);

        view.destroy();
      });
    }

    it('stops before getRegion when rendering fails', function() {
      const error = new Error('render failed');
      const child = new View();
      const getRegion = vi.fn();
      const TestView = View.extend({ getRegion });
      const view = new TestView({ regions: { content: '.content' } });
      vi.spyOn(view, 'render').mockImplementation(() => undefined).mockImplementation(() => { throw error; });

      expect(() => operation.execute(view, child)).to.throw(error);
      expect(getRegion).not.toHaveBeenCalled();
      expect(child.isRendered()).toBe(false);

      child.destroy();
      view.destroy();
    });

    it('stops after rendering when the getRegion override fails', function() {
      const error = new Error('getRegion failed');
      const child = new View();
      const getRegion = vi.fn().mockImplementation(() => { throw error; });
      const TestView = View.extend({
        getRegion,
        template: () => '<div class="content"></div>',
      });
      const view = new TestView({ regions: { content: '.content' } });

      expect(() => operation.execute(view, child)).to.throw(error);
      expect(getRegion).toHaveBeenCalledTimes(1);
      expect(getRegion.mock.contexts).toContain(view);
      expect(getRegion).toHaveBeenCalledWith('content');
      expect(view.isRendered()).toBe(true);
      expect(child.isRendered()).toBe(false);

      child.destroy();
      view.destroy();
    });
  });
}
