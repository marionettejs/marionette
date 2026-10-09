import { expect, it } from 'vitest';
import { View } from 'marionette';

it('resolves a selector-backed Region against the replacement placeholder after parent rendering', function() {
  const parent = new View({
    template: () => '<div class="content"></div>',
    regions: { content: '.content' },
  });
  const first = new View({ template: () => 'First child' });
  const second = new View({ template: () => 'Second child' });

  try {
    parent.render();
    const original = parent.el.querySelector('.content');
    const region = parent.getRegion('content');
    parent.showChildView('content', first);
    expect(original.firstElementChild).toBe(first.el);

    parent.render();
    const replacement = parent.el.querySelector('.content');
    expect(replacement).not.toBe(original);
    expect(parent.el.contains(original)).toBe(false);
    expect(first.isDestroyed()).toBe(true);
    expect(parent.getRegion('content')).toBe(region);

    parent.showChildView('content', second);
    expect(parent.getChildView('content')).toBe(second);
    expect(replacement.firstElementChild).toBe(second.el);
    expect(parent.el.textContent).toBe('Second child');

    parent.destroy();
    expect(second.isDestroyed()).toBe(true);
  } finally {
    parent.destroy();
    first.destroy();
    second.destroy();
  }
});
