# Optional Backbone

Use Backbone models and collections with Marionette by installing the separate
adapters package and selecting its Backbone integration. Marionette core does
not import Backbone; plain objects and arrays use the default
[Data API](./data.api.md).

```sh
npm install @marionette/adapters backbone
```

```javascript
import BackboneApi from '@marionette/adapters/backbone';
import Backbone from 'backbone';
import { CollectionView, setDataApi, setStateApi, View } from 'marionette';

setDataApi(BackboneApi);
setStateApi(BackboneApi);
```

Configure `BackboneApi` once at application boot, before constructing models,
collections, Views, or registering subscriptions. For an isolated runtime, call
that runtime's `setDataApi()` and `setStateApi()` methods instead of the root
setters.

## What the integration does

The integration supplies one combined adapter object for two related contracts:

1. As a DataApi adapter, it translates Backbone data and structural
   collection events.
2. As a StateApi adapter, it subscribes to Backbone state events while leaving
   owned Backbone state caller-controlled.

The data adapter maps:

| Marionette operation | Backbone source |
| --- | --- |
| model identity | `model.cid` |
| named value read | `model.get(attribute)` |
| value presence and serialization | `model.attributes` |
| ordered model snapshot | `collection.models` |
| application entity events | `entity.on(...)` and `entity.off(...)` |
| structural observations | `sort`, `reset`, and `update` collection events |

Backbone's `sort`, `reset`, and `update` payloads are translated to the neutral
records documented by [`DataApi.observeCollection()`](./data.api.md#collection-observations).
Those Backbone-specific shapes do not enter Marionette core.

The original Backbone model or collection remains the value stored on a View
and passed to callbacks. The integration does not wrap entities or allocate a
second model graph.

## Native event identity and load order

The integration uses Backbone's native `on()`, `off()`, `listenTo()`, and
`stopListening()` behavior. It does not modify the Backbone namespace,
constructors, prototypes, or event stores, and it does not add `triggerMethod`.
Listeners registered before adapter configuration continue to work afterward:

```javascript
import BackboneApi from '@marionette/adapters/backbone';
import Backbone from 'backbone';
import { setDataApi, setStateApi } from 'marionette';

const model = new Backbone.Model();
model.on('change', onChange);

setDataApi(BackboneApi);
setStateApi(BackboneApi);
model.set('ready', true); // onChange still runs
```

Destroying a Marionette owner unsubscribes its adapter-managed event handlers.
The adapter leaves an owned Backbone state source and its caller-owned listeners
intact because Backbone has no source-wide disposal operation that can preserve
them. It does not call `stopListening()`, `off()`, or persistence-capable
`Backbone.Model#destroy()` on that source.

## Applications without Backbone

Do not install or import Backbone solely for Marionette. Plain models and arrays
work with the default DataApi:

```javascript
const model = { name: 'one' };
const collection = [model, { name: 'two' }];
```

For observable stores, immutable snapshots, signals, or another data library,
provide a focused DataApi rather than manufacturing Backbone-shaped `cid`,
`attributes`, `models`, or event payloads. See [Data API](./data.api.md) for the
complete adapter contract.
