# @mnjs/radio

Named channels for events and request/reply, usable without Marionette core or a DOM.

```sh
npm install @mnjs/radio@5.0.0-rc.2
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

## Version-matched reference

The matching `marionette` candidate includes the canonical reference. If core
is installed, open `node_modules/marionette/docs/packages/radio.md` for channel
scope, all event and request/reply methods, cleanup, standalone composition,
logging, and TypeScript contracts. Core remains unnecessary for standalone Radio
use.

Application and MnObject owner bindings are documented separately in
`node_modules/marionette/docs/api/shared/common.md#declarative-radio-bindings`.
General project information is available on the
[Marionette website](https://marionettejs.com/).
