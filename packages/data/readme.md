# @marionette/data

Dependency-light observable `Model` and ordered `Collection` sources for
Marionette v5. The package depends only on `@marionette/utils`; models and
collections can run without core or a DOM. Install `@marionette/data` on its own
for standalone use. To use it with Marionette views, install both packages and
configure the runtime before creating owners:

```sh
npm install marionette @marionette/data
```

```js
import { CollectionView, View } from 'marionette';
import { Collection, DataApi } from '@marionette/data';

const Row = View.extend({
  tagName: 'li',
  template: () => '<span></span>',
  modelEvents: { change: 'render' },
  onRender() {
    this.el.querySelector('span').textContent = this.model.get('label');
  }
});
const List = CollectionView.extend({ tagName: 'ul', childView: Row });
Row.setDataApi(DataApi);
List.setDataApi(DataApi);

const collection = new Collection([{ id: 1, label: 'one' }]);
const view = new List({ collection }).render();
```

This setup selects data for the list and its child Views. State remains an
independent choice. If a View also uses a `Model` as observable state, configure
StateApi on that class before construction:

```js
import { StateApi } from '@marionette/data';

Row.setStateApi(StateApi);
```

Supply an existing `Model` through `state`, or return an owned one from
`createState()`. Declare `stateEvents` only for the changes the owner needs to
observe; the model's event names and payloads remain its own contract.

Use top-level setters when all affected classes intentionally share the same
provider. Configure an existing isolated runtime through its corresponding
setters when needed; using this package does not require creating a new runtime.

`Collection` reports synchronous `kind: 'update'`, `kind: 'reorder'`, and
`kind: 'reset'` records through `DataApi.observeCollection()`. `Model` and
`Collection` expose `on()`, `once()`, `off()`, `trigger()`, and
`triggerMethod()` for Marionette entity event maps.
`DataApi.models(collection)` returns the current ordered model snapshot.

`Model` provides `get`, `has`, `set`, `unset`, `clear`, `reset`, `toObject`, and
`destroy`. `Collection` provides ordered `at`, `get`, `indexOf`, iteration,
`forEach`, `map`, `add`, `remove`, `reset`, `move`, `sort`, `toArray`, and `destroy` operations. Pass `{ silent: true }` to a
structural mutation to suppress its normalized record and entity events.
`destroy()` is the exception and always emits its destruction event.

Define subclass `defaults` on the prototype, for example with `Model.extend`, a
prototype method, or a prototype getter. Native class fields initialize after
`super()` returns, so a `defaults = { ... }` field cannot seed construction.

`move(modelOrId, index)` changes list order without removing and re-adding a
model. This supports drag ordering while retaining child Views and their local
state. Both `move` and `sort` emit `sort`, translated to a DataApi reorder record.
Update model attributes with `model.set()` and subscribe through `modelEvents`
when a child should render after a change.

The native DataApi uses each model's stable `cid` as its key. Application ids may
change; Collection lookup reads the current ids. Duplicate instances or ids are
rejected before a reset changes membership; `add` ignores an instance or id
already present. Applications should keep ids unique when changing them.
`get`, `remove`, and `move` resolve an exact member instance first, then an
application id, then a cid. This precedence does not change when models move.
Bulk removal resolves its inputs against one current membership snapshot, including
silent id changes. It skips missing identities and repeated matches, returns
removed Models in input order, and keeps surviving Models in collection order.
If id writes temporarily create duplicates, id lookup selects the first current
member; applications should restore unique ids.

Supplied native Model instances retain their identity, attributes, and subclass,
including when the Collection has a different `model` constructor. That constructor
is used only for raw attribute objects. Initial model instances do not configure
the constructor used for future raw additions.

A model may belong to multiple Collections. Its `destroy` event removes it from
each containing Collection, forwarding removal options such as `silent`.
The destroy event itself still fires. Destroying a Collection releases subscriptions; it
does not destroy its models.

`model.toObject()` returns a shallow attribute copy. `collection.toArray()` returns
an array of those plain objects; use `collection.models.slice()` or iteration for
model instances. Template serialization reads `model.attributes` independently of
these conversion methods. There is no automatic `toJSON` hook: to serialize the
plain data, use `JSON.stringify(model.toObject())` or
`JSON.stringify(collection.toArray())`.

Collection observation uses ordinary synchronous `update`, `reset`, and `sort`
events. Notifications are not combined or replayed. Complete one structural
mutation before starting another: schedule mutations from collection listeners
or child lifecycle handlers after the current notification returns. Errors in
listeners propagate and abort delivery, as with ordinary model events.

The package does not provide persistence, REST synchronization, validation, or
implicit Backbone compatibility.

## Mutation semantics

`set` compares values with `Object.is`: a fresh object is a change even when its
contents match, while mutating a nested object in place is not observed. `has`
tests own-property presence, including a present `undefined` or `null` value.
Supplied attributes override defaults, including when their value is `undefined`.
Model `reset` reapplies defaults and removes attributes absent from the result.

Change callbacks receive `options.changed` and `options.previous`, sparse maps for
that mutation. For an attribute reported in `changed`, an absent own key in
`previous` means it did not exist before the mutation; an own key with value
`undefined` means it existed with that value. `previous` is
not a complete model snapshot. Removing an attribute reports `undefined` in
`changed`; use `has` to check its current presence.

Nested Model writes complete synchronously as independent changes. Use the event's
`options.changed` to inspect that event: `model.changed` reflects the latest write,
which may be a nested mutation by the time an outer change callback runs. Silent
writes still update attributes and `changed`; no-op writes clear `changed`.

Collection `add` and `remove` events originate on the Collection. Model events are
forwarded by containing Collections. Sorting is explicit: a prototype comparator
is used by `sort()`, but `add` and `reset` do not automatically sort. There is no
`Collection.set()` merge/reconcile operation; update retained Models explicitly
when refreshing a list whose child Views must retain local state. `reset` is the
deliberately destructive whole-list operation for CollectionView child Views;
the Collection retains supplied Model instances rather than destroying them.

## TypeScript

The package includes ESM and CommonJS declarations and a TypeScript 4.6-compatible
entry. `Model.extend` and `Collection.extend` retain added methods, descendants,
static replacements, and their normal attribute/model constructor inference.
Event registration accepts typed callbacks and maps; event names do not validate
payload types. A borrowed `triggerMethod` requires a receiver with a callable
`trigger` method.

A custom constructor must initialize the receiver itself. An explicit object
return describes a replacement instance; an unknown result stays unknown. To
return the initialized receiver while preserving methods added by descendants,
state that contract explicitly:

```ts
import { Model } from '@marionette/data';

const Named = Model.extend({
  constructor: function<Receiver extends Model>(
    this: Receiver, attributes: { label: string }
  ): Receiver {
    Model.call(this, attributes);
    return this;
  },
  label() { return String(this.get('label')); }
});
```

The same form works with `Collection`. A constructor declared to return `void`
or a primitive declares ordinary construction; the caller is responsible for
honoring that declaration. TypeScript's `void` return erasure can hide an object
return, so the declarations cannot prove that contract from arbitrary constructor
implementations. An inferred fixed receiver return does not promise methods
added by later descendants.

Direct native subclasses remain supported. Calling their inherited `.extend()`
without an explicit constructor is rejected because that path calls the parent
with `apply`, which cannot invoke a native class. An explicit constructor skips
that forwarding path and owns its initialization or replacement result.

TypeScript 4.6 narrows `instanceof` checks for the root constructors and ordinary
method-only extensions. Its callable-intersection limitation prevents that
narrowing on extensions with custom statics; directly constructed instances and
those static members remain typed.

Collection member types include both supplied Models and the constructor used for
raw attributes. Constructor `options.model` replaces a prototype `model` factory;
without either, raw attributes construct a base Model. Narrow an item with
`instanceof ModelClass` before using subclass-specific methods. The instance
`model` constructor has the same conservative member result type.

Model attributes and `toObject()` are partial: construction, `unset`, and `clear`
can leave any attribute absent. Known string keys in `set(key, value)` use the same
attribute value types as object-form writes; arbitrary dynamic keys remain open.
An explicitly typed Collection also checks raw attribute inputs against its model
attribute shape. These are compile-time contracts, not runtime validation.
