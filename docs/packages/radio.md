# @mnjs/radio

Radio provides named channels for events and request/reply messaging. An event
notifies subscribers; a request calls one reply handler and returns its result.
Use a channel when participants need a shared messaging address. Direct method
calls and [object events](../api/shared/events.md) remain useful when the
participants already hold references to one another.

## Imports and registry scope

`marionette` exports the default `Radio` instance from `@mnjs/radio`. Core uses
Radio for Application and MnObject's declarative channel bindings. The package
can also be used without core or a DOM; it depends on `@mnjs/utils`.

```js
import { Radio } from '@mnjs/radio';

const preferences = Radio.channel('preferences');
const changes = [];
preferences.on('theme:changed', theme => changes.push(theme));
preferences.reply('theme', 'dark');

const theme = preferences.request('theme');
preferences.trigger('theme:changed', theme);
```

Within the same installed package copy and module format, importing `Radio` from
core or the companion package reaches the same registry. ESM and CommonJS have
separate default instances. Separate installed copies also do not share state.

`createRadio()` returns an independent `RadioApi`, with its own channels and
logging configuration. Each `createMarionette()` runtime has its own `Radio` too:
use `runtime.Radio` to communicate with objects from that runtime. See
[runtime isolation](../api/runtime.md#isolation-and-composition).

| Registry API | Contract |
| --- | --- |
| `radio.channel(name)` | Returns the existing channel or creates it. Names are nonempty strings. A missing/falsy name throws `MN0017`. |
| `radio.Channel` | The constructor used for new channels in this registry. Channels already created keep their identity. |
| `radio.reset(name)` | Resets an existing registered channel. An unknown name throws `MN0021`; a supplied falsy name (including `undefined`) throws `MN0017`. Returns `undefined`. |
| `radio.reset()` | Resets all registered channels. Returns `undefined`. |

Reset clears handlers but preserves registered channel objects: later
`radio.channel(name)` calls return the same channel.

## Channel events

A channel provides the complete [Events API](../api/shared/events.md): `on`,
`once`, `off`, `listenTo`, `listenToOnce`, `stopListening`, `trigger`, and
`triggerMethod`. Names are literal strings, including spaces; maps register
multiple names. Events run synchronously and ignore callback return values.
`triggerMethod` calls the channel's matching `onEventName` hook before emitting
the event and returns that hook's result.

Every Events and Requests method is also available on the registry, with the
channel name as its first argument. For example,
`radio.trigger('preferences', 'theme:changed', 'dark')` forwards to the named
channel. Forwarded methods create a missing channel and return the channel
method's result. Registration methods return the **channel**, so chaining
`radio.on(...)` continues on that channel rather than on the registry.

Channels expose `channelName`, the name supplied at construction. They have no
Application start/stop lifecycle or automatic destruction. Use the owner and
cleanup rules below when their useful lifetime ends.

## Requests and replies

A request name has one active reply handler. A later `reply` or `replyOnce` for
the same name replaces the earlier registration. Request names, like event
names, are literal strings. Replies and event subscriptions are separate: an
`on('theme', handler)` subscription does not answer `request('theme')`.

| Channel or Requests method | Contract and return value |
| --- | --- |
| `reply(name, callbackOrValue, context?)` / `reply(map, context?)` | Registers a function or a constant value. Returns the receiver. |
| `replyOnce(name, callbackOrValue, context?)` / `replyOnce(map, context?)` | Registers a reply removed before its first invocation, including when it throws. Each mapped name has its own one-time reply. Returns the receiver. |
| `request(name, ...args)` | Calls the matching reply with the supplied arguments and returns its result unchanged. Returns `undefined` when neither a matching nor default reply exists. |
| `request(map, ...extraArgs)` | Requests each own enumerable string key, passing its mapped value first, then the extra arguments. Returns an object keyed by request name. |
| `stopReplying(name?, callbackOrValue?, context?)` / `stopReplying(map, context?)` | Removes replies matching all supplied filters. Omit the name or pass `null` to select all names. With no filters, removes all replies. Returns the receiver. |

Functions use the supplied truthy context, or the receiver as `this`. Arrow
functions keep their lexical context. Registration/removal maps also accept an
explicit third context argument; a truthy third argument takes precedence over
the second. Map values can be functions or constants, including `false`, `0`,
`null`, and `undefined`. In `stopReplying`, falsy callback/context arguments mean
no filter; use the name to remove a reply registered with a falsy constant.
Removing a one-time reply may use its original function reference.

```js
import { createRadio } from '@mnjs/radio';

const catalog = createRadio().channel('catalog');
const titles = new Map([['a', 'Overview'], ['b', 'Release notes']]);
catalog.reply({
  title: id => titles.get(id),
  count: () => titles.size,
});

const summary = catalog.request({ title: 'b', count: undefined });
catalog.replyOnce('welcome', 'Welcome back');
const welcome = catalog.request('welcome');
const repeatedWelcome = catalog.request('welcome');
```

A reply named `default` handles requests with no exact match. It receives
`(requestedName, ...args)`; an exact match takes precedence. Requesting the name
`default` itself is an exact match, so it receives only the caller's arguments.

Dispatch is synchronous. A thrown exception propagates to the caller. A reply
may return a Promise, which `request` returns without awaiting, cancelling, or
retrying it. A request map returns an object of results, not a Promise combining
them. The owner of an operation remains responsible for its completion and
lifetime.

## Lifetime and cleanup

Use `listenTo(channel, ...)` to tie subscriptions to a Marionette object's
lifetime. Destroying that object removes its event subscriptions. Request
replies have separate ownership: `stopListening()` does not remove them. Pair
manual replies with `stopReplying` or the owner's
[`unbindRequests`](../api/shared/common.md#binding-helpers).

Application and MnObject provide
[`channelName`, `radioEvents`, and `radioRequests`](../api/shared/common.md#declarative-radio-bindings).
Their destruction removes the configured channel's replies whose context is
that owner and releases its subscriptions. Application `stop()` retains those
bindings. The shared channel survives; other participants' handlers remain.

`channel.reset()` calls `off()`, `stopListening()`, and `stopReplying()`, then
returns the channel. It removes incoming event callbacks, outgoing subscriptions,
and replies. Use it when the whole channel's handlers should be cleared, such as
at the end of an isolated test. Selective cleanup is appropriate when other
participants still use the channel. Reset neither cancels returned Promises nor
emits a destruction event.

### Standalone channels and Requests

```js
import { Channel, Requests } from '@mnjs/radio';

const local = new Channel('preview');
local.reply('title', 'Preview');
const previewTitle = local.request('title');
local.reset();

const service = Object.assign({ ready: true }, Requests);
service.reply('ready', function() { return this.ready; });
const ready = service.request('ready');
service.stopReplying();
```

`new Channel(name)` creates an independent channel without registering it with
Radio. Two standalone channels with the same name are different objects, and
`Radio.reset()` does not reach them. The named `Channel` export is the default
`Radio.Channel`; `new radio.Channel(name)` uses that instance's logging
configuration.

`Requests` is a method mixin, not a constructor. Assign it to an object or a
prototype to add `reply`, `replyOnce`, `request`, and `stopReplying`. Each receiver
stores its own replies. It adds no Events API, channel registry, reset method,
or destruction lifecycle. Its warnings use the default Radio configuration.

## Logging

```js
import { createRadio } from '@mnjs/radio';

const radio = createRadio();
const activity = [];
const warnings = [];
radio.log = (channel, name, ...args) => activity.push({ channel, name, args });
radio.debugLog = (warning, name, channel) => warnings.push({ warning, name, channel });
radio.setDebug();
radio.tuneIn('settings');
radio.trigger('settings', 'opened');
radio.request('settings', 'missing');
radio.tuneOut('settings');
```

| Registry member | Contract |
| --- | --- |
| `tuneIn(name)` | Creates/gets the channel and logs its events and requests. Event logging subscribes to `all`. Returns this Radio instance. |
| `tuneOut(name)` | Creates/gets the channel and stops its activity logging. Returns this Radio instance. |
| `setDebug(enabled = true)` | Enables/disables warning delivery for unhandled requests and overwritten replies. Initially disabled. Returns `undefined`. |
| `log(channelName, name, ...args)` | Assignable activity hook; defaults to console logging. Tuning is independent of `setDebug`. |
| `debugLog(warning, name, channelName?)` | Assignable warning hook; defaults to console warnings. Standalone Requests receivers may have no channel name. |

Hooks run with the Radio instance as `this`; existing channels use the current
hook even after replacement. Hook exceptions propagate. Disabling debug also
suppresses automatic calls to custom warning hooks.

Call `tuneIn` once per logging session; repeated calls add repeated event
subscriptions. Pair it with `tuneOut` before resetting a tuned channel: reset
removes the `all` subscription but does not clear the request-logging flag.

## Types and entrypoints

The package root supports ESM named imports and CommonJS destructuring. Its
runtime exports are `Radio`, `createRadio`, `Channel`, and `Requests`; it has no
default package export. Types include `RadioApi`, `ChannelConstructor`, `Channel`,
and `Requests`. The latter two names have both type and runtime meanings.
`marionette` re-exports the `Radio` value and the `RadioApi`, `Channel`, and
`Requests` types; import the other runtime values from `@mnjs/radio`.

```ts
import { createRadio, type RadioApi, type Channel } from '@mnjs/radio';

const radio: RadioApi = createRadio();
const channel: Channel = radio.channel('settings');
channel.reply('theme', 'dark');
const result = channel.request('theme');
const theme = typeof result === 'string' ? result : 'system';
```

Dynamic request names do not define a result schema: `request(name)` returns
`unknown`, and map requests return `Record<string, unknown>`. Narrow the result
at the boundary or put a typed function around a known channel contract.
Fluent registration/removal methods preserve the receiver; registry forwarding
returns a Channel rather than Radio. `channel.reset()` returns the channel,
while `radio.reset()` returns `void`.

[Reference index](../api.md) · [Events](../api/shared/events.md) · [Owner bindings](../api/shared/common.md#declarative-radio-bindings)
