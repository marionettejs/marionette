import Region from '../../modules/region';
import View from '../../modules/view';

function state(view) {
  return {
    rendered: view.isRendered(),
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
  };
}

describe('View lifecycle contract', function() {
  const constructionStates = [
    {
      name: 'generated empty detached element',
      create() {
        return new View({ template: false });
      },
      expected: { rendered: false, attached: false, destroyed: false },
    },
    {
      name: 'empty attached element',
      create(context) {
        context.setFixtures('<div id="empty-attached"></div>');
        return new View({ el: document.querySelector('#empty-attached'), template: false });
      },
      expected: { rendered: false, attached: true, destroyed: false },
    },
    {
      name: 'populated detached element',
      create() {
        const el = document.createElement('div');
        el.innerHTML = '<span>Existing content</span>';
        return new View({ el, template: false });
      },
      expected: { rendered: true, attached: false, destroyed: false },
    },
    {
      name: 'populated attached element',
      create(context) {
        context.setFixtures('<div id="populated-attached"><span>Existing content</span></div>');
        return new View({ el: document.querySelector('#populated-attached'), template: false });
      },
      expected: { rendered: true, attached: true, destroyed: false },
    },
  ];

  for (const scenario of constructionStates) {
    it(`exposes the ${scenario.name} state vector`, function() {
      const view = scenario.create(this);

      expect(state(view)).to.deep.equal(scenario.expected);

      view.destroy();
    });
  }

  it('follows the normal Region-managed transition sequence', function() {
    this.setFixtures('<div id="lifecycle-region"></div>');
    const region = new Region({ el: '#lifecycle-region' });
    const view = new View({ template: () => '<span>Rendered content</span>' });
    const render = this.sinon.spy(view, 'render');
    const beforeDestroy = this.sinon.spy();
    const destroy = this.sinon.spy();
    view.on('before:destroy', beforeDestroy);
    view.on('destroy', destroy);

    expect(state(view)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: false,
    });

    expect(region.show(view)).to.equal(region);
    expect(state(view)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(render).to.have.been.calledOnce;

    view.render();
    expect(state(view)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(render).to.have.been.calledTwice;

    expect(region.show(view)).to.equal(region);
    expect(render).to.have.been.calledTwice;

    expect(region.detachView()).to.equal(view);
    expect(state(view)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(region.detachView()).to.be.undefined;

    region.show(view);
    expect(state(view)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(render).to.have.been.calledTwice;

    region.empty();
    expect(state(view)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: true,
    });
    expect(beforeDestroy).to.have.been.calledOnce;
    expect(destroy).to.have.been.calledOnce;

    view.destroy();
    expect(beforeDestroy).to.have.been.calledOnce;
    expect(destroy).to.have.been.calledOnce;

    region.destroy();
  });
});
