import { describe, expect, it, vi } from 'vitest';
import { createMarionette } from 'marionette';

describe('MnObject Radio ownership', () => {
  it.each([undefined, null, false, 0, ''])('does not resolve bindings for missing channel %s', channelName => {
    const runtime = createMarionette();
    const radioEvents = vi.fn(() => { throw new Error('events read'); });
    const radioRequests = vi.fn(() => { throw new Error('requests read'); });
    const owner = new runtime.MnObject({ channelName, radioEvents, radioRequests });
    expect(owner.getChannel()).toBeUndefined();
    expect(radioEvents).not.toHaveBeenCalled();
    expect(radioRequests).not.toHaveBeenCalled();
    owner.destroy();
  });

  it.each([false, true])('binds events and requests with callable declarations %s', callable => {
    const runtime = createMarionette();
    const onChanged = vi.fn();
    const getValue = vi.fn().mockReturnValue('value');
    const events = { changed: 'onChanged' };
    const requests = { value: 'getValue' };
    const Owner = runtime.MnObject.extend({ onChanged, getValue });
    const owner = new Owner({
      channelName: callable ? () => 'owned' : 'owned',
      radioEvents: callable ? () => events : events,
      radioRequests: callable ? () => requests : requests
    });
    const channel = runtime.Radio.channel('owned');
    expect(owner.getChannel()).toBe(channel);
    channel.trigger('changed', 'before');
    expect(channel.request('value', 'argument')).toBe('value');
    expect(onChanged).toHaveBeenCalledExactlyOnceWith('before');
    expect(getValue).toHaveBeenCalledExactlyOnceWith('argument');
    expect(getValue.mock.contexts[0] === owner).toBe(true);
    const unrelated = vi.fn();
    channel.on('changed', unrelated);
    channel.reply('unrelated', 'retained');
    owner.destroy();
    channel.trigger('changed', 'after');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(unrelated).toHaveBeenCalledTimes(1);
    expect(channel.request('value')).toBeUndefined();
    expect(channel.request('unrelated')).toBe('retained');
    runtime.Radio.reset();
  });

  it('resolves channel, events, and requests in order on the owner', () => {
    const runtime = createMarionette();
    const calls = [];
    const declaration = (name, value) => function() { calls.push([name, this, arguments.length]); return value; };
    const owner = new runtime.MnObject({
      channelName: declaration('channel', 'owned'),
      radioEvents: declaration('events', {}),
      radioRequests: declaration('requests', {})
    });
    expect(calls.map(([name]) => name)).toEqual(['channel', 'events', 'requests']);
    expect(calls.every(([, context, count]) => context === owner && count === 0)).toBe(true);
    owner.destroy();
  });

  it('propagates declaration errors before resolving later options', () => {
    const runtime = createMarionette();
    const error = new Error('events failed');
    const radioRequests = vi.fn();
    expect(() => new runtime.MnObject({ channelName: 'owned', radioEvents() { throw error; }, radioRequests })).toThrow(error);
    expect(radioRequests).not.toHaveBeenCalled();
    runtime.Radio.reset();
  });
});
