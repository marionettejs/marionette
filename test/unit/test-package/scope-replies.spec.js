import { describe, expect, it, vi } from 'vitest';
import { createRadio } from '@mnjs/radio';
import { createTestScope } from '@mnjs/test/scope';

describe('owned Radio replies without global imports or resets', () => {
  it('supports explicit Radio and string channel/request names with receiver and arguments', async() => {
    const radio = createRadio();
    const scope = createTestScope();
    const receiver = { prefix: 'owned:' };
    scope.reply(radio, 'services', 'answer', function(value) { return this.prefix + value; }, receiver);
    expect(radio.request('services', 'answer', 'yes')).toBe('owned:yes');
    radio.reply('services', 'borrowed', 7);
    await scope.cleanup();
    expect(radio.request('services', 'answer')).toBeUndefined();
    expect(radio.request('services', 'borrowed')).toBe(7);
  });

  it('preserves default channel context, constant values, and later unrelated replacements', async() => {
    const radio = createRadio();
    const channel = radio.channel('local');
    const scope = createTestScope();
    const handler = function() { return this.channelName; };
    expect(scope.reply(channel, 'context', handler)).toBe(channel);
    expect(channel.request('context')).toBe('local');
    scope.reply(channel, 'value', false);
    expect(channel.request('value')).toBe(false);
    channel.reply('context', handler, channel);
    await scope.cleanup();
    expect(channel.request('context')).toBe('local');
    expect(channel.request('value')).toBeUndefined();
  });

  it('does not restore an overwritten prior handler or delete a later same-context reply', async() => {
    const channel = createRadio().channel('local');
    const receiver = {};
    channel.reply('answer', 'old');
    const scope = createTestScope();
    scope.reply(channel, 'answer', 'owned', receiver);
    await scope.cleanup();
    expect(channel.request('answer')).toBeUndefined();
    const next = createTestScope();
    next.reply(channel, 'answer', 'owned', receiver);
    channel.reply('answer', 'new', receiver);
    await next.cleanup();
    expect(channel.request('answer')).toBe('new');
  });

  it('rejects registration after closure before creating a channel or changing a reply', async() => {
    const radio = createRadio();
    const scope = createTestScope();
    await scope.cleanup();
    const selectChannel = vi.spyOn(radio, 'channel');
    expect(() => scope.reply(radio, 'closed', 'answer', 1)).toThrow('Cannot register');
    expect(selectChannel).not.toHaveBeenCalled();
    const channel = radio.channel('stable');
    channel.reply('answer', 'borrowed');
    expect(() => scope.reply(channel, 'answer', 2)).toThrow('Cannot register');
    expect(channel.request('answer')).toBe('borrowed');
  });
});
