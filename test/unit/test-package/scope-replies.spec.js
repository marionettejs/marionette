import { describe, expect, it, vi } from 'vitest';
import { createRadio } from '@mnjs/radio';
import { createTestScope } from '@mnjs/test/scope';

const hashForms = [
  ['channel', (scope, radio, replies, context) => scope.reply(radio.channel('hash'), replies, context)],
  ['named Radio', (scope, radio, replies, context) => scope.reply(radio, 'hash', replies, context)]
];

describe.each(hashForms)('owned reply hash through %s', (name, register) => {
  it('preserves custom receivers, arguments and heterogeneous constant values', async() => {
    const radio = createRadio();
    const scope = createTestScope();
    const receiver = { prefix: 'owned:' };
    const pending = Promise.resolve('later');
    const channel = register(scope, radio, {
      answer(value) { return this.prefix + value; },
      disabled: false, zero: 0, empty: '', nil: null, missing: undefined, pending
    }, receiver);
    expect(channel).toBe(radio.channel('hash'));
    expect(channel.request('answer', 'yes')).toBe('owned:yes');
    for (const [key, value] of Object.entries({ disabled: false, zero: 0, empty: '', nil: null, missing: undefined, pending })) {
      expect(channel.request(key)).toBe(value);
    }
    await scope.cleanup();
    expect(channel.request('answer')).toBeUndefined();
    expect(channel.request('disabled')).toBeUndefined();
    expect(channel.request('zero')).toBeUndefined();
    expect(channel.request('pending')).toBeUndefined();
  });

  it.each([undefined, null, false, 0, 0n, ''])('uses the channel for an omitted/falsy context (%s)', async(context) => {
    const radio = createRadio();
    const scope = createTestScope();
    const channel = register(scope, radio, { receiver() { return this; } }, context);
    expect(channel.request('receiver')).toBe(channel);
    await scope.cleanup();
  });

  it('owns each key separately and preserves a later same-function/context replacement', async() => {
    const radio = createRadio();
    const channel = radio.channel('hash');
    const scope = createTestScope();
    const receiver = channel;
    const handler = function() { return this.channelName; };
    channel.reply('borrowed', true);
    register(scope, radio, { replaced: handler, removed: handler }, receiver);
    channel.reply('replaced', handler, receiver);
    await scope.cleanup();
    expect(channel.request('replaced')).toBe('hash');
    expect(channel.request('removed')).toBeUndefined();
    expect(channel.request('borrowed')).toBe(true);
  });

  it('registers own enumerable string keys literally and does not restore overwritten replies', async() => {
    const radio = createRadio();
    const channel = radio.channel('hash');
    const scope = createTestScope();
    const replies = Object.assign(Object.create({ inherited: 'ignore' }), {
      constructor: 'constructor name', toString: 'string name', 'two words': 2
    });
    Object.defineProperty(replies, '__proto__', { value: 'prototype name', enumerable: true });
    Object.defineProperty(replies, 'hidden', { value: 'ignore' });
    replies[Symbol('symbol')] = 'ignore';
    channel.reply({ inherited: 'borrowed', hidden: 'borrowed', ['__proto__']: 'old' });
    register(scope, radio, replies);
    expect(channel.request('__proto__')).toBe('prototype name');
    expect(channel.request('constructor')).toBe('constructor name');
    expect(channel.request('toString')).toBe('string name');
    expect(channel.request('two words')).toBe(2);
    await scope.cleanup();
    for (const key of Object.keys(replies)) { expect(channel.request(key)).toBeUndefined(); }
    expect(channel.request('inherited')).toBe('borrowed');
    expect(channel.request('hidden')).toBe('borrowed');
  });
});

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
    expect(() => scope.reply(radio, 'closed', { answer: 1 })).toThrow('Cannot register');
    expect(selectChannel).not.toHaveBeenCalled();
    const channel = radio.channel('stable');
    channel.reply('answer', 'borrowed');
    expect(() => scope.reply(channel, 'answer', 2)).toThrow('Cannot register');
    expect(() => scope.reply(channel, { answer: 2 })).toThrow('Cannot register');
    expect(channel.request('answer')).toBe('borrowed');
  });
});
