import { describe, expect, it, vi } from 'vitest';
import { View } from 'marionette';

describe('View.setRenderer', () => {
  it('returns the receiving class and isolates its renderer from its parent', () => {
    const Parent = View.extend({ template: data => data.label });
    const Child = Parent.extend();
    const renderer = vi.fn((template, data) => `custom:${template(data)}`);
    expect(Child.setRenderer(renderer)).toBe(Child);
    const child = new Child({ model: { label: 'child' } });
    const parent = new Parent({ model: { label: 'parent' } });
    child.render();
    parent.render();
    expect(child.el.textContent).toBe('custom:child');
    expect(parent.el.textContent).toBe('parent');
    expect(renderer).toHaveBeenCalledTimes(1);
    child.destroy();
    parent.destroy();
  });

  it('replaces a previously configured renderer', () => {
    const Custom = View.extend({ template: () => 'default' });
    Custom.setRenderer(() => 'custom');
    expect(Custom.setRenderer(template => template())).toBe(Custom);
    const view = new Custom();
    view.render();
    expect(view.el.textContent).toBe('default');
    view.destroy();
  });
});
