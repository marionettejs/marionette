# Data API

Marionette v5 reads models and collections through `DataApi`. Core does not
require Backbone-shaped `cid`, `attributes`, `get`, `models`, or collection
event payloads.

The default adapter treats models as plain objects and collections as ordered
arrays. It supports Marionette-compatible `on` and `off` methods for
`modelEvents` and `collectionEvents`, but it does not observe array mutations.
Call `render()` after changing a plain array.

```javascript
import { CollectionView, View } from 'marionette';

const ItemView = View.extend({
  tagName: 'li',
  template: item => item.name
});

const ListView = CollectionView.extend({ childView: ItemView });
const items = [{ name: 'one' }, { name: 'two' }];
const list = new ListView({ collection: items });

list.render();
```

## Adapter contract

An adapter supplies seven methods:

| Method | Purpose |
| --- | --- |
| `key(model)` | Return a stable `Map` key used to associate a model with its child View. |
| `get(model, attribute)` | Read one named value for string comparators and filters. |
| `has(model, attribute)` | Distinguish a missing value from a present value of `undefined`. |
| `serialize(model)` | Return the data passed to a template. |
| `items(collection)` | Return the collection's current ordered array snapshot. |
| `subscribe(entity, eventName, callback, context)` | Subscribe to an application entity event and return an idempotent disposer. |
| `observeCollection(collection, callback, context)` | Observe structural collection changes and return an idempotent disposer. |

`key()` must remain stable while an item belongs to a CollectionView and must be
unique among the items currently owned by that CollectionView. The default
adapter uses object identity. Adapters for immutable sources may use a stable
source identity instead.

`items()` must return an ordered array after the source mutation is complete.
Marionette does not mutate that array.

`subscribe()` preserves the source event's arguments. Marionette invokes every
returned disposer during explicit undelegation or owner destruction. If one
subscription fails while a declarative event map is being installed, Marionette
disposes the subscriptions already installed for that map.

## Collection observations

`observeCollection()` reports one of three normalized records:

```javascript
{ type: 'reorder' }
{ type: 'reset' }
{
  type: 'update',
  added: [],
  removed: [],
  updated: []
}
```

`reorder` means item order changed without membership changing. `reset` means
Marionette must rebuild every child. `update` supplies exact added and removed
item instances; `updated` contains existing items whose values may affect
sorting or filtering.

When an immutable source replaces an object, report the previous object in
`removed` and the replacement in `added`, even when both have the same logical
key. The child View must receive the replacement object rather than retain the
old reference.

## Configuring an adapter

Configure the application before constructing Views:

```javascript
import { setDataApi } from 'marionette';

setDataApi(MyDataApi);
```

`setDataApi()` overlays the supplied own enumerable methods onto both `View`
and `CollectionView`. `View.setDataApi()` and `CollectionView.setDataApi()` can
configure a subclass independently. A CollectionView and its child View class
must use compatible adapters.

Behaviors use their owning View's adapter. The original model or collection is
always passed to Views, Behaviors, callbacks, and templates; DataApi does not
wrap application data.

Applications using Backbone should import the bundled integration instead of
configuring these methods individually. See [Optional Backbone](./optional-backbone.md).
