import { describe, it, expect, vi } from 'vitest';
import { Region, View } from 'marionette';
import { setFixtures } from '../setup/fixtures.js';

describe('nested View lifecycle propagation', function() {
  for (const options of [
    { template: false },
    { template: () => '<p>No regions</p>' },
    { template: () => '<main></main><footer></footer>', regions: { main: 'main', footer: 'footer' } }
  ]) {
    it('attaches and detaches a View with no shown children', function() {
      setFixtures('<section id="owner"></section>');
      const region = new Region({ el: '#owner' });
      const view = new View(options);
      const attached = vi.fn();
      const detached = vi.fn();
      view.on('attach', attached);
      view.on('detach', detached);

      region.show(view);
      expect(view.isAttached()).toBe(true);
      expect(attached).toHaveBeenCalledTimes(1);
      expect(region.detachView()).to.equal(view);
      expect(view.isAttached()).toBe(false);
      expect(detached).toHaveBeenCalledTimes(1);
      view.destroy();
      region.destroy();
    });
  }

  it('propagates lifecycle once to shown children and nested descendants, excluding empty regions', function() {
    setFixtures('<section id="owner"></section>');
    const region = new Region({ el: '#owner' });
    const parent = new View({
      template: () => '<main></main><footer></footer><aside></aside>',
      regions: { main: 'main', footer: 'footer', unused: 'aside' }
    });
    const child = new View({ template: () => '<span></span>', regions: { nested: 'span' } });
    const sibling = new View({ template: () => 'sibling' });
    const grandchild = new View({ template: () => 'grandchild' });
    parent.showChildView('main', child);
    parent.showChildView('footer', sibling);
    child.showChildView('nested', grandchild);
    const descendants = [parent, child, sibling, grandchild];
    const lifecycle = descendants.map(view => {
      const attached = vi.fn();
      const detached = vi.fn();
      view.on('attach', attached);
      view.on('detach', detached);
      return { view, attached, detached };
    });

    region.show(parent);
    for (const { view, attached } of lifecycle) {
      expect(view.isAttached()).toBe(true);
      expect(attached).toHaveBeenCalledTimes(1);
    }
    region.detachView();
    for (const { view, detached } of lifecycle) {
      expect(view.isAttached()).toBe(false);
      expect(view.isDestroyed()).toBe(false);
      expect(detached).toHaveBeenCalledTimes(1);
    }
    parent.destroy();
    expect(descendants.every(view => view.isDestroyed())).toBe(true);
    region.destroy();
  });
});
