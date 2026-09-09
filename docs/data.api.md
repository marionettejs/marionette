# Data API

Display plain objects and arrays directly, or connect your data library through
`DataApi`. The adapter tells Marionette how to read models, obtain collection
order, and observe changes. Core does not require Backbone-shaped `cid`,
`attributes`, `get`, `models`, or collection event payloads.

The default adapter treats models as plain objects and collections as ordered
arrays. Plain arrays are static snapshots: mutating one does not notify
Marionette. Call `render()` after changing a plain array. Declaring
`modelEvents` or `collectionEvents` for an unobservable plain value throws
`MN0037` instead of manufacturing an event system. Both Backbone models and
collections (through `BackboneApi`) and `@mnjs/data` models and collections
are observable alternatives; preserve an existing provider that meets the task.

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

`subscribe()` registers handlers for future events and preserves the source event's
arguments. It must return an idempotent cleanup function. Marionette invokes
that function during explicit undelegation or owner destruction. Subscription
setup errors propagate to the caller; event-map registration is not rolled back.

`observeCollection()` also returns an idempotent cleanup function. Adapters are
responsible for fulfilling these contracts; core does not wrap or validate each
returned cleanup.

`model` and `collection` are opaque adapter references. Only `null` and
`undefined` mean no source; values such as `0`, `false`, and `''` can identify a
source when the configured adapter supports them. Prefer a stable reference
whose `get` and `serialize` methods read current values. Item changes can then
notify existing Views through `subscribe` without replacing their identity.

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
replacement-construction or rendering failure propagates to the caller. Core
does not undo a partial update or promise recovery on the next notification. See
[synchronous failures](https://github.com/marionettejs/marionette/blob/master/docs/view.lifecycle.md#synchronous-failures).

An in-place `updated` entry requests a child render. Adapters for mutable models
with their own change events can leave `updated` empty and let child
`modelEvents` handle rendering. The Backbone adapter follows this approach:
merges still update collection order and filtering, without rendering children
again after their model events have run.

If a child was removed, detached, or destroyed while its model remained in the
source, updates for that model do not recreate its View. Other children continue
to update. Rendering the CollectionView again or a source reset recreates children
from the current source.

An immutable same-key replacement belongs only in `updated`, not in `removed`
and `added`. Replacing a model with one that has a different stable key is a
removal plus an addition; changing the key of a retained model is invalid. The
post-mutation `models()` snapshot is authoritative and must agree with the
record. Missing, duplicate, or unstable snapshot keys throw `MN0039`. Adapters
must supply correct change records; core uses those records directly instead of
recalculating the change to validate them. Added children follow the current
snapshot order; removed children follow the previous snapshot order, regardless
of their order in the change record.

Observers may notify synchronously from CollectionView lifecycle hooks. Core
captures each source snapshot and drains nested notifications in order, so each
queued update uses the source state that accompanied it.

All three record types enter one CollectionView reconciliation path. Additions
create only their child Views; removals destroy only theirs; reorder moves
survivor elements without rerendering them; and reset is the explicitly
destructive whole-list operation. Presentation comparators may sort the child
Views independently of the source's canonical order.

## Configuring an adapter

Configure the application before constructing Views. In this configuration
fragment, `MyDataApi` is the adapter your application supplies:

```javascript
import { setDataApi } from 'marionette';

setDataApi(MyDataApi);
```

`setDataApi()` overlays the supplied own enumerable methods onto both `View`
and `CollectionView`. `View.setDataApi()` and `CollectionView.setDataApi()` can
configure a subclass independently. A CollectionView and its child View class
must use compatible adapters.

Behaviors use their owning View's adapter. Views and Behaviors work with the
original model or collection, and event callbacks receive the source's native
arguments. DataApi does not wrap application sources. Templates receive the
data prepared by `serializeModel()` or `serializeCollection()`; see
[Rendering](https://github.com/marionettejs/marionette/blob/master/docs/view.rendering.md).

DataApi and [StateApi](./marionette.state.md#stateapi) are selected
independently. One adapter object may implement both contracts, but configuring
one role never selects the other.

## XState actors

`@mnjs/adapters/xstate` supports a parent XState v5 actor whose selected
ordered collection contains stable child actor references. The adapter uses
the actor reference itself as `DataApi.key()`, reads and serializes the child
actor's current `snapshot.context`, and observes the parent through its snapshot
subscription. A stopped and respawned actor is therefore a new model identity,
even if it uses the same actor `id`.

The following configuration fragment assumes `parentActor` is an already-created
actor whose `context.children` contains stable child actor references. The
application owns actor creation, startup, and eventual shutdown.

```javascript
import createXStateActorApi from '@mnjs/adapters/xstate';
import { CollectionView, View } from 'marionette';

const XStateActorApi = createXStateActorApi({
  select: snapshot => snapshot.context.children,
  snapshotEvent: 'actor:snapshot'
});

const ChildView = View.extend({
  template: context => context.label,
  modelEvents: {
    'actor:snapshot': 'render',
    announced: 'onAnnounced'
  },
  onAnnounced(event) {
    console.log(event.label);
  }
});
const ListView = CollectionView.extend({ childView: ChildView });
ChildView.setDataApi(XStateActorApi);
ListView.setDataApi(XStateActorApi);

const view = new ListView({ collection: parentActor }).render();
```

`snapshotEvent` is optional and has no implicit default. When configured, that
exact event-map name observes `actor.subscribe()` snapshots. Every other name
is passed unchanged to `actor.on()` and observes an explicitly emitted event;
events sent to the actor are not surfaced automatically. The selected snapshot
array should retain its reference for unrelated parent transitions. A newly
subscribed observer does not receive an already-started actor's current
snapshot, so initial template data comes from `getSnapshot()`.

`select` is required when the result configures a CollectionView. Omit it when
only actor model reads, `modelEvents`, or `stateEvents` are needed; that result
does not define the collection-only `models()` and `observeCollection()` methods.

Set the same adapter on `StateApi` when `stateEvents` should use this event
vocabulary. Supplied actors are borrowed and never stopped by Marionette. An
actor returned from `createState()` is owned and is stopped only after its
Marionette-managed subscriptions are released. The adapter never traverses or
stops child actors.

## Optional `@mnjs/data` sources

Install `@mnjs/data` with `marionette` when an application wants a small
first-party observable Model and ordered Collection without Backbone:

```sh
npm install marionette@5.0.0-beta.2 @mnjs/data@5.0.0-beta.2
```

```javascript
import { CollectionView, setDataApi, setStateApi, View } from 'marionette';
import { Collection, DataApi, Model, StateApi } from '@mnjs/data';

setDataApi(DataApi);
setStateApi(StateApi);

const RowView = View.extend({
  tagName: 'li',
  template: () => '',
  modelEvents: { change: 'render' },
  onRender() {
    this.el.textContent = this.model.get('label');
  }
});
const state = new Model({ selectedId: null });
const collection = new Collection([{ id: 1, label: 'one' }]);
const list = new CollectionView({
  tagName: 'ul', childView: RowView, collection, state
}).render();

// Mount list.el in the application's chosen container.
collection.get(1).set('label', 'updated'); // The existing row now shows "updated".
```

Unless `{ silent: true }` is passed, the package Collection emits synchronous
`update`, `sort`, and `reset` events. The adapter translates them directly to
normalized records. There is no separate observer queue, coalescing, or replay.
Finish one structural mutation before starting another; schedule mutations from
collection listeners or child lifecycle handlers after the current notification
returns. Listener errors propagate and abort delivery.

`move(modelOrId, index)` supports explicit list ordering without remove/add
notifications or child View recreation. It and `sort` emit `sort`. Ordinary
attribute changes use `model.set()` and child `modelEvents` bindings.

The native adapter keys models by stable `cid`, so changing an application id
does not replace its child View. Collection lookup uses current ids. Reset
rejects duplicate instances and ids before changing membership; applications
should keep ids unique when changing them.

Lookup precedence is exact member instance, application id, then cid, regardless
of collection order. Supplied native Model instances retain their identity even
when the Collection configures a different model constructor; only raw attributes
use that constructor. Bulk removal resolves all identities against one current
snapshot, including ids changed with `{ silent: true }`.

`Model.destroy()` and `Collection.destroy()` always emit their `destroy`
lifecycle events, including with `{ silent: true }`. A destroyed model removes
itself from each containing Collection through ordinary event subscriptions.
Destroying a Collection releases its subscriptions without destroying its models.

Use `Model.toObject()` for a shallow attribute copy and `Collection.toArray()`
for an array of plain attribute objects. Template serialization reads attributes
independently. The native package does not implement `toJSON`; pass these plain
values to `JSON.stringify` explicitly.

Define Model subclass `defaults` on the prototype with `Model.extend`, a prototype
method, or a prototype getter; a native class field initializes too late to seed
the base constructor. The package does not provide persistence, REST
synchronization, validation, or implicit Backbone behavior.

Native Model writes use `Object.is` equality and report sparse `changed` and
`previous` maps on their event options. Nested writes are independent synchronous
changes; use `options.changed` for the event being handled, since `model.changed`
may already describe a nested write. `has` tests own-property presence, including
undefined values. Native collection sorting is explicit and `reset` rebuilds
children; there is no automatic merge/reconcile operation. See the package's
[mutation semantics](https://github.com/marionettejs/marionette/blob/master/packages/data/readme.md#mutation-semantics) for details.

Applications using Backbone should import the bundled integration instead of
configuring these methods individually. See [Optional Backbone](./optional-backbone.md).
