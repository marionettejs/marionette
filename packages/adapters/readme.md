# @marionette/adapters

First-party optional integrations for Marionette v5. The package intentionally
has no root export: import only the adapter and optional peer your application
uses.

## Backbone

```sh
npm install marionette @marionette/adapters backbone
```

```js
import BackboneApi from '@marionette/adapters/backbone';
import Backbone from 'backbone';
import { setDataApi, setStateApi } from 'marionette';

setDataApi(BackboneApi);
setStateApi(BackboneApi);
```

Configure the Backbone adapter before creating Marionette Views that consume
Backbone models or collections. Pass the same `BackboneApi` object to an
isolated runtime's `setDataApi()` and `setStateApi()` methods when that runtime
owns the integration. The adapter uses Backbone's native events and does not
modify Backbone objects or prototypes. Releasing an owned Backbone state source
removes only the adapter-managed owner subscriptions. The adapter leaves the
source and its caller-owned listeners intact; it does not call source-wide
`stopListening()`, `off()`, or persistence-capable `Model#destroy()` methods.

## jQuery DomApi

```sh
npm install marionette @marionette/adapters jquery
```

```js
import { View } from 'marionette';
import JQueryDomApi from '@marionette/adapters/dom/jquery';

const JQueryView = View.extend();
JQueryView.setDomApi(JQueryDomApi);
```

Importing either subpath does not load the other adapter or its optional peer.
