import MnObject from '../tmp/typed-core/src/modules/object.js';
import normalizeMethods from '../tmp/typed-core/src/modules/common/normalize-methods.js';
import { bindEvents, unbindEvents } from '../tmp/typed-core/src/modules/common/bind-events.js';
import { bindRequests, unbindRequests } from '../tmp/typed-core/src/modules/common/bind-requests.js';
import type { Requests } from '../tmp/typed-core/src/mixins/requests.js';
import type { EventMap, EventSource } from '../tmp/typed-core/src/mixins/events.js';

const source = new MnObject();
const listener = {
  marker: 'listener',
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
const owner = { marker: 'reply owner', bindRequests, unbindRequests };
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
const callableResult: EventMap = normalizeMethods(callableMap);
const taggedReference = { [Symbol.toStringTag]: 'String', toString() { return 'done'; } };
normalizeMethods({ boxed: new String('done'), tagged: taggedReference });
listener.bindEvents(source, callableMap);
listener.bindEvents(source, false);
listeningOwner.unbindEvents(source, false);
owner.bindRequests(replyChannel, false);
owner.unbindRequests(replyOwner, false);
