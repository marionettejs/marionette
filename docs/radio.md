# Radio

Marionette v5 includes `Radio`, a global, namespaced message bus for
communication between otherwise unrelated parts of an application. Import it
directly from Marionette:

```javascript
import { Radio } from 'marionette';
```

`Backbone.Radio` is no longer a required external dependency. Do not install
`backbone.radio` for Marionette's Radio API.

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
instance. A channel name is required.

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

account.reply('current:user', function() {
  return this.currentUser;
}, accountService);

const currentUser = account.request('current:user');
```

Arguments passed after the request name are passed to the reply handler, and
the handler's return value is returned from `request`.

Use `replyOnce` for a handler that should be removed after its first request.
Use `stopReplying` to remove one or more handlers:

```javascript
account.replyOnce('access:token', createAccessToken);
account.stopReplying('current:user');
```

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

## Channel Lifecycle

Channels are shared by name and remain available for the lifetime of the Radio
module. Clean up handlers when their owning object or feature is destroyed:

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

## Marionette Integration

`Application` and `MnObject` can bind events and requests to a channel with
`channelName`, `radioEvents`, and `radioRequests`. `getChannel()` returns the
configured channel.

```javascript
import { MnObject, Radio } from 'marionette';

const Notifications = MnObject.extend({
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
    // ...
  },

  getMessageCount() {
    return this.messages.length;
  }
});

const notifications = new Notifications();
const channel = Radio.channel('notifications');
const message = { text: 'Hello' };

channel.trigger('message:received', message);
const count = channel.request('message:count');
```

Destroying the Marionette object removes request handlers bound with that
object as their context. The object's event listeners are cleaned up through
the normal Marionette event lifecycle.
