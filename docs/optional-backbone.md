# Optional Backbone

Use Backbone models and collections with Marionette by installing the separate
adapters package and selecting its Backbone integration. Marionette core does
not import Backbone. Backbone models and collections are observable sources;
“optional” means Marionette does not require that provider. Plain objects and
arrays use the default [Data API](./data.api.md) as static data.

```sh
npm install @mnjs/adapters@5.0.0-beta.2 backbone
```

```javascript
import BackboneApi from '@mnjs/adapters/backbone';
import { setDataApi } from 'marionette';

setDataApi(BackboneApi);
```

If a Marionette owner also uses a Backbone source for `state` or `createState()`,
select the StateApi role separately:

```javascript
import BackboneApi from '@mnjs/adapters/backbone';
import { setStateApi } from 'marionette';

setStateApi(BackboneApi);
```

Configure `BackboneApi` once at application boot before constructing Marionette
consumers or registering their subscriptions. Existing Backbone sources can be
passed in; the adapter does not alter their construction or native events. For an isolated runtime, call
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

As in Marionette v4, child `modelEvents` control rendering after model changes.
For example, `modelEvents: { change: 'render' }` renders a child when its model
changes. Collection merges still sort and filter children, but do not request
another render. Backbone also reports unchanged models as merged, so treating
every merge as a render request would redraw unchanged children.

Sort handling follows Marionette v4: the adapter skips `sort` events carrying
`add`, `remove`, or `merge` flags and handles those mutations through `update`.
Explicit `collection.sort()` calls still notify the View. The observer does not
retain or scan a separate membership snapshot to distinguish these events.

This retains a v4 limitation: without a comparator, `collection.set()` that only
reorders existing model instances emits a flagged `sort` but no `update`, so it
does not automatically reorder the displayed children. Call the CollectionView's
`render()` to refresh them after that operation.

The original Backbone model or collection remains the value stored on a View
and passed to callbacks. The integration does not wrap entities or allocate a
second model graph.

## Native event identity and load order

The integration uses Backbone's native `on()`, `off()`, `listenTo()`, and
`stopListening()` behavior. It does not modify the Backbone namespace,
constructors, prototypes, or event stores, and it does not add `triggerMethod`.
Listeners registered before adapter configuration continue to work afterward:

```javascript
import BackboneApi from '@mnjs/adapters/backbone';
import Backbone from 'backbone';
import { setDataApi } from 'marionette';

const model = new Backbone.Model();
const onChange = () => console.log('Model changed');
model.on('change', onChange);

setDataApi(BackboneApi);
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

For observable data, use [Choosing integrations](./choosing-integrations.md) to
select an existing integration first. If the application requires a custom
integration, implement the [DataApi contract](./data.api.md) rather than
manufacturing Backbone-shaped `cid`, `attributes`, `models`, or event payloads.
