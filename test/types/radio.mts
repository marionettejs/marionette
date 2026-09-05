import Radio, { createRadio, type Channel, type RadioApi } from '../tmp/typed-core/src/modules/radio.js';
import type { EventSource } from '../tmp/typed-core/src/mixins/events.js';

const runtime: RadioApi = createRadio();
const channel: Channel = runtime.channel('work');
const context = { prefix: 'Example' };
const handler = function(this: typeof context, count: number) { return this.prefix.repeat(count); };
const events = { 'count other': handler };
declare const source: EventSource;

// Every overloaded Events method keeps its string/map forms and explicit contexts.
const on: Channel = runtime.on('work', 'count', handler, context);
const onMap: Channel = runtime.on('work', events, undefined, context);
const once: Channel = runtime.once('work', 'count', handler, context);
const onceMap: Channel = runtime.once('work', events, undefined, context);
const off: Channel = runtime.off('work', null, null, context);
const offMap: Channel = runtime.off('work', events, undefined, context);
runtime.off('work');
const trigger: Channel = runtime.trigger('work', 'count', 2);
const triggerMap: Channel = runtime.trigger('work', { count: 2 });
const methodResult: unknown = runtime.triggerMethod('work', 'count', 2);
const listening: Channel = runtime.listenTo('work', source, 'count', handler);
runtime.listenTo('work', source, events);
runtime.listenTo('work', null, events);
const listeningOnce: Channel = runtime.listenToOnce('work', source, events);
runtime.listenToOnce('work', source, 'count', handler);
runtime.listenToOnce('work', undefined, 'count', handler);
const stopped: Channel = runtime.stopListening('work', source, events, handler);
runtime.stopListening('work', source, 'count', handler);
runtime.stopListening('work', null, null, null);
runtime.stopListening('work');

const reply: Channel = runtime.reply('work', 'count', handler, context);
const replyMap: Channel = runtime.reply('work', { count: handler, ready: false }, undefined, context);
const replyOnce: Channel = runtime.replyOnce('work', 'ready', 0);
runtime.replyOnce('work', { count: handler, ready: null }, context);
const stopReply: Channel = runtime.stopReplying('work', 'count', handler, context);
runtime.stopReplying('work', { count: handler }, undefined, context);
runtime.stopReplying('work', null);
runtime.stopReplying('work');
const request: unknown = runtime.request('work', 'count other', 2);
const requests: Record<string, unknown> = runtime.request('work', { count: 2, ready: undefined }, 'extra');
const tuned: RadioApi = runtime.tuneIn('work').tuneOut('work');
const debug: void = runtime.setDebug(false);
const resetOne: void = runtime.reset('work');
const resetAll: void = runtime.reset();

const extended = Object.assign(channel, { extra() { return true; } });
const retained: typeof extended = extended.on(events, context).reply('ready', false).reset();
const extra: boolean = retained.extra();
const borrowed: Channel = Radio.on.call({}, 'work', events, context);

// @ts-expect-error A channel name is required.
runtime.channel();
// @ts-expect-error Supplied undefined is not the no-argument reset operation.
runtime.reset(undefined);
// @ts-expect-error Channel names are strings.
runtime.on(5, 'count', handler);
// @ts-expect-error Event callbacks must be callable.
runtime.on('work', 'count', true);
// @ts-expect-error Event map values must be callable.
runtime.once('work', { count: false });
// @ts-expect-error Sources must provide on and off.
runtime.listenTo('work', {}, 'count', handler);
// @ts-expect-error Sources must provide on and off for once listening too.
runtime.listenToOnce('work', { on() {} }, events);
// @ts-expect-error Off maps do not accept boolean handlers.
runtime.off('work', { count: true });
// @ts-expect-error Stop names must be strings, maps or nullish.
runtime.stopListening('work', source, 42);
// @ts-expect-error Trigger names must be strings or maps.
runtime.trigger('work', 42);
// @ts-expect-error Method names must be strings.
runtime.triggerMethod('work', 42);
// @ts-expect-error Request names must be strings or maps.
runtime.request('work', false);
// @ts-expect-error Request registration names must be strings or maps.
runtime.reply('work', false, handler);
// @ts-expect-error Reply-once names must be strings or maps.
runtime.replyOnce('work', false, handler);
// @ts-expect-error Stop names must be strings, maps or nullish.
runtime.stopReplying('work', 42);
// @ts-expect-error Dynamic replies cannot promise a string result.
const promised: string = runtime.request('work', 'count', 2);
// @ts-expect-error Map results preserve unknown values.
const promisedMap: number = requests.count;
// @ts-expect-error Forwarded event methods return the channel, not Radio.
const wrongReceiver: RadioApi = runtime.on('work', 'count', handler);
// @ts-expect-error Channel reset returns the channel, not void.
const wrongChannelReset: void = channel.reset();
// @ts-expect-error Radio reset returns void, not Channel.
const wrongRadioReset: Channel = runtime.reset('work');
// @ts-expect-error Debug switches require boolean values.
runtime.setDebug('yes');
// @ts-expect-error Private implementation constructors are not public Radio properties.
runtime.Channel;
