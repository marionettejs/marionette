import { vi, describe, it, expect } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import { Region, View } from 'marionette';

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
        setFixtures('<div id="empty-attached"></div>');
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
        setFixtures('<div id="populated-attached"><span>Existing content</span></div>');
        return new View({ el: document.querySelector('#populated-attached'), template: false });
      },
      expected: { rendered: true, attached: true, destroyed: false },
    },
    {
      name: 'imported template-content element',
      create() {
        const template = document.createElement('template');
        template.innerHTML = '<section><span>Imported content</span></section>';
        const el = document.importNode(template.content.firstElementChild, true);
        return new View({ el, template: false });
      },
      expected: { rendered: true, attached: false, destroyed: false },
    },
  ];

  for (const scenario of constructionStates) {
    it(`exposes the ${scenario.name} state vector`, function(testContext) {
      const view = scenario.create(testContext);

      expect(state(view)).to.deep.equal(scenario.expected);

      view.destroy();
    });
  }

  it('attaches a View and its child once after leaving template content', function() {
    setFixtures('<div id="template-content-region"></div>');
    const template = document.createElement('template');
    template.innerHTML = '<section><div class="child-region"></div></section>';
    const root = template.content.firstElementChild;
    const ParentView = View.extend({
      el: root,
      template: false,
      regions: { child: '.child-region' },
    });
    const parent = new ParentView();
    const child = new View({ template: () => '<span>Child</span>' });
    const parentAttach = vi.fn();
    const childAttach = vi.fn();
    parent.on('attach', parentAttach);
    child.on('attach', childAttach);

    expect(root.ownerDocument.documentElement).to.be.null;
    expect(state(parent)).to.deep.equal({ rendered: true, attached: false, destroyed: false });

    parent.showChildView('child', child);

    expect(state(child)).to.deep.equal({ rendered: true, attached: false, destroyed: false });
    expect(parentAttach).not.toHaveBeenCalled();
    expect(childAttach).not.toHaveBeenCalled();

    const region = new Region({ el: '#template-content-region' });
    region.show(parent);

    expect(state(parent)).to.deep.equal({ rendered: true, attached: true, destroyed: false });
    expect(state(child)).to.deep.equal({ rendered: true, attached: true, destroyed: false });
    expect(parentAttach).toHaveBeenCalledTimes(1);
    expect(childAttach).toHaveBeenCalledTimes(1);

    parent.destroy();
  });

  it('treats repeated render calls after destruction as idempotent no-ops', function() {
    const template = vi.fn(() => `
      <div class="child-region"></div>
    `);
    const beforeRender = vi.fn();
    const render = vi.fn();
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
    template.mockClear();
    beforeRender.mockClear();
    render.mockClear();
    const getTemplate = vi.spyOn(view, 'getTemplate');

    expect(view.render()).to.equal(view);
    expect(view.render()).to.equal(view);
    expect(view.hasRegion('child')).to.be.false;

    expect(getTemplate).not.toHaveBeenCalled();
    expect(template).not.toHaveBeenCalled();
    expect(beforeRender).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    expect(view.el.innerHTML).to.equal(destroyedHtml);
    expect(view.el.lastChild).to.equal(sentinel);
    expect(state(view)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
    expect(state(child)).to.deep.equal({ rendered: false, attached: false, destroyed: true });
  });

  it('propagates nested attachment through detached, reentrant, and repeated transitions', function() {
    setFixtures('<div id="nested-lifecycle-region"></div>');
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
        attach: vi.fn(),
        detach: vi.fn(),
        destroy: vi.fn(),
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
    lifecycleEvents.forEach(events => expect(events.attach).toHaveBeenCalledTimes(1));

    region.show(parent);
    lifecycleEvents.forEach(events => expect(events.attach).toHaveBeenCalledTimes(1));

    expect(region.detachView()).to.equal(parent);
    expect([parent, existingChild, reentrantChild].map(state)).to.deep.equal(Array(3).fill({
      rendered: true,
      attached: false,
      destroyed: false,
    }));
    lifecycleEvents.forEach(events => expect(events.detach).toHaveBeenCalledTimes(1));

    region.show(parent);
    lifecycleEvents.forEach(events => expect(events.attach).toHaveBeenCalledTimes(2));

    region.empty();
    region.empty();
    expect([parent, existingChild, reentrantChild].map(state)).to.deep.equal(Array(3).fill({
      rendered: false,
      attached: false,
      destroyed: true,
    }));
    lifecycleEvents.forEach(events => {
      expect(events.detach).toHaveBeenCalledTimes(2);
      expect(events.destroy).toHaveBeenCalledTimes(1);
    });

    region.destroy();
  });

  it('ignores reentrant and repeated destroy calls while tearing down once', function() {
    setFixtures('<div id="reentrant-destroy-region"></div>');
    const parent = new View({
      regions: { child: '.child-region' },
      template: () => '<div class="child-region"></div>',
    });
    const child = new View({ template: () => '<span>Child</span>' });
    const region = new Region({ el: '#reentrant-destroy-region' });
    let beforeDestroyReturn;
    let destroyReturn;
    const lifecycle = {
      parentBeforeDestroy: vi.fn(currentView => {
        beforeDestroyReturn = currentView.destroy();
      }),
      parentBeforeDetach: vi.fn(),
      parentDetach: vi.fn(),
      parentDestroy: vi.fn(currentView => {
        destroyReturn = currentView.destroy();
      }),
      childBeforeDetach: vi.fn(),
      childDetach: vi.fn(),
      childBeforeDestroy: vi.fn(),
      childDestroy: vi.fn(),
      regionBeforeEmpty: vi.fn(),
      regionEmpty: vi.fn(),
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
      expect(callback).toHaveBeenCalledTimes(1);
    }

    region.destroy();
  });

  it('follows the normal Region-managed transition sequence', function() {
    setFixtures('<div id="lifecycle-region"></div>');
    const region = new Region({ el: '#lifecycle-region' });
    const view = new View({ template: () => '<span>Rendered content</span>' });
    const render = vi.spyOn(view, 'render');
    const beforeDestroy = vi.fn();
    const destroy = vi.fn();
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
    expect(render).toHaveBeenCalledTimes(1);

    view.render();
    expect(state(view)).to.deep.equal({
      rendered: true,
      attached: true,
      destroyed: false,
    });
    expect(render).toHaveBeenCalledTimes(2);

    expect(region.show(view)).to.equal(region);
    expect(render).toHaveBeenCalledTimes(2);

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
    expect(render).toHaveBeenCalledTimes(2);

    region.empty();
    expect(state(view)).to.deep.equal({
      rendered: false,
      attached: false,
      destroyed: true,
    });
    expect(beforeDestroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);

    view.destroy();
    expect(beforeDestroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);

    region.destroy();
  });

});
