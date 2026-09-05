import Events from '../tmp/typed-core/src/mixins/events.js';
import type { EventMap, EventSource } from '../tmp/typed-core/src/mixins/events.js';
import callHandler from '../tmp/typed-core/src/utils/call-handler.js';
import onceWrap from '../tmp/typed-core/src/utils/once-wrap.js';
import buildEventArgs from '../tmp/typed-core/src/utils/build-event-args.js';

const receiver = { ...Events, value: 1 };
const eventMap: EventMap = { change(value: number) { return value; } };
const same: typeof receiver = receiver.on('change', eventMap.change).once(eventMap).trigger('change', 2);
receiver.on(eventMap, { fallback: true }, { explicit: true });
receiver.once(eventMap, { fallback: true }, { explicit: true });
receiver.off(eventMap, { fallback: true }, { explicit: true });
receiver.listenTo(null, 'change').listenTo(undefined, eventMap);
receiver.listenToOnce(null, 'change').listenToOnce(undefined, eventMap);
receiver.stopListening().off(null);
// A foreign emitter needs only its own on/off protocol, with no Marionette fields.
const external = {
  on(name: string, callback?: (...args: unknown[]) => void, context?: object) {
    return this;
  },
  off(name?: string | null, callback?: ((...args: unknown[]) => void) | null, context?: object) {
    return this;
  }
};
const source: EventSource = external;
const listener: typeof receiver = receiver.listenTo(external, eventMap).stopListening(external, eventMap);
receiver.listenToOnce(external, 'change', eventMap.change);
// @ts-expect-error Event maps contain callable handlers.
receiver.on({ change: 1 });
// @ts-expect-error Event callbacks must be callable.
receiver.on('change', 'methodName');
// @ts-expect-error Listening requires the source's on/off protocol.
receiver.listenTo({}, 'change', () => {});
// @ts-expect-error A source must accept callback functions.
receiver.listenTo({ on(name: string, callback: string) {}, off() {} }, 'change', () => {});
// @ts-expect-error Receiver members retain their types through event chains.
const wrongReceiver: string = receiver.on(eventMap).value;

function format(this: { base: number }, value: number, label: string) {
  return `${label}:${this.base + value}`;
}
const formatted: string = callHandler(format, { base: 1 }, [2, 'sum']);
const noArguments: number = callHandler(() => 1, undefined);
// @ts-expect-error Callback arguments retain their tuple types.
callHandler(format, { base: 1 }, ['wrong', 'sum']);
// @ts-expect-error Required callback arguments cannot be omitted.
callHandler(format, { base: 1 });
// @ts-expect-error The callback's receiver type is checked.
callHandler(format, { base: 'wrong' }, [2, 'sum']);

// Default request handlers receive the original arguments, including the name.
function defaultRequest(name: string, value: number) {
  function fallback(this: { prefix: string }, requestName: string, requestValue: number) {
    return `${this.prefix}:${requestName}:${requestValue}`;
  }
  const result: string = callHandler(fallback, { prefix: 'request' }, arguments);
  // @ts-expect-error Forwarding IArguments still checks the callback's receiver.
  callHandler(fallback, { prefix: 1 }, arguments);
  // @ts-expect-error Forwarding IArguments preserves the callback's result type.
  const wrongResult: number = callHandler(fallback, { prefix: 'request' }, arguments);
  return result;
}

const once = onceWrap(format, wrapper => {
  const original: typeof format = wrapper._callback;
});
const possible: string | undefined = once.call({ base: 1 }, 2, 'sum');
const original: typeof format = once._callback;
// @ts-expect-error Reentry or an earlier exception can leave the cached result undefined.
const definite: string = once.call({ base: 1 }, 2, 'sum');
// @ts-expect-error Once wrapping preserves required callback argument types.
once.call({ base: 1 }, 'wrong', 'sum');

const metadata = { listenerId: 'example' };
const normalized = buildEventArgs(eventMap, undefined, { context: true }, metadata);
const listenerId: string = normalized[0].listener.listenerId;
const noListener: undefined = buildEventArgs('change', eventMap.change)[0].listener;
// @ts-expect-error Normalization does not invent listener metadata fields.
normalized[0].listener.missing;
// The normalizer also supports request values, so callbacks remain unknown here.
const requestValue: unknown = buildEventArgs({ answer: 42 })[0].callback;
// @ts-expect-error An unvalidated normalized value is not necessarily callable.
buildEventArgs({ answer: 42 })[0].callback();
