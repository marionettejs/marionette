import { describe, expect, it, vi } from 'vitest';
import { Region, View } from 'marionette';

describe('Region ownership after detaching a replacement view', () => {
  for (const attached of [false, true]) {
    for (const terminate of ['empty', 'destroyRegion', 'destroyView']) {
      it(`keeps the old Region replacement intact after ${terminate}, attached=${attached}`, () => {
        const containers = [document.createElement('main'), document.createElement('main')];
        const placeholders = containers.map(container => {
          const el = document.createElement('section');
          container.append(el);
          if (attached) { document.body.append(container); }
          return el;
        });
        const first = new Region({ el: placeholders[0] });
        const second = new Region({ el: placeholders[1] });
        const released = new View({ template: false });
        const current = new View({ template: false });
        const detached = vi.fn();
        current.on('detach', detached);
        try {
          first.show(released, { replaceElement: true });
          expect(first.detachView()).toBe(released);
          second.show(released);
          first.show(current, { replaceElement: true });
          if (terminate === 'empty') { second.empty(); } else if (terminate === 'destroyRegion') { second.destroy(); } else { released.destroy(); }
          expect(released.isDestroyed()).toBe(true);
          expect(second.hasView()).toBe(false);
          expect(first.currentView).toBe(current);
          expect(first.isReplaced()).toBe(true);
          expect(containers[0].firstChild).toBe(current.el);
          expect(placeholders[0].parentNode).toBeNull();
          expect(current.isAttached()).toBe(attached);
          expect(current.isDestroyed()).toBe(false);
          expect(detached).not.toHaveBeenCalled();
        } finally {
          first.destroy();
          second.destroy();
          for (const container of containers) { container.remove(); }
        }
      });
    }
  }
});
