import Requests from '../tmp/typed-core/src/mixins/requests.js';
import { createDebug, debugLog, log } from '../tmp/typed-core/src/modules/common/radio.js';
import type { Channel } from '../tmp/typed-core/src/modules/object.js';

const receiver = { ...Requests, label: 'Example' };
const callback = function(this: { label: string }, count: number) { return this.label.repeat(count); };
const same: typeof receiver = receiver.reply('label', callback, receiver)
  .replyOnce('ready', false).stopReplying('ready');
receiver.reply({ label: callback, ready: true, absent: null }, receiver, { label: 'Explicit' });
receiver.replyOnce({ 'first second': callback }, receiver);
receiver.stopReplying({ label: callback }, receiver).stopReplying(null).stopReplying();
receiver.reply('default', function(name: string, ...args: unknown[]) { return { name, args }; });
const unknownReply: unknown = receiver.request('missing', 1, 2, 3, 4);
const replies: Record<string, unknown> = receiver.request({ 'first second': 2, ready: undefined }, 'extra');
const splitReply: unknown = receiver.request('first second', 2);
// @ts-expect-error A request with no schema cannot promise the reply type.
const invalidReply: string = receiver.request('label', 2);
// @ts-expect-error Request map results retain unknown values.
const invalidMapReply: boolean = replies.ready;
// @ts-expect-error Request names must be strings or maps.
receiver.request(123);
// @ts-expect-error A request name is required.
receiver.request();
// @ts-expect-error Registration names must be strings or maps.
receiver.reply(false, callback);
// @ts-expect-error Stop names must be strings, maps, or nullish.
receiver.stopReplying(123);
// @ts-expect-error Fluent returns preserve the receiver without extra fields.
const invalidReceiver: typeof receiver & { missing: true } = receiver.reply('ready', true);

declare const channel: Channel & { extra(): boolean };
const extendedChannel: typeof channel = channel.reply('ready', true).replyOnce({ label: 'Example' }).stopReplying();
const channelResult: boolean = extendedChannel.extra();
const channelReplies: Record<string, unknown> = channel.request({ ready: undefined });

const debug = createDebug();
const debugResult: void = debug.setDebug();
debug.setDebug(false);
debug.debugLog('Unhandled', 'label');
debugLog('Unhandled', 'label', 'example');
log('example', 'label', 1, { ready: true });
// @ts-expect-error Debug mode requires a boolean.
debug.setDebug('yes');
// @ts-expect-error Warning text must be a string.
debug.debugLog(123, 'label');
// @ts-expect-error Log event names must be strings.
log('example', 123);
