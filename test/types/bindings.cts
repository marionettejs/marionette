import MnObject from '../tmp/typed-core/src/modules/object.js';
import normalizeMethods from '../tmp/typed-core/src/modules/common/normalize-methods.js';
import { bindEvents, unbindEvents } from '../tmp/typed-core/src/modules/common/bind-events.js';
import { bindRequests, unbindRequests } from '../tmp/typed-core/src/modules/common/bind-requests.js';
import type { Requests } from '../tmp/typed-core/src/mixins/requests.js';
import type { EventMap, EventSource } from '../tmp/typed-core/src/mixins/events.js';

const source = new MnObject();
const listener = {
  marker: 'listener',
  handleChange() {},
  done() {},
  listenTo(_source: EventSource, _bindings: EventMap) {},
  bindEvents,
};
const sameListener: typeof listener = listener.bindEvents(source, { changed: 'handleChange' });
const listeningOwner = {
  marker: 'owner',
  stopListening(_source: EventSource, _bindings?: EventMap) {},
  unbindEvents,
};
const sameOwner: typeof listeningOwner = listeningOwner.unbindEvents(source);
// @ts-expect-error Binding needs listenTo on the receiver, even through call.
MnObject.prototype.bindEvents.call({}, source, { changed() {} });
// @ts-expect-error Unbinding needs stopListening on the receiver.
unbindEvents.call({}, source);
// @ts-expect-error Sources need the event subscription capability.
listener.bindEvents({}, { changed() {} });

const replyChannel = { reply(_bindings: object, _context: unknown) {} };
const replyOwner = { stopReplying(_bindings?: object | null, _context?: unknown, _owner?: unknown) {} };
const owner = { marker: 'reply owner', lookup() {}, bindRequests, unbindRequests };
declare const channel: Requests;
owner.bindRequests(channel, { lookup: 'lookup' });
owner.unbindRequests(channel);
const sameReplyOwner: typeof owner = owner.bindRequests(replyChannel, { lookup: 'lookup' });
const sameUnboundOwner: typeof owner = owner.unbindRequests(replyOwner);
// @ts-expect-error Binding requires reply on the channel.
owner.bindRequests({}, {});
// @ts-expect-error Unbinding requires stopReplying on the channel.
owner.unbindRequests({}, {});

const map: EventMap = normalizeMethods({ done: () => 1 });
const absent: undefined = normalizeMethods();
const explicitAbsent: undefined = normalizeMethods(undefined);
const disabled: undefined = normalizeMethods(false);
declare const maybeBindings: object | undefined;
const maybeMap: EventMap | undefined = normalizeMethods(maybeBindings);
// @ts-expect-error A maybe-absent map cannot promise a normalized map.
const promisedMap: EventMap = normalizeMethods(maybeBindings);
// @ts-expect-error No generic argument can falsely promise a map without input.
normalizeMethods<object>();
const callableMap = Object.assign(function() {}, { done: 'done' });
const normalizer = { done() {}, normalizeMethods };
const callableResult: EventMap = normalizer.normalizeMethods(callableMap);
const taggedReference = { [Symbol.toStringTag]: 'String', toString() { return 'done'; } };
normalizer.normalizeMethods({ boxed: new String('done'), tagged: taggedReference });
listener.bindEvents(source, callableMap);
listener.bindEvents(source, false);
listeningOwner.unbindEvents(source, false);
owner.bindRequests(replyChannel, false);
owner.unbindRequests(replyOwner, false);

for (const absentSource of [false, 0, 0n, '', null, undefined] as const) {
  const bound: typeof listener = listener.bindEvents(absentSource, { changed: 'handleChange' });
  const unbound: typeof listeningOwner = listeningOwner.unbindEvents(absentSource);
  const replied: typeof owner = owner.bindRequests(absentSource, { lookup: 'lookup' });
  const stopped: typeof owner = owner.unbindRequests(absentSource);
}
declare const maybeSource: EventSource | false | 0 | 0n | '' | null | undefined;
const maybeListener: typeof listener = listener.bindEvents(maybeSource, { changed: 'handleChange' });
const maybeOwner: typeof listeningOwner = listeningOwner.unbindEvents(maybeSource);
declare const maybeChannel: Requests | false | 0 | 0n | '' | null | undefined;
const maybeReplyOwner: typeof owner = owner.bindRequests(maybeChannel, { lookup: 'lookup' });
const maybeStoppedOwner: typeof owner = owner.unbindRequests(maybeChannel);
declare const unsupportedSource: EventSource | true;
// @ts-expect-error A truthy boolean is not an event source.
listener.bindEvents(unsupportedSource, { changed: 'handleChange' });
declare const unsupportedChannel: Requests | true;
// @ts-expect-error A truthy boolean is not a reply channel.
owner.bindRequests(unsupportedChannel, { lookup: 'lookup' });

const zeroBigintMap: undefined = normalizeMethods(0n);
listener.bindEvents(source, 0n);
listeningOwner.unbindEvents(source, 0n);
owner.bindRequests(replyChannel, 0n);
owner.unbindRequests(replyOwner, 0n);
// @ts-expect-error A truthy bigint is not a binding map.
normalizeMethods(1n);
// @ts-expect-error A truthy bigint is not an event source.
listener.bindEvents(1n, {});
// @ts-expect-error A truthy bigint is not an event source.
listeningOwner.unbindEvents(1n);
// @ts-expect-error A truthy bigint is not a reply channel.
owner.bindRequests(1n, {});
// @ts-expect-error A truthy bigint is not a reply channel.
owner.unbindRequests(1n);
// @ts-expect-error A truthy bigint is not an event binding map.
listener.bindEvents(source, 1n);
// @ts-expect-error A truthy bigint is not an event binding map.
listeningOwner.unbindEvents(source, 1n);
// @ts-expect-error A truthy bigint is not a reply binding map.
owner.bindRequests(replyChannel, 1n);
// @ts-expect-error A truthy bigint is not a reply binding map.
owner.unbindRequests(replyOwner, 1n);
