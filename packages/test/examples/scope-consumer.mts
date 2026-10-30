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
