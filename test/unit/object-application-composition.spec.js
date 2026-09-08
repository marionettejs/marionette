import { describe, it, expect, vi } from 'vitest';
import { createMarionette } from 'marionette';

describe('Object and Application public owner contracts', () => {
  for (const className of ['MnObject', 'Application']) {
    it(`${className} shares Events and releases Radio handlers through destruction`, async() => {
      const runtime = createMarionette();
      const onMessage = vi.fn();
      const Owner = runtime[className].extend({
        channelName: 'owner-contract',
        radioEvents: { message: onMessage },
        radioRequests: { value: () => 42 }
      });
      const owner = new Owner({ state: { ready: true } });
      const event = vi.fn();
      owner.on('local', event);
      owner.trigger('local', 'value');
      expect(event).toHaveBeenCalledWith('value');
      expect(owner.getState()).toEqual({ ready: true });
      runtime.Radio.trigger('owner-contract', 'message');
      expect(onMessage).toHaveBeenCalledOnce();
      expect(runtime.Radio.request('owner-contract', 'value')).toBe(42);
      await owner.destroy();
      runtime.Radio.trigger('owner-contract', 'message');
      expect(onMessage).toHaveBeenCalledOnce();
      expect(runtime.Radio.request('owner-contract', 'value')).toBeUndefined();
      expect(owner.isDestroyed()).toBe(true);
    });
  }
});
