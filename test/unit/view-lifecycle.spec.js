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

  it('recomputes state when replacing its element while alive', function() {
    this.setFixtures(`
      <div id="replacement-empty"></div>
      <div id="replacement-populated"><span>Existing content</span></div>
    `);
    const populatedDetached = document.createElement('div');
    populatedDetached.innerHTML = '<span>Existing content</span>';
    const replacements = [
      {
        el: document.createElement('div'),
        expected: { rendered: false, attached: false, destroyed: false },
      },
      {
        el: populatedDetached,
        expected: { rendered: true, attached: false, destroyed: false },
      },
      {
        el: document.querySelector('#replacement-empty'),
        expected: { rendered: false, attached: true, destroyed: false },
      },
      {
        el: document.querySelector('#replacement-populated'),
        expected: { rendered: true, attached: true, destroyed: false },
      },
    ];
    const view = new View({ template: false });

    for (const replacement of replacements) {
      expect(view.setElement(replacement.el)).to.equal(view);
      expect(state(view)).to.deep.equal(replacement.expected);

      expect(view.setElement(replacement.el)).to.equal(view);
      expect(state(view)).to.deep.equal(replacement.expected);
    }

    view.destroy();
  });

  it('treats repeated render calls after destruction as idempotent no-ops', function() {
    const template = this.sinon.spy(() => `
      <div class="child-region"></div>
    `);
    const beforeRender = this.sinon.spy();
    const render = this.sinon.spy();
    const ParentView = View.extend({
      regions: { child: '.child-region' },
      template,
    });
    const view = new ParentView();
    const child = new View({ template: () => '<span>Child</span>' });
    view.on('before:render', beforeRender);
    view.on('render', render);
    view.render();
    view.showChildView('child', child);

    view.destroy();

    const sentinel = document.createElement('span');
    sentinel.textContent = 'Unmanaged content';
    view.el.append(sentinel);
    const destroyedHtml = view.el.innerHTML;
    template.resetHistory();
    beforeRender.resetHistory();
    render.resetHistory();
    const getTemplate = this.sinon.spy(view, 'getTemplate');

    expect(view.render()).to.equal(view);
    expect(view.render()).to.equal(view);
    expect(view.hasRegion('child')).to.be.false;

    expect(getTemplate).to.not.have.been.called;
    expect(template).to.not.have.been.called;
    expect(beforeRender).to.not.have.been.called;
    expect(render).to.not.have.been.called;
    expect(view.el.innerHTML).to.equal(destroyedHtml);
    expect(view.el.lastChild).to.equal(sentinel);
    expect(state(view)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
    expect(state(child)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
  });

  it('preserves Region ownership without moving child DOM when replacing its element', function() {
    this.setFixtures('<div id="region-owner"></div>');
    const oldRoot = document.querySelector('#region-owner');
    const replacementRoot = document.createElement('div');
    replacementRoot.innerHTML = '<span>Replacement content</span>';
    const view = new View({
      el: oldRoot,
      template: () => '<div class="child-region"></div>',
      regions: { child: '.child-region' },
    });
    const child = new View({ template: () => '<span>Child</span>' });
    view.render();
    view.showChildView('child', child);
    const region = view.getRegion('child');

    expect(oldRoot.contains(child.el)).to.be.true;
    expect(state(child)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });

    view.setElement(replacementRoot);

    expect(state(view)).to.deep.equal({
      rendered: true,
      attached: false,
      destroyed: false,
    });
    expect(view.getRegion('child')).to.equal(region);
    expect(view.getChildView('child')).to.equal(child);
    expect(region.currentView).to.equal(child);
    expect(state(child)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(oldRoot.contains(child.el)).to.be.true;
    expect(replacementRoot.contains(child.el)).to.be.false;

    view.destroy();
  });

  it('propagates nested attachment through detached, reentrant, and repeated transitions', function() {
    this.setFixtures('<div id="nested-lifecycle-region"></div>');
    const existingChild = new View({ template: () => '<span>Existing child</span>' });
    const reentrantChild = new View({ template: () => '<span>Reentrant child</span>' });
    let firstReentrantStateDuringAttach;
    const ParentView = View.extend({
      template: () => `
        <div class="existing-region"></div>
        <div class="reentrant-region"></div>
      `,
      regions: {
        existing: '.existing-region',
        reentrant: '.reentrant-region',
      },
      onAttach() {
        this.showChildView('reentrant', reentrantChild);
        if (!firstReentrantStateDuringAttach) {
          firstReentrantStateDuringAttach = state(reentrantChild);
        }
      },
    });
    const parent = new ParentView();
    const region = new Region({ el: '#nested-lifecycle-region' });
    const trackLifecycle = view => {
      const events = {
        attach: this.sinon.spy(),
        detach: this.sinon.spy(),
        destroy: this.sinon.spy(),
      };
      view.on(events);
      return events;
    };
    const lifecycleEvents = [
      trackLifecycle(parent),
      trackLifecycle(existingChild),
      trackLifecycle(reentrantChild),
    ];

    parent.render();
    parent.showChildView('existing', existingChild);

    expect(state(parent)).to.deep.equal({ rendered: true, attached: false, destroyed: false });
    expect(state(existingChild)).to.deep.equal({ rendered: true, attached: false, destroyed: false });
    expect(state(reentrantChild)).to.deep.equal({ rendered: false, attached: false, destroyed: false });

    region.show(parent);

    expect(firstReentrantStateDuringAttach).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(parent.getChildView('existing')).to.equal(existingChild);
    expect(parent.getChildView('reentrant')).to.equal(reentrantChild);
    expect([parent, existingChild, reentrantChild].map(state)).to.deep.equal(Array(3).fill({
      rendered: true,
      attached: true,
      destroyed: false,
    }));
    lifecycleEvents.forEach(events => expect(events.attach).to.have.been.calledOnce);

    region.show(parent);
    lifecycleEvents.forEach(events => expect(events.attach).to.have.been.calledOnce);

    expect(region.detachView()).to.equal(parent);
    expect([parent, existingChild, reentrantChild].map(state)).to.deep.equal(Array(3).fill({
      rendered: true,
      attached: false,
      destroyed: false,
    }));
    lifecycleEvents.forEach(events => expect(events.detach).to.have.been.calledOnce);

    region.show(parent);
    lifecycleEvents.forEach(events => expect(events.attach).to.have.been.calledTwice);

    region.empty();
    region.empty();
    expect([parent, existingChild, reentrantChild].map(state)).to.deep.equal(Array(3).fill({
      rendered: false,
      attached: false,
      destroyed: true,
    }));
    lifecycleEvents.forEach(events => {
      expect(events.detach).to.have.been.calledTwice;
      expect(events.destroy).to.have.been.calledOnce;
    });

    region.destroy();
  });

  it('ignores reentrant and repeated destroy calls while tearing down once', function() {
    this.setFixtures('<div id="reentrant-destroy-region"></div>');
    const parent = new View({
      regions: { child: '.child-region' },
      template: () => '<div class="child-region"></div>',
    });
    const child = new View({ template: () => '<span>Child</span>' });
    const region = new Region({ el: '#reentrant-destroy-region' });
    let beforeDestroyReturn;
    let destroyReturn;
    const lifecycle = {
      parentBeforeDestroy: this.sinon.spy(currentView => {
        beforeDestroyReturn = currentView.destroy();
      }),
      parentBeforeDetach: this.sinon.spy(),
      parentDetach: this.sinon.spy(),
      parentDestroy: this.sinon.spy(currentView => {
        destroyReturn = currentView.destroy();
      }),
      childBeforeDetach: this.sinon.spy(),
      childDetach: this.sinon.spy(),
      childBeforeDestroy: this.sinon.spy(),
      childDestroy: this.sinon.spy(),
      regionBeforeEmpty: this.sinon.spy(),
      regionEmpty: this.sinon.spy(),
    };

    parent.on({
      'before:destroy': lifecycle.parentBeforeDestroy,
      'before:detach': lifecycle.parentBeforeDetach,
      detach: lifecycle.parentDetach,
      destroy: lifecycle.parentDestroy,
    });
    child.on({
      'before:detach': lifecycle.childBeforeDetach,
      detach: lifecycle.childDetach,
      'before:destroy': lifecycle.childBeforeDestroy,
      destroy: lifecycle.childDestroy,
    });
    region.on({
      'before:empty': lifecycle.regionBeforeEmpty,
      empty: lifecycle.regionEmpty,
    });

    region.show(parent);
    parent.showChildView('child', child);

    expect(parent.destroy()).to.equal(parent);
    expect(parent.destroy()).to.equal(parent);
    expect(beforeDestroyReturn).to.equal(parent);
    expect(destroyReturn).to.equal(parent);

    expect(state(parent)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
    expect(state(child)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
    expect(region.hasView()).to.be.false;
    expect(region.currentView).to.be.undefined;

    for (const callback of Object.values(lifecycle)) {
      expect(callback).to.have.been.calledOnce;
    }

    region.destroy();
  });

  it('retries after before:destroy throws and cleans up managed children once', function() {
    this.setFixtures('<div id="retry-destroy-region"></div>');
    const error = new Error('before:destroy failed');
    const firstOptions = { attempt: 1 };
    const retryOptions = { attempt: 2 };
    const parent = new View({
      regions: { child: '.child-region' },
      template: () => '<div class="child-region"></div>',
    });
    const child = new View({ template: () => '<span>Child</span>' });
    const region = new Region({ el: '#retry-destroy-region' });
    let beforeDestroySideEffects = 0;
    const lifecycle = {
      parentBeforeDestroy: this.sinon.spy(() => {
        if (++beforeDestroySideEffects === 1) { throw error; }
      }),
      parentBeforeDetach: this.sinon.spy(),
      parentDetach: this.sinon.spy(),
      parentDestroy: this.sinon.spy(),
      childBeforeDetach: this.sinon.spy(),
      childDetach: this.sinon.spy(),
      childBeforeDestroy: this.sinon.spy(),
      childDestroy: this.sinon.spy(),
      regionBeforeEmpty: this.sinon.spy(),
      regionEmpty: this.sinon.spy(),
    };

    parent.on({
      'before:destroy': lifecycle.parentBeforeDestroy,
      'before:detach': lifecycle.parentBeforeDetach,
      detach: lifecycle.parentDetach,
      destroy: lifecycle.parentDestroy,
    });
    child.on({
      'before:detach': lifecycle.childBeforeDetach,
      detach: lifecycle.childDetach,
      'before:destroy': lifecycle.childBeforeDestroy,
      destroy: lifecycle.childDestroy,
    });
    region.on({
      'before:empty': lifecycle.regionBeforeEmpty,
      empty: lifecycle.regionEmpty,
    });
    this.sinon.spy(parent, 'stopListening');
    this.sinon.spy(child, 'destroy');

    region.show(parent);
    parent.showChildView('child', child);

    expect(() => parent.destroy(firstOptions)).to.throw(error);
    expect(state(parent)).to.deep.equal({ rendered: true, attached: true, destroyed: false });
    expect(state(child)).to.deep.equal({ rendered: true, attached: true, destroyed: false });
    expect(region.currentView).to.equal(parent);
    expect(parent.getChildView('child')).to.equal(child);
    expect(beforeDestroySideEffects).to.equal(1);
    for (const [name, callback] of Object.entries(lifecycle)) {
      expect(callback.callCount, name).to.equal(name === 'parentBeforeDestroy' ? 1 : 0);
    }
    expect(parent.stopListening).to.not.have.been.called;
    expect(child.destroy).to.not.have.been.called;

    expect(parent.destroy(retryOptions)).to.equal(parent);
    expect(parent.destroy()).to.equal(parent);
    expect(state(parent)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
    expect(state(child)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
    expect(region.hasView()).to.be.false;
    expect(region.currentView).to.be.undefined;
    expect(beforeDestroySideEffects).to.equal(2);
    expect(lifecycle.parentBeforeDestroy.getCall(0).args).to.deep.equal([parent, firstOptions]);
    expect(lifecycle.parentBeforeDestroy.getCall(1).args).to.deep.equal([parent, retryOptions]);
    expect(lifecycle.parentBeforeDestroy).to.have.been.calledTwice;
    for (const [name, callback] of Object.entries(lifecycle)) {
      if (name !== 'parentBeforeDestroy') {
        expect(callback.callCount, name).to.equal(1);
      }
    }
    expect(parent.stopListening.getCalls().map(call => call.args)).to.deep.equal([
      [child],
      [],
    ]);
    expect(child.destroy).to.have.been.calledOnce;

    region.destroy();
  });

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
