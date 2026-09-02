# Data API

Marionette v5 reads models and collections through `DataApi`. Core does not
require Backbone-shaped `cid`, `attributes`, `get`, `models`, or collection
event payloads.

The default adapter treats models as plain objects and collections as ordered
arrays. Plain arrays are static snapshots: mutating one does not notify
Marionette. Call `render()` after changing a plain array. Declaring
`modelEvents` or `collectionEvents` for an unobservable plain value throws
`MN0037` instead of manufacturing an event system.

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
disposes the subscriptions already installed for that map. A non-function
disposer throws `MN0038`; core wraps valid disposers so cleanup is idempotent.

## Collection observations

`observeCollection()` reports one of three normalized records:

```javascript
{ kind: 'reorder' }
{ kind: 'reset' }
{
  kind: 'update',
  added: [],
  removed: [],
  updated: [
    { previous: previousItem, current: currentItem }
  ]
}
```

`reorder` means item order changed without membership changing. `reset` means
Marionette must rebuild every child. `update` supplies exact added and removed
item instances. Each `updated` entry contains the previous and current item for
one stable key. For an in-place update, `previous === current`. For an immutable
same-key replacement, they are different objects. This distinction lets core
distinguish a safe in-place render from an identity replacement. Marionette
destroys and recreates the child View for an immutable same-key replacement so
constructor options, `initialize`, Behaviors, entity events, and other
model-dependent state all belong to the current object.

An immutable same-key replacement belongs only in `updated`, not in `removed`
and `added`. Replacing an item with one that has a different stable key is a
removal plus an addition; changing the key of a retained item is invalid. The
post-mutation `items()` snapshot is authoritative and must agree with the record. Missing,
duplicate, or unstable keys and malformed records throw `MN0039`.

Observers may notify synchronously from CollectionView lifecycle hooks. Core
commits each validated snapshot before invoking those hooks and drains nested
notifications in order, so the next record is always checked against the source
state that preceded it.

All three record types enter one CollectionView reconciliation path. Additions
create only their child Views; removals destroy only theirs; reorder moves
survivor elements without rerendering them; and reset is the explicitly
destructive whole-list operation. Presentation comparators may sort the child
Views independently of the source's canonical order.

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

DataApi and [StateApi](./marionette.state.md#stateapi) are selected
independently. One adapter object may implement both contracts, but configuring
one role never selects the other.

Applications using Backbone should import the bundled integration instead of
configuring these methods individually. See [Optional Backbone](./optional-backbone.md).
