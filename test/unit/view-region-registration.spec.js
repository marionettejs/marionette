import { expect, it, vi } from 'vitest';
import { View } from 'marionette';

for (const removal of ['view', 'region']) {
  it(`keeps Region teardown observable through ${removal} removal without View registration events`, function() {
    const hook = vi.fn();
    const parent = new View({
      template: () => '<div class="content"></div>',
      onBeforeAddRegion: hook,
      onAddRegion: hook,
      onBeforeRemoveRegion: hook,
      onRemoveRegion: hook,
    });
    const child = new View({ template: () => 'Child' });
    const notifications = vi.fn();
    parent.on('before:add:region add:region before:remove:region remove:region', notifications);

    try {
      parent.render();
      const region = parent.addRegion('content', '.content');
      parent.showChildView('content', child);
      const teardown = [];
      region.on('before:destroy', () => teardown.push('before'));
      region.on('destroy', () => teardown.push('after'));

      if (removal === 'view') {
        expect(parent.removeRegion('content')).toBe(region);
      } else {
        expect(region.destroy()).toBe(region);
      }

      expect(teardown).toEqual(['before', 'after']);
      expect(region.isDestroyed()).toBe(true);
      expect(child.isDestroyed()).toBe(true);
      expect(parent.hasRegion('content')).toBe(false);
      expect(parent.getRegion('content')).toBeUndefined();
      expect(parent.el.textContent).toBe('');
      expect(hook).not.toHaveBeenCalled();
      expect(notifications).not.toHaveBeenCalled();
    } finally {
      parent.destroy();
      child.destroy();
    }
  });
}
