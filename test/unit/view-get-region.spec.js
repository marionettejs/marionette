import { Behavior, MarionetteError, Region, View } from '../../index';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

function createTrackedView(context) {
  const template = context.sinon.spy(() => '<div class="content"></div>');
  const beforeRender = context.sinon.spy();
  const render = context.sinon.spy();
  const bindBehaviorUIElements = context.sinon.spy();
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

describe('#getRegion', function() {
  it('queries own Regions without rendering a live unrendered View', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;
    const toPrimitive = this.sinon.stub().returns('content');
    const coercedName = { [Symbol.toPrimitive]: toPrimitive };

    const content = view.getRegion('content');
    expect(content).to.be.instanceOf(Region);
    expect(view.getRegion('constructor')).to.be.instanceOf(Region);
    expect(view.getRegion('toString')).to.be.instanceOf(Region);
    expect(view.getRegion('inherited')).to.be.undefined;
    expect(view.getRegion('valueOf')).to.be.undefined;
    expect(view.getRegion('missing')).to.be.undefined;
    expect(view.getRegion(coercedName)).to.equal(content);
    expect(toPrimitive).to.have.been.calledOnce;
    expect(view.getRegion(Object.create(null))).to.be.undefined;

    const dynamic = view.addRegion('dynamic', '.dynamic');
    expect(view.getRegion('dynamic')).to.equal(dynamic);
    view.removeRegion('dynamic');
    expect(view.getRegion('dynamic')).to.be.undefined;

    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);

    view.destroy();
  });

  it('does not change a rendered View while looking up a Region', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    view.render();
    const html = view.el.innerHTML;
    const content = view.getRegion('content');
    resetRenderSpies(tracked);

    expect(view.getRegion('content')).to.equal(content);
    expect(view.getRegion('missing')).to.be.undefined;
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: true,
    }, html);

    view.destroy();
  });

  it('returns missing without dispatching render on a destroyed View', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    view.destroy();
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;
    const publicRender = this.sinon.spy(view, 'render');

    expect(view.getRegion('content')).to.be.undefined;
    expect(view.getRegion('missing')).to.be.undefined;

    expect(publicRender).to.not.have.been.called;
    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: true,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);
  });

  it('does not render the parent when directly showing through a Region lookup', function() {
    const tracked = createTrackedView(this);
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
    expect(child.isRendered()).to.be.false;
    expect(child.isDestroyed()).to.be.false;
    expect(region.hasView()).to.be.false;

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
      const getRegion = this.sinon.spy(function() {
        return View.prototype.getRegion.apply(this, arguments);
      });
      const render = this.sinon.spy(function() {
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
      const show = this.sinon.spy(region, 'show');
      const detach = this.sinon.spy(region, 'detachView');

      const result = operation.execute(view, child, options);

      expect(result).to.equal(child);
      expect(render).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
      expect(getRegion)
        .to.have.been.calledOnce
        .and.calledOn(view)
        .and.calledWithExactly('content');
      expect(render).to.have.been.calledBefore(getRegion);
      if (operation.method === 'showChildView') {
        expect(show).to.have.been.calledOnce.and.calledWithExactly(child, options);
        expect(region.currentView).to.equal(child);
      } else if (operation.method === 'detachChildView') {
        expect(detach).to.have.been.calledOnce.and.calledWithExactly();
        expect(region.hasView()).to.be.false;
        expect(child.isDestroyed()).to.be.false;
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
      const render = this.sinon.spy(view, 'render');

      const result = operation.execute(view, child);

      expect(result).to.equal(child);
      expect(render).to.not.have.been.called;

      view.destroy();
      if (!child.isDestroyed()) {
        child.destroy();
      }
    });

    it('preserves MN0020 for a missing name after rendering', function() {
      const child = new View();
      const view = new View({ template: () => '<div></div>' });
      const render = this.sinon.spy(view, 'render');

      expect(() => operation.execute(view, child)).to.throw(MarionetteError).and.include({
        code: 'MN0020',
      });
      expect(render).to.have.been.calledOnce.and.calledWithExactly();

      child.destroy();
      view.destroy();
    });

    it('dispatches the destroyed render no-op before reporting MN0020', function() {
      const child = new View();
      const view = new View({ regions: { content: '.content' } });
      view.destroy();
      const render = this.sinon.spy(view, 'render');

      expect(() => operation.execute(view, child)).to.throw(MarionetteError).and.include({
        code: 'MN0020',
      });
      expect(render).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();

      child.destroy();
    });

    if (operation.method === 'showChildView') {
      it('uses a Region added during render through an aliasing getRegion override', function() {
        const child = new View({ template: false });
        const getRegion = this.sinon.spy(function(name) {
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
        expect(getRegion).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly('alias');
        expect(view.getChildView('content')).to.equal(child);

        view.destroy();
      });
    }

    it('stops before getRegion when rendering fails', function() {
      const error = new Error('render failed');
      const child = new View();
      const getRegion = this.sinon.spy();
      const TestView = View.extend({ getRegion });
      const view = new TestView({ regions: { content: '.content' } });
      this.sinon.stub(view, 'render').throws(error);

      expect(() => operation.execute(view, child)).to.throw(error);
      expect(getRegion).to.not.have.been.called;
      expect(child.isRendered()).to.be.false;

      child.destroy();
      view.destroy();
    });

    it('stops after rendering when the getRegion override fails', function() {
      const error = new Error('getRegion failed');
      const child = new View();
      const getRegion = this.sinon.stub().throws(error);
      const TestView = View.extend({
        getRegion,
        template: () => '<div class="content"></div>',
      });
      const view = new TestView({ regions: { content: '.content' } });

      expect(() => operation.execute(view, child)).to.throw(error);
      expect(getRegion).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly('content');
      expect(view.isRendered()).to.be.true;
      expect(child.isRendered()).to.be.false;

      child.destroy();
      view.destroy();
    });
  });
}
