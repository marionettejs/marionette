# @mnjs/radio

Named channels for events and request/reply, usable without Marionette core or a DOM.

```sh
npm install @mnjs/radio@5.0.0-beta.2
```

```js
import { Radio, createRadio } from '@mnjs/radio';

const channel = Radio.channel('app');
channel.reply('title', () => 'Hello');
channel.on('refresh', () => console.log('Refreshing'));
channel.request('title');
channel.trigger('refresh');

const isolatedRadio = createRadio();
```

`Radio` is the default instance also exported by `marionette`. Within the same
module format and package installation, either import reaches the same channels.
`createRadio()` creates an independent channel registry. Each `createMarionette()`
runtime also owns its own Radio instance; use that runtime's `Radio` when binding
its objects and applications.

The package depends on `@mnjs/utils`, which supplies Events and shared
helpers. It does not depend on core. ESM and CommonJS exports include `Radio`,
`createRadio`, `Channel`, `Requests`, and their public types. ESM and CommonJS each have
their own default instance; do not mix the two formats to share a channel registry.

Radio, utils, data, adapters, and core are versioned and released together.

## Standalone messaging

```js
import { Channel, Requests } from '@mnjs/radio';

const local = new Channel('editor');
local.on('save', () => console.log('Saved'));
local.reply('title', 'Untitled');

const service = Object.assign({}, Requests);
service.reply('ready', true);
```

`new Channel(name)` creates an independent Events-and-Requests object. It is not
registered with Radio; call its `reset()` to remove its handlers and owned
listeners. Two standalone channels with the same name are still separate objects.
`Radio.reset()` only covers channels obtained through `Radio.channel(name)`.

The named `Channel` export is `Radio.Channel`. Use `new isolatedRadio.Channel(name)`
when a standalone channel should share a particular Radio instance's logging
configuration. `Requests` adds only request/reply methods to its receiver; it uses
the default Radio's warning configuration.

## Logging

Assign `radio.log(channelName, eventName, ...args)` to receive activity from
`tuneIn()`, and `radio.debugLog(warning, eventName, channelName)` to receive
diagnostics. The defaults write to the console.

```js
const radio = createRadio();
radio.log = (channel, event, ...args) => console.log({ channel, event, args });
radio.debugLog = (warning, event, channel) => console.warn({ warning, event, channel });
radio.setDebug();
radio.tuneIn('app');
```

Each Radio instance owns its hooks. They run with that Radio as `this`, and
existing channels use the current hook, even when it is replaced after `tuneIn()`.
`setDebug(false)` suppresses warning delivery to custom hooks too. Standalone
channels use their constructor's Radio configuration; the shared default
Requests mixin uses the default Radio. Hook exceptions propagate to the caller.
