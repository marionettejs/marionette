import { describe, expect, it, vi } from 'vitest';
import { Events, Region, View } from 'marionette';

describe('public ownership gaps discovered by the mutation pilot', () => {
  it('stops Region-owned subscriptions when the Region is destroyed', () => {
    const source = Object.assign({}, Events);
    const handler = vi.fn();
    const region = new Region({ el: document.createElement('section') });
    region.listenTo(source, 'change', handler);
    source.trigger('change', 'before');
    expect(handler).toHaveBeenCalledExactlyOnceWith('before');
    region.destroy();
    source.trigger('change', 'after');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('explains conflicting ownership and links to the showing contract', () => {
    const first = new Region({ el: document.createElement('section') });
    const second = new Region({ el: document.createElement('section') });
    const view = new View({ template: false });
    try {
      first.show(view);
      expect(() => second.show(view)).toThrowError(expect.objectContaining({
        code: 'MN0003',
        message: expect.stringMatching(/already managed/),
        url: expect.stringMatching(/marionette\.region\.html#showing-a-view$/)
      }));
      expect(first.currentView).toBe(view);
      expect(second.hasView()).toBe(false);
    } finally {
      first.destroy();
      second.destroy();
    }
  });
});
