# Radio

Use `Radio` to send events or request values between parts of an application
that do not need a direct reference to each other. Channels keep those messages
organized by name. Import Radio directly from Marionette:

```javascript
import { Radio } from 'marionette';
```

Radio is included in `marionette`; it does not require a separate
`backbone.radio` installation.

The built-in singleton does not share channels with `backbone.radio`. Migrate
all application imports atomically, including code that publishes or requests
outside Marionette classes; mixing both packages creates disconnected buses.
See [Atomic Radio migration](../upgradeGuide.md#atomic-radio-migration).

## Documentation Index

* [Channels](#channels)
* [Events](#events)
* [Requests and Replies](#requests-and-replies)
* [Debugging](#debugging)
* [Channel Lifecycle](#channel-lifecycle)
* [Marionette Integration](#marionette-integration)

## Channels

A channel provides a namespace for events and requests. Retrieve one with
`Radio.channel(name)`:

```javascript
import { Radio } from 'marionette';

const notifications = Radio.channel('notifications');
```

Calling `Radio.channel(name)` again with the same name returns the same channel
instance. A channel name is required. Channel names that match inherited object
properties, such as `toString`, are treated as ordinary channel names.

Use `new Channel(name)` from `@marionette/radio` for an independent message bus.
It combines Events and Requests but does not join the registry. Its owner must
call `channel.reset()` when finished. `Radio.reset()` covers registered channels.
The named `Channel` export is `Radio.Channel`; an isolated runtime provides its
own constructor at `runtime.Radio.Channel`.

For request/reply alone, import `Requests` from `@marionette/radio` and compose it
with `Object.assign({}, Requests)`. It adds no event methods or registry.

## Events

Channels provide event-style messaging with methods including `on`, `once`,
`off`, `trigger`, `listenTo`, and `stopListening`.

```javascript
import { Radio } from 'marionette';

const session = Radio.channel('session');

session.on('expired', function(reason) {
  console.log(`Session expired: ${ reason }`);
});

session.trigger('expired', 'signed out remotely');
session.off('expired');
```

Use events when zero or more listeners may react to a notification and the
sender does not need a return value.

## Requests and Replies

Channels also provide request/reply messaging. Register one reply with
`reply`, then call it with `request`:

```javascript
import { Radio } from 'marionette';

const account = Radio.channel('account');
const accountService = { currentUser: { id: 'example' } };

account.reply('current:user', function() {
  return this.currentUser;
}, accountService);

const currentUser = account.request('current:user');
```

Arguments passed after the request name are passed to the reply handler, and
the handler's return value is returned from `request`. Invocation is synchronous:
a thrown error reaches the caller immediately; a returned Promise is passed
through unchanged and must be awaited or handled by the caller. Radio does not
add cancellation, retries, or error handling.

A named handler takes precedence over a handler registered as `default`.
The default handler receives `(requestName, ...args)`. With neither handler,
`request` returns `undefined` and may emit a debug warning. A non-function value
registered with `reply(name, value)` is returned as-is for each request.
Registering a second reply for the same name replaces the first; it does not
multicast the request.

`reply`, `replyOnce`, and `stopReplying` return the channel or Requests receiver.
A `replyOnce` handler is removed before invocation, including when it throws or
makes a reentrant request. Removing it by its original callback before invocation
also cancels it. Choose ordinary events when several independent listeners need
to react to the same notification.

Only explicitly registered own handlers are eligible for a named request or
the `default` fallback. Names matching inherited object properties, including
`constructor`, `toString`, and `__proto__`, are ordinary request names. Result
maps from object-form or space-separated requests likewise define safe own
string properties. When an object-form key contains multiple space-separated
names, the nested result contributes its own enumerable string and symbol
properties; inherited and non-enumerable properties are ignored.

Use `replyOnce` for a handler that should be removed after its first request.
Use `stopReplying` to remove one or more handlers:

```javascript
account.replyOnce('status:ready', () => true);
account.stopReplying('current:user');
```

The request registration methods retain Backbone.Radio's customization
seams: `replyOnce` installs its wrapper through overridable `reply`, and map or
space-separated `reply`, `replyOnce`, and `stopReplying` calls dispatch each
entry through the corresponding public method. For object-form `request`, the
mapped value is the first handler argument and any arguments after the map are
forwarded after it.

Use requests when one handler owns an operation or when the sender needs a
return value.

## Debugging

Enable Radio debug warnings with `setDebug`:

```javascript
import { Radio } from 'marionette';

Radio.setDebug();
```

Debug mode warns when a request handler is overwritten or an unhandled request
is made. Disable it explicitly when it is no longer needed:

```javascript
Radio.setDebug(false);
```

`Radio.log(channelName, eventName, ...args)` receives activity from `tuneIn()`.
`Radio.debugLog(warning, eventName, channelName)` receives warnings while debug
mode is enabled. Assign either hook to route output to an application logger or
test collector. Both default to console output.

```javascript
import { createMarionette } from 'marionette';

const runtime = createMarionette();
runtime.Radio.debugLog = (warning, eventName, channelName) => {
  console.warn({ warning, eventName, channelName });
};
runtime.Radio.setDebug();
```

Hooks belong to each Radio instance and run with that Radio as `this`. Replacing
a hook affects existing channels, including tuned channels. Disabling debug mode
also disables delivery to custom warning hooks. Exceptions from hooks propagate.
Standalone `Channel` and `Requests` imports use the default Radio's warning
configuration; `new runtime.Radio.Channel(name)` uses that runtime's configuration.

## Channel Lifecycle

Channels are shared by name within their Radio runtime and remain available for that
runtime's lifetime. Root imports use one default Radio. Each
[`createMarionette()`](./runtime-isolation.md) call returns an isolated Radio and
channel registry. Clean up handlers when their owning object or feature is destroyed:

```javascript
import { MnObject, Radio } from 'marionette';

const owner = new MnObject();
const channel = Radio.channel('feature');

owner.stopListening(channel);
channel.off(null, null, owner);
channel.stopReplying(null, null, owner);
```

The matching cleanup depends on whether the owner used `listenTo`, `on`, or
`reply` to register the handler.

Call `channel.reset()` to remove all event listeners, listening relationships,
and reply handlers from that channel. `Radio.reset(name)` resets one existing
channel, while `Radio.reset()` resets all existing channels.

Resetting a channel clears its handlers but does not replace the shared channel
instance. Prefer targeted cleanup for long-lived application channels so one
feature does not remove another feature's handlers.

| Operation | Unknown channel | Existing channel |
| --- | --- | --- |
| `Radio.channel(name)` | Creates and registers the channel. | Returns the same channel. |
| Top-level event, request, and tuning methods | Create the channel through `Radio.channel(name)`. | Operate on the same channel. |
| `Radio.reset(name)` | Throws `MarionetteError` with code [MN0021](/errors/MN0021/) without creating a channel. | Clears handlers and preserves the channel identity. |
| `Radio.reset()` | Does not create channels. | Resets every registered channel without replacing it. |

Only a zero-argument `Radio.reset()` call means reset all. Supplying an empty or
otherwise falsy channel name throws the existing required-name diagnostic
[MN0017](/errors/MN0017/) without resetting any channel.

## Marionette Integration

`Application` and `MnObject` can bind events and requests to a channel with
`channelName`, `radioEvents`, and `radioRequests`. `getChannel()` returns the
configured channel.

`radioEvents` follows the [entity-event map contract](./common.md#bindevents),
including the `MN0026` rejection of an own enumerable `__proto__` map entry.
The direct Radio Events API continues to support `__proto__` as an event name.

<!-- executable-example: radio-owner-lifecycle -->
```javascript
import { MnObject, Radio } from 'marionette';

export const Notifications = MnObject.extend({
  channelName: 'notifications',

  initialize() {
    this.messages = [];
  },

  radioEvents: {
    'message:received': 'showMessage'
  },

  radioRequests: {
    'message:count': 'getMessageCount'
  },

  showMessage(message) {
    this.messages.push(message);
  },

  getMessageCount() {
    return this.messages.length;
  }
});

export const notifications = new Notifications();
export const channel = Radio.channel('notifications');
const message = { text: 'Hello' };

channel.trigger('message:received', message);
const count = channel.request('message:count');
```

Destroying the Marionette object removes request handlers bound with that
object as their context. The object's event listeners are cleaned up through
the normal Marionette event lifecycle.

## Backbone.Radio comparison

The v5 Radio implementation retains Backbone.Radio's channel messaging model,
but it is not a drop-in replacement for every exported property.
`@marionette/radio` can be used independently; core re-exports the same default
`Radio` within each module format.

| Area | v5 behavior |
| --- | --- |
| Requests and replies | Named/default handlers, callback context, map and space-separated forms, one-time replies, and selective removal retain the messaging contract. |
| Events and cleanup | Channels use shared Marionette Events. Reset clears handlers and owned listeners while retaining channel identity. Events also provides `triggerMethod`. |
| Debugging | Use `setDebug()` instead of assigning `DEBUG`. `log` and `debugLog` are replaceable per-instance hooks, and the debug toggle gates custom warning hooks too. Removing an absent reply does not warn. |
| Construction and globals | Use `channel(name)` for registered channels, `new Channel(name)` for standalone channels, or the named `Requests` mixin for request/reply alone. `VERSION`, Backbone global installation, and `noConflict()` are not Radio exports. |
| Names and maps | Request maps use own enumerable string keys. Inherited entries are ignored; names such as `__proto__` are supported without changing object prototypes. |
| Reset arguments | Only `reset()` resets all channels. An explicitly supplied empty name is an error; an unknown named channel gets a Marionette diagnostic. |

`test/unit/radio-parity.spec.js` runs shared behavioral scenarios against the
published Backbone.Radio 2.0.0 runtime and Marionette: fallback arguments, flat
values, nested request maps, reentrant and throwing one-time handlers, callback
and context removal, top-level forwarding, and channel/listener cleanup.

The extraction was also checked against the upstream request, channel, forwarding,
tuning, and debug tests at
[Backbone.Radio commit 7a58ade](https://github.com/marionettejs/backbone.radio/tree/7a58ade84bedb5551c2e12bdd3434d0fd6b1bdbd/test/unit).
That comparison adapts private registry names and the old debug toggle; tests
requiring removed public APIs are differences, not claims of full compatibility.

One intentional correction relative to the published 2.0.0 bundle is cancellation
of `replyOnce` by its original callback: `stopReplying(name, callback)` removes
the pending reply in v5. The published bundle and inspected upstream source
leave it registered. This follows the callback-identity behavior of
Backbone.Events `once`/`off`. The comparison test records the difference
explicitly instead of claiming exact parity.
