import { createTestScope } from '@mnjs/test/scope';
import type { Cleanable, Destroyable, TestScope, ReplyChannel, ReplyRadio } from '@mnjs/test/scope';
const scope: TestScope = createTestScope();
const owned: Cleanable = scope.own({ cleanup() { return true; } });
const channel = null as unknown as ReplyChannel;
const radio = null as unknown as ReplyRadio;
scope.reply(channel, 'request', () => 7);
scope.reply(radio, 'channel', 'request', 7, {});
// @ts-expect-error Channel names stay strings.
scope.reply(radio, 7, 'request', () => true);
// @ts-expect-error Only supplied Radio/channel objects are accepted; no global Radio lookup.
scope.reply('channel', 'request', () => true);
const destroyed: Destroyable = scope.own({ destroy() { return Promise.resolve(); } });
const optionalCleanup: { cleanup?: () => unknown; destroy(): void } = { cleanup: undefined, destroy() {} };
scope.own(optionalCleanup);
void [owned, destroyed];

// Hash registration preserves the selected channel and contextually types receivers.
const typedChannel = null as unknown as ReplyChannel & { label: string };
const typedRadio = null as unknown as ReplyRadio<typeof typedChannel>;
const receiver = { prefix: 'owned:' };
const hashChannel: typeof typedChannel = scope.reply(typedChannel, {
  label(value: string) {
    const prefix: string = this.prefix;
    // @ts-expect-error The explicit context has no channel label.
    this.label;
    return prefix + value;
  },
  disabled: false,
  missing: undefined
}, receiver);
scope.reply(typedRadio, 'typed', {
  label(value: string) {
    const prefix: string = this.prefix;
    // @ts-expect-error The explicit context has no channel label.
    this.label;
    return prefix + value;
  },
  zero: 0
}, receiver);
scope.reply(typedChannel, {
  label() { const channel: typeof typedChannel = this; return channel.label; }
});
scope.reply(typedRadio, 'typed', {
  label() { const channel: typeof typedChannel = this; return channel.label; }
});
scope.reply(typedChannel, {
  label() { const channel: typeof typedChannel = this; return channel.label; }
}, null);
scope.reply(typedRadio, 'typed', {
  label() { const channel: typeof typedChannel = this; return channel.label; }
}, false);
// @ts-expect-error Hash calls still require a string channel name.
scope.reply(typedRadio, 7, { value: true });
// @ts-expect-error Arrays are not reply maps.
scope.reply(typedChannel, [true, false]);
void hashChannel;

// Falsy primitive contexts use the channel; object contexts keep their mutability.
scope.reply(typedChannel, { label() { return this.label; } }, 0);
scope.reply(typedChannel, { label() { return this.label; } }, 0n);
scope.reply(typedRadio, 'typed', { label() { return this.label; } }, '');
scope.reply(typedChannel, { increment() { this.count++; } }, { count: 0 });
scope.reply(typedRadio, 'typed', {
  increment() {
    // @ts-expect-error An explicitly readonly context remains readonly.
    this.count++;
  }
}, { count: 0 } as const);
