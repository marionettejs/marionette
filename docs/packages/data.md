# Model and Collection (`@mnjs/data`)

[API index](../api.md) · [Setup](../integrations/setup.md) · [Data and state providers](../api/providers/data.md)

`@mnjs/data` is an optional companion package supplying observable Models, ordered Collections, and Marionette providers. It works independently of Marionette core and the DOM. It is a workable but incomplete application data solution: fetching, persistence, validation, and server synchronization belong to an API layer or another data solution. It has no `fetch`, `save`, or HTTP deletion methods. Marionette can use a different source through a compatible provider.

## Model

`new Model(attributes?, options?)` makes an observable set of attributes. Construction combines prototype `defaults` with supplied attributes, assigns a unique client ID, and then calls `initialize(attributes, options)`. Supplied attributes win, including an explicit `undefined`. Initial attributes do not emit change events; mutations inside `initialize` do.

```js
import { Model } from '@mnjs/data';

const Preferences = Model.extend({
  defaults() { return { compact: false }; },
});

const preferences = new Preferences({ theme: 'light' });
const changes = [];
preferences.on('change:theme', (model, theme) => changes.push(theme));
preferences.set('theme', 'dark');
preferences.get('theme'); // 'dark'
preferences.reset({ theme: 'system' }); // Reapplies compact: false.
```

### Model configuration and properties

| Member | Contract |
| --- | --- |
| `defaults` | Prototype object or function returning initial attributes. A function runs with the Model as `this`, on construction and `reset`. Use it to create fresh nested values per instance. |
| `idAttribute` | Prototype attribute name used for `id`; defaults to `'id'`. Set it before construction. |
| `initialize(attributes, options)` | Optional setup hook after attributes and identity exist. Options are passed through; they are not merged or stored as `this.options`. |
| `attributes` | Current attribute object. Read through `get`/`has` and write through mutation methods so changes notify observers. |
| `changed` | Sparse map for the most recent mutation. An unchanged write clears it. Use an event's change payload when inspecting that particular mutation. |
| `id` | Value of the `idAttribute` attribute, updated by attribute mutations. Change it with `set`, rather than assigning `model.id`. |
| `cid` | Unique client ID, stable for this instance. Used by the native DataApi to identify CollectionView children independently of server IDs. Treat it as read-only. |

Define `defaults` through `Model.extend`, a prototype method, or a getter. A native class field initializes after `super()` and therefore cannot provide construction defaults.

### Read and mutate attributes

| Method | Result and behavior |
| --- | --- |
| `get(key)` | Attribute value, or `undefined` if absent. |
| `has(key)` | Own-property presence, including attributes containing `undefined`, `null`, or `false`. |
| `set(attributes, options?)` / `set(key, value, options?)` | Update supplied attributes; leave others unchanged. Return the Model. |
| `unset(key, options?)` | Remove that attribute. Return the Model. |
| `clear(options?)` | Remove all attributes, including defaults. Return the Model. |
| `reset(attributes?, options?)` | Replace attributes with defaults plus supplied attributes; remove keys absent from that result. Return the Model. |
| `toObject()` | New shallow attribute object. Nested values remain shared references. Use this result for JSON serialization; the Model has no automatic `toJSON` hook. |
| `isDestroyed()` / `destroy(options?)` | Inspect or end the local lifetime; see [destruction](#destruction-and-ownership). |

Values are compared with `Object.is`. A fresh object is a change even when its contents match. Mutating a nested object in place does not notify; set a replacement value to publish its change. Mutation options are event metadata, not validation or transport settings. There is no `silent` mode.

## Model events

All effective mutations finish updating attributes and `id` before publishing synchronously:

| Event | Callback arguments | Hook |
| --- | --- | --- |
| `change:<attribute>` | `(model, value, change)` | For example, `onChangeTheme(model, value, change)` |
| `change` | `(model, change)` after attribute events | `onChange(model, change)` |
| `destroy` | `(model, options)` once on destruction | `onDestroy(model, options)` |

The `change` argument contains the supplied metadata plus `changed` and `previous` sparse maps. `changed` contains affected attributes and their new values; removal is represented by `undefined`. `previous` contains only affected attributes that existed before the write. It is not a complete snapshot; use `has` to check current presence. A write with no effective changes emits nothing.

Nested writes complete as independent synchronous changes. An event's `change.changed` describes that event; `model.changed` may already reflect a subsequent nested write. Exceptions from listeners or hooks propagate to the caller and stop the remaining delivery.

Models and Collections share the [Events methods](../api/shared/events.md): `on`, `once`, `off`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, and `stopListening`. Event maps contain function callbacks; names are literal strings. `triggerMethod` invokes the named hook before event listeners.

## Collection

`new Collection(models?, options?)` creates ordered membership. Supply one Model/attribute object or an array; omitted or null input starts empty. Raw attribute objects use the configured `model` constructor. Supplied native Model instances retain their identity and subclass, even when that constructor differs.

```js
import { Collection, Model } from '@mnjs/data';

const first = new Model({ id: 'a', label: 'Alpha' });
const items = new Collection([first, { id: 'b', label: 'Beta' }]);
items.add({ id: 'c', label: 'Gamma' }, { at: 1 });
items.move('b', 0);
items.get('a').set('label', 'Updated Alpha'); // Retains the Model.
const labels = items.map(model => model.get('label'));
const plainItems = items.toArray(); // Attribute objects, not Models.
```

### Collection configuration and properties

| Member | Contract |
| --- | --- |
| `model` | Constructor for raw attributes; defaults to `Model`. Set on the prototype or pass `{ model: ModelClass }` as constructor options. The constructor option wins. Supplied Models do not change this factory for later additions. |
| `comparator` | Optional prototype attribute name or two-Model comparison function, used by `sort()` when no comparator is passed. Adding or resetting data does not automatically sort it. |
| `initialize(models, options)` | Optional hook after membership is seeded without mutation events. Options are passed through; the Collection does not create `this.options`. |
| `models` | Current ordered array of Models. Use membership methods to change it. For your own array of references use `[...collection]` or `collection.models.slice()`. |
| `length` | Current number of Models. |

### Read and iterate

| Method | Result |
| --- | --- |
| `at(index)` | Model at the index; negative indexes count from the end. Out of range returns `undefined`. |
| `get(identity)` | Contained Model resolved by exact member instance, then current non-null ID, then client ID. Missing/nullish identity returns `undefined`. |
| `indexOf(model)` | Position of that exact Model instance, or `-1`. |
| `forEach(callback, context?)` | Calls `(model, index, models)` in order; returns `undefined`. |
| `map(callback, context?)` | Calls the same signature and returns an array of results. |
| `[Symbol.iterator]()` | Iterates Model instances, supporting `for...of` and spread. |
| `toArray()` | New array of shallow attribute copies, equivalent to mapping `toObject()`. Use this for JSON serialization. |

### Membership and ordering

| Method | Result and notifications |
| --- | --- |
| `add(modelOrAttributes, options?)` / `add(array, options?)` | Add new membership, optionally at integer `options.at` (clamped to the list); otherwise append. Return the added Model or array of added Models. An ignored single addition returns `undefined`. Emit `add` per Model, then one `update`. |
| `remove(identity, options?)` / `remove(identities, options?)` | Resolve like `get`; remove matching members without destroying them. Return the removed Model or an array in input order. Missing/repeated matches are skipped; a missing single match returns `undefined`. Emit `remove` per Model, then one `update`. |
| `reset(models?, options?)` | Replace all membership; return the Collection and emit `reset`, even for unchanged input. Raw attributes create new Models. Supplied Models are retained as instances. No per-Model `add`/`remove` events. |
| `move(identity, index, options?)` | Move an existing Model; clamp an integer index to the list. Return the Model, or `undefined` if absent. Emit `sort` when its position changes. A noninteger index for an existing Model throws `TypeError`. |
| `sort(comparator?, options?)` | Sort by attribute name or `(left, right) => number`, with the Collection as callback `this`. Defaults to prototype `comparator`. Return the Collection and emit `sort`, even if order is unchanged. Without a valid comparator, do nothing. |
| `isDestroyed()` / `destroy(options?)` | Inspect or end the local lifetime; see [destruction](#destruction-and-ownership). |

`add` ignores existing instances or non-null IDs. Construction and `reset` reject duplicate instances or non-null IDs with `TypeError`, before replacing membership. Keep IDs unique when updating Models: a later ID change does not enforce uniqueness; lookup then selects the first current matching member. ID equality follows Map/Set equality. Nullish IDs do not identify members.

`reset` is a whole-list replacement. With CollectionView it destroys and rebuilds child Views, including children whose Model instances remain. For retained items, update the existing Model with `set`, change membership with `add`/`remove`, and change order with `move`/`sort`. There is no `Collection.set` merge operation. See [CollectionView](../api/collection-view.md) for display filtering, ordering, and child ownership.

## Collection events

| Event | Callback arguments | Hook |
| --- | --- | --- |
| `add` | `(model, collection, options)` | `onAdd(model, collection, options)` |
| `remove` | `(model, collection, options)` | `onRemove(model, collection, options)` |
| `update` | `(collection, change)` | `onUpdate(collection, change)` |
| `reset` | `(collection, options)` | `onReset(collection, options)` |
| `sort` | `(collection, options)` | `onSort(collection, options)` |
| `destroy` | `(collection, options)` for its own destruction | `onDestroy(collection, options)` |

`update` supplies metadata plus `changes: { kind: 'update', added, removed, updated }`. Native membership operations populate `added` or `removed`; `updated` is empty. Membership reflects the entire mutation before listeners run. No-op additions/removals and unchanged moves emit nothing. Options are metadata except for `add`'s `at`; they do not suppress notifications.

Collections also forward contained Models' events with their original arguments. On a Model's `destroy`, each containing Collection emits its `remove` and `update` events as it removes that Model, then forwards `destroy(model, options)` to its own listeners. Thus a Collection's `destroy` event may refer to a member or the Collection itself; inspect the first argument when that distinction matters. `add`/`remove` originate on the Collection, not the Model.

A Model attribute change does not emit a structural update, resort, or refilter a list. A row can observe it through [modelEvents](../api/view.md); parent filtering and sorting are separate operations. Complete one structural mutation before starting another from its listeners or child lifecycle hooks. Notifications are synchronous, not queued or replayed by the data package.

## Destruction and ownership

`destroy(options?)` returns the source and is idempotent. It marks the source destroyed, emits `destroy`, releases outgoing `listenTo` subscriptions and incoming event callbacks, and makes subsequent data mutations no-ops rather than throwing. It performs no server request. The retained attribute/membership snapshots remain readable.

Destroying a Model removes it from every containing Collection. Destroying a Collection releases its member subscriptions but does not destroy the Models. A Model may belong to multiple Collections. Removing or replacing membership does not transfer ownership or destroy the previous members.

Marionette Views borrow their `model` and `collection`: destroying a View releases observation without destroying its data. State returned by `createState` is owned and disposed through StateApi; supplied state is borrowed. See [state ownership](../api/shared/state.md). Local data without external subscriptions or resources needs no explicit destruction once it becomes unreachable.

## Providers

Import `DataApi` and `StateApi` from `@mnjs/data` and configure Marionette before constructing consumers, as shown in [setup](../integrations/setup.md#configure-once). These optional providers implement the core [DataApi and StateApi contracts](../api/providers/data.md); they are distinct from core's plain-data defaults.

| Provider method | Package behavior |
| --- | --- |
| `DataApi.key(model)` | Returns the Model's client ID (`cid`), preserving child identity when its server ID changes. |
| `DataApi.get(model, attribute)` / `has(model, attribute)` | Use native Model methods; otherwise read/test own properties. Nullish sources return `undefined` / `false`. |
| `DataApi.serialize(model)` | Returns a native Model's live attributes; otherwise returns the source unchanged. |
| `DataApi.models(collection)` | Requires a native Collection and returns a shallow copy of its ordered Models. Arrays and other collection implementations throw `TypeError`. |
| `DataApi.observeCollection(collection, callback, context?)` | Collection `update` events deliver their normalized `changes` payload; `reset` and `sort` become reset/reorder notifications. Calls the callback with the supplied context and returns cleanup. |
| `DataApi.subscribe(...)` / `StateApi.subscribe(...)` | Observe compatible `on`/`off` sources, preserving event arguments and context. Missing event methods throw `TypeError`. |
| `StateApi.disposeOwned(source)` | Calls the source's `destroy()` when present. Native destruction is local cleanup: no server request, and destroying a Collection does not destroy its Models. |

Both providers accept `subscribe(source, name, callback, context?)` and `subscribe(source, eventMap, context?)`. Map values are function callbacks. Both forms return an idempotent cleanup function that removes only those registrations.

Model change events remain separate from structural collection notifications. Use a row's `modelEvents` for attribute changes; changing attributes does not automatically sort or refilter a list. See [Collection events](#collection-events).

Configure DataApi and StateApi separately for the sources each owner uses. Installing these providers does not add persistence or change ownership: Views borrow Models and Collections; only state returned by `createState` is owned. A different data solution can supply its own implementation of the same core contracts.

## TypeScript

```ts
import { Collection, Model } from '@mnjs/data';
import type { CollectionChange, MutationOptions } from '@mnjs/data';

type Preferences = { theme: string; compact: boolean };
const preferences = new Model<Preferences>({ theme: 'light' });
preferences.set('compact', true);
const theme: string | undefined = preferences.get('theme');
const copies: Partial<Preferences> = preferences.toObject();
const selections = new Collection<Model<Preferences>>([preferences]);
const metadata: MutationOptions = { source: 'settings' };
selections.add({ theme: 'dark' }, metadata);
const change: CollectionChange<Model<Preferences>> = { kind: 'reorder' };
```

Attributes and `toObject()` are partial because construction and mutation can leave keys absent. Known `set` keys check value types; dynamic string keys remain open. `toArray()` currently returns `ModelAttributes[]` rather than preserving the attribute generic. Types do not validate server responses.

| Exported type | Meaning |
| --- | --- |
| `Model<Attributes>` / `Collection<Member>` | Generic instance types sharing names with the constructors. Collection member types include supplied Models and the factory used for raw attributes. |
| `ModelAttributes` | `Record<string, unknown>`. |
| `MutationOptions` | Open metadata object. Event-specific `changed`, `previous`, and `changes` fields are runtime payloads; this type does not infer their contents. |
| `ModelInput<Member>` | A member Model or its attributes, used by Collection construction and mutation. |
| `CollectionOptions<Member>` | Optional `model` constructor. `comparator` belongs on the prototype or in `sort`, not constructor options. |
| `CollectionChange<Member>` | Discriminated union of `{ kind: 'reset' }`, `{ kind: 'reorder' }`, and `{ kind: 'update', added, removed, updated }`, where `updated` contains `{ previous, current }` member pairs. |
| `EventCallback` / `EventSource` | Re-exported callback and event-method types from `@mnjs/utils`. Event names do not statically validate payload types. |

`Model.extend` and `Collection.extend` use the shared [class extension mechanism](../api/shared/common.md#define-a-class), preserving added methods and static properties in their types. Prefer `initialize` for setup. An explicit constructor replaces parent initialization and owns its return contract. Unlike core owners, these classes do not supply `getOption`, binding helpers, or Radio configuration.

The package also re-exports the standalone `triggerMethod` helper. Call it with an event-capable receiver, for example `triggerMethod.call(model, 'selected', model)`. Its hook/event behavior is documented in [Events](../api/shared/events.md#trigger-events-and-hooks). ESM imports and CommonJS `require('@mnjs/data')` have matching declarations; import from the package root rather than internal files.
