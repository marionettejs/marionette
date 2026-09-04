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

const ChildView = View.extend({
  tagName: 'li',
  template: model => model.name
});

const ListView = CollectionView.extend({ childView: ChildView });
const models = [{ name: 'one' }, { name: 'two' }];
const list = new ListView({ collection: models });

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
| `models(collection)` | Return the collection's current ordered model snapshot. |
| `subscribe(entity, eventName, callback, context)` | Subscribe to an application entity event and return an idempotent cleanup function. |
| `observeCollection(collection, callback, context)` | Observe structural collection changes and return an idempotent cleanup function. |

`key()` must remain stable while a model belongs to a CollectionView and must be
unique among the models currently owned by that CollectionView. The default
adapter uses object identity. Adapters for immutable sources may use a stable
source identity instead.

`models()` must return an ordered model snapshot after the source mutation is complete.
Marionette does not mutate that array.

`subscribe()` preserves the source event's arguments. Marionette invokes every
returned cleanup function during explicit undelegation or owner destruction. If
one subscription fails while a declarative event map is being installed,
Marionette releases the subscriptions already installed for that map. A
non-function cleanup value throws `MN0038`; core wraps valid cleanup functions so
cleanup is idempotent.

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
    { previous: previousModel, current: currentModel }
  ]
}
```

`reorder` means model order changed without membership changing. `reset` means
Marionette must rebuild every child. `update` supplies exact added and removed
model instances. Each `updated` entry contains the previous and current model for
one stable key. For an in-place update, `previous === current`. For an immutable
same-key replacement, they are different objects. This distinction lets core
distinguish a safe in-place render from an identity replacement. Marionette
destroys and recreates the child View for an immutable same-key replacement so
constructor options, `initialize`, Behaviors, entity events, and other
model-dependent state all belong to the current object. Marionette constructs
every same-key replacement View before removing any existing child. A
replacement-construction failure destroys the staged Views and leaves the
current children and DOM intact. If later reconciliation throws, newly created
Views are removed and destroyed, and the next structural notification rebuilds
from the latest source snapshot before incremental reconciliation resumes.

An immutable same-key replacement belongs only in `updated`, not in `removed`
and `added`. Replacing a model with one that has a different stable key is a
removal plus an addition; changing the key of a retained model is invalid. The
post-mutation `models()` snapshot is authoritative and must agree with the
record. Missing, duplicate, or unstable keys and malformed records throw
`MN0039`.

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

## Keyed snapshot store adapters

`@marionette/adapters` provides explicit DataApi factories for Redux Toolkit,
Zustand vanilla stores, and XState Store:

| Source | Import |
| --- | --- |
| Redux Toolkit | `@marionette/adapters/redux` |
| Zustand vanilla store | `@marionette/adapters/zustand` |
| XState Store | `@marionette/adapters/xstate-store` |

Each factory requires a stable model key and a selector that returns the
current ordered model array. Configure the resulting DataApi on the
CollectionView class before creating instances:

```javascript
import createReduxDataApi from '@marionette/adapters/redux';
import { CollectionView, View } from 'marionette';

const ReduxDataApi = createReduxDataApi({
  key: todo => todo.id,
  select: state => state.todos
});

const TodoView = View.extend({
  tagName: 'li',
  template: todo => todo.title
});
const TodoList = CollectionView.extend({ childView: TodoView });
TodoList.setDataApi(ReduxDataApi);

const list = new TodoList({ collection: store });
```

Use `createZustandDataApi` or `createXStateStoreDataApi` from the corresponding
subpath with the same options. A selector should return the same array reference
when an unrelated store notification occurs and retain the same object reference
for each unchanged model. Return a new ordered array after a structural change.

The adapters subscribe once per observing CollectionView and compare one keyed
snapshot per relevant notification. They normalize function and
`{ unsubscribe() }` disposers and never stop or mutate the caller-owned store.
A new model object with an existing key is an immutable replacement, so
Marionette destroys the old child View and constructs a new child for the new
object. These adapters intentionally do not expose a generic snapshot-store
entry point.

## Optional `@marionette/data` sources

Install `@marionette/data` with `marionette` when an application wants a small
first-party observable Model and ordered Collection without Backbone:

```sh
npm install marionette @marionette/data
```

```javascript
import { createMarionette } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@marionette/data';

const Marionette = createMarionette();
Marionette.setDataApi(DataApi);
Marionette.setStateApi(StateApi);

const state = new Model({ selectedId: null });
const collection = new Collection([{ id: 1, label: 'one' }]);
const list = new Marionette.CollectionView({ collection, state });
```

Unless `{ silent: true }` is passed, the package Collection reports synchronous
normalized `update`, `reorder`, and `reset` records after each structural
mutation. `Model.destroy()` and `Collection.destroy()` always emit their
`destroy` lifecycle events, including with `{ silent: true }`. Model ids cannot
change while the Model belongs to a Collection, and
reset or replacement rejects duplicate instances and ids before changing
membership. Define Model subclass `defaults` on the prototype with
`Model.extend`, a prototype method, or a prototype getter; a native class field
initializes too late to seed the base constructor. The package does not provide
persistence, REST synchronization, validation, or implicit Backbone behavior.

Applications using Backbone should import the bundled integration instead of
configuring these methods individually. See [Optional Backbone](./optional-backbone.md).
