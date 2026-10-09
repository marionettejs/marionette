import { describe, expect, it, vi } from 'vitest';
import { Region, View } from 'marionette';

describe('Region-managed View lifecycle', () => {
  it('renders an unrendered View once when showing it repeatedly', () => {
    const view = new View({ template: () => '<span>Rendered</span>' });
    const region = new Region({ el: document.createElement('div') });
    const beforeRender = vi.fn();
    const render = vi.fn();
    view.on('before:render', beforeRender);
    view.on('render', render);
    region.show(view);
    region.show(view);
    expect(view.el.textContent).toBe('Rendered');
    expect(beforeRender).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(1);
    region.destroy();
  });

  it('destroys the owned View once when emptying a Region repeatedly', () => {
    const view = new View({ template: () => '' });
    const region = new Region({ el: document.createElement('div') });
    const beforeDestroy = vi.fn();
    const destroy = vi.fn();
    view.on('before:destroy', beforeDestroy);
    view.on('destroy', destroy);
    region.show(view);
    region.empty();
    region.empty();
    expect(view.isDestroyed()).toBe(true);
    expect(region.hasView()).toBe(false);
    expect(beforeDestroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
    region.destroy();
  });
});
