# @marionette/radio

Named channels for events and request/reply, usable without Marionette core or a DOM.

```sh
npm install @marionette/radio
```

```js
import { Radio, createRadio } from '@marionette/radio';

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

The package depends on `@marionette/utils`, which supplies Events and shared
helpers. It does not depend on core. ESM and CommonJS exports include `Radio`,
`createRadio`, and public channel and request types. ESM and CommonJS each have
their own default instance; do not mix the two formats to share a channel registry.

Radio, utils, data, adapters, and core are versioned and released together.
