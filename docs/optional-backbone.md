# Optional Backbone

Marionette v5 core does not import Backbone. Plain objects and arrays use the
default [Data API](./data.api.md), while applications that use Backbone select
the bundled integration explicitly:

```javascript
import 'marionette/backbone';
import Backbone from 'backbone';
import { CollectionView, View } from 'marionette';
```

Import `marionette/backbone` once at application boot, before constructing
models, collections, Views, or registering subscriptions.

## What the integration does

The integration performs two related operations:

1. It configures Marionette's DataApi to translate Backbone data and structural
   collection events.
2. It installs Marionette's Events implementation on `Backbone.Model`,
   `Backbone.Collection`, `Backbone.View`, and `Backbone.Router` so listener-side
   bookkeeping is consistent across both libraries.

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

## Module identity and load order

The `marionette/backbone` default export and CommonJS value are the exact
`backbone` module object. The integration preserves the identity of Backbone's
constructors and prototypes:

```javascript
import IntegratedBackbone from 'marionette/backbone';
import Backbone from 'backbone';

IntegratedBackbone === Backbone; // true
```

Backbone may resolve before the integration module, but the canonical order is
to import `marionette/backbone` first. Event handlers registered before the
integration loads remain in Backbone's previous private event store and are not
migrated. Recreate those subscriptions after loading the integration.

The integration does not patch the `Backbone` namespace or `Backbone.History`.
It also cannot coordinate multiple physical Backbone installations; consumers
must share the package's supported Backbone peer instance.

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
