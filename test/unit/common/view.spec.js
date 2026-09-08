import { vi, describe, it, expect } from 'vitest';
import { renderView, destroyView } from '../../../src/modules/common/view';
import View from '../../../src/modules/view';

describe('common view methods', function() {
  it('uses the View render lifecycle once when ensuring rendered content', function() {
    const view = new View({ template: () => '<span>Rendered</span>' });
    const beforeRender = vi.fn();
    const render = vi.fn();
    view.on('before:render', beforeRender);
    view.on('render', render);
    renderView(view);
    renderView(view);
    expect(view.el.textContent).to.equal('Rendered');
    expect(beforeRender).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it('delegates destruction and the detach-events setting to the View', function() {
    const view = new View();
    const beforeDestroy = vi.fn();
    const destroy = vi.fn();
    view.on('before:destroy', beforeDestroy);
    view.on('destroy', destroy);
    destroyView(view, true);
    expect(view._disableDetachEvents).to.equal(true);
    expect(view.isDestroyed()).to.equal(true);
    expect(beforeDestroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
