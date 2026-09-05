import { Behavior, View } from '../../src/index';

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
  const TestBehavior = Behavior.extend({
    bindUIElements: bindBehaviorUIElements,
  });
  const regions = {
    ['__proto__']: '.proto',
    constructor: '.constructor',
    content: '.content',
    toString: '.to-string',
  };
  Object.setPrototypeOf(regions, { inherited: '.inherited' });
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

function expectNoRenderSideEffects(tracked, expectedState, html) {
  const {
    beforeRender,
    bindBehaviorUIElements,
    bindUIElements,
    getTemplate,
    render,
    template,
    view,
  } = tracked;

  expect(getTemplate).to.not.have.been.called;
  expect(template).to.not.have.been.called;
  expect(beforeRender).to.not.have.been.called;
  expect(render).to.not.have.been.called;
  expect(bindUIElements).to.not.have.been.called;
  expect(bindBehaviorUIElements).to.not.have.been.called;
  expect(view.el.innerHTML).to.equal(html);
  expect(state(view)).to.deep.equal(expectedState);
}

describe('View#hasRegion', function() {
  it('queries own Regions without rendering an unrendered View', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;
    const getRegion = this.sinon.spy(view, 'getRegion');

    expect(view.hasRegion('content')).to.be.true;
    expect(view.hasRegion('constructor')).to.be.true;
    expect(view.hasRegion('toString')).to.be.true;
    expect(view.hasRegion('__proto__')).to.be.true;
    expect(view.hasRegion('inherited')).to.be.false;
    expect(view.hasRegion('valueOf')).to.be.false;
    expect(view.hasRegion('missing')).to.be.false;
    expect(getRegion).to.not.have.been.called;

    const dynamicRegion = view.addRegion('dynamic', '.dynamic');
    expect(view.hasRegion('dynamic')).to.be.true;
    expect(view.removeRegion('dynamic')).to.equal(dynamicRegion);
    expect(view.hasRegion('dynamic')).to.be.false;

    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: false,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);

    view.destroy();
  });

  it('remains a pure missing query after View destruction', function() {
    const tracked = createTrackedView(this);
    const { view } = tracked;
    view.destroy();
    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const html = view.el.innerHTML;

    expect(view.hasRegion('content')).to.be.false;
    expect(view.hasRegion('missing')).to.be.false;

    expectNoRenderSideEffects(tracked, {
      attached: false,
      destroyed: true,
      rendered: false,
    }, html);
    expect(view.el.lastChild).to.equal(sentinel);
  });
});
