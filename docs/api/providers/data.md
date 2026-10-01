# Data and state providers

[API index](../../api.md) · [Runtime configuration](../runtime.md) · [State ownership](../shared/state.md)

DataApi lets Views read and observe supplied data. StateApi lets an owner observe and dispose its own state. Configure them separately: a View's `model`/`collection` and an owner's state may use different sources. Neither contract supplies API requests or persistence. For an optional implementation, see the [`@mnjs/data` providers](../../packages/data.md#providers) and [setup guide](../../integrations/setup.md).

## DataApi

`setDataApi(mixin)` overlays the provider on View and CollectionView at the selected [configuration scope](../runtime.md#choose-a-configuration-scope). Behavior entity bindings use their host's DataApi. A CollectionView's children use their own class configuration; configuring the parent alone does not configure its children.

| Method | Contract | Built-in default |
| --- | --- | --- |
| `key(model) → key` | Stable, non-null unique identity within the observed collection. See [identity](#collection-identity-and-observation). | Returns the model itself. Plain object identity is its key. |
| `get(model, attribute) → value` | Read an attribute used by filtering/comparison and other consumers. | Own-property lookup; missing returns `undefined`. Nullish model is invalid for this method. |
| `has(model, attribute) → boolean` | Test attribute presence. | Own-property existence, independent of truthiness; nullish returns false. |
| `serialize(model) → data` | Return data for template rendering. It need not be a copy. | Returns the source unchanged. |
| `models(collection) → readonly model[]` | Return the current ordered model snapshot. Keep model identities stable when they represent retained entities. | Returns the supplied array itself; array mutation is not observed. |
| `subscribe(source, name, callback, context?) → cleanup` | Subscribe to one literal source event, preserving callback arguments and supplied context. | Requires compatible `on`/`off`, otherwise throws `MN0037`. |
| `observeCollection(collection, callback, context?) → cleanup` | Observe membership/order/update notifications described below, calling the callback with its context. | Accepts only arrays, returns a no-op cleanup; other sources throw `MN0037`. |

The default supports plain values and static arrays. Explicit entity event maps still need observable sources. The default StateApi does not reuse DataApi's `on`/`off` support automatically.

For either subscription method, return cleanup that releases only the registered callback/context and prevents further delivery. Do not destroy shared data or clear other consumers' subscriptions. An owner may have multiple subscriptions to the same source. DataApi has no disposal method: View destruction releases observation while leaving its model/collection alive.

## Collection identity and observation

CollectionView reads a snapshot and subscribes during its first render. The provider must publish notifications **after** the source reflects that change, so `models(collection)` already returns the corresponding order and membership. Subscribe to subsequent changes; do not synchronously emit an initial notification during registration. Use these callback shapes:

| Notification | Required payload and meaning |
| --- | --- |
| Reset | `{ kind: 'reset' }` — destroy all existing children and build from the current snapshot, even when model identities remain. |
| Reorder | `{ kind: 'reorder' }` — source order changed with membership retained. CollectionView follows it according to `sortWithCollection` and its comparator. |
| Update | `{ kind: 'update', added: [...], removed: [...], updated: [{ previous, current }, ...] }` — report additions/removals as actual model values, and changed/replaced models as pairs. All three arrays are required, even when empty. |

`previous` refers to the previously observed model and `current` to the current model for the same stable key. A same-object pair marks its existing child for rendering. A different-object pair replaces and destroys the old child even when the key is unchanged. Added/removed entries must correspond to the before/after snapshots. Emit a coherent change for each structural source change; notifications describe completed changes, not commands for Marionette to mutate the collection.

Every model must occur once. Keys must be non-null, unique and unchanged while that model remains observed; CollectionView raises `MN0039` for these key violations. These key checks are not comprehensive validation of malformed notification payloads. Equality follows JavaScript Map/Set semantics, which compares object keys by identity. A domain ID is suitable only if it meets those lifetime constraints. A retained key does not grant a new model object the previous child's identity.

Keep source events separate from collection notifications. A Model's `change` event can drive a row's `modelEvents`; it does not by itself mean the collection observer emits an update, sorts, or refilters. See [`@mnjs/data` providers](../../packages/data.md#providers) for that package's collection event translation. Reporting one mutation both as a same-object update pair and as a row render event can render that row twice. Use the [CollectionView reference](../collection-view.md) for display/lifetime operations.

A custom provider may use stable opaque references, such as entity IDs, and read their current attributes from an immutable store. Keeping those references stable allows existing Views to react through source events; retaining a View does not itself preserve its input nodes or drafts. DOM retention depends on that View's renderer and update strategy.

## StateApi

| Method | Contract |
| --- | --- |
| `subscribe(source, name, callback, context?) → cleanup` | Observe one literal state event. Preserve source callback arguments and context; return cleanup that releases only this subscription. |
| `disposeOwned(source)` | Optional synchronous disposal for a source returned by `createState`. Called after that owner's state subscriptions are released. |

The default `StateApi.subscribe` always throws `MN0037`; configure a compatible provider before using `stateEvents`. The default has no `disposeOwned`. Plain default state can still be read and changed without declarative observation.

State returned by `createState` is owned; constructor/prototype `state` is borrowed. Disposal is never called for borrowed state. Unrequested lazy state is not created just to destroy it. Application start/stop/restart retain state, and Marionette gates Application `stateEvents` by activity; the provider does not implement that gate. Other state owners observe throughout their live lifetime. See the shared [state reference](../shared/state.md) for owner methods and lifecycle.

Do not use `disposeOwned` to issue server deletion or dispose resources owned elsewhere. It is a local ownership boundary. It is not awaited. DataApi and StateApi can share subscription code while retaining different disposal responsibilities.

## TypeScript

Import `DataApiContract<Model, Collection, Attribute>` and `StateApiContract<Source>` from `marionette`. Data parameters default to `never`; StateApi's standalone source parameter defaults to `unknown`, while configured class state slots are opaque. Specify concrete source types on a provider you author. `subscribe` and `observeCollection` must return cleanup functions; `models` must return an array.

The public `observeCollection` callback parameter is currently typed `unknown`; the notification shapes above are a runtime contract, not an exported core change union. The optional [`@mnjs/data` package](../../packages/data.md#typescript) exports its own `CollectionChange` type. A provider's declaration alone does not validate notification consistency.

Class setters accept concrete partial providers without inferring a universal model/state type for every consumer. Keep direct adapter values typed and validate them through the intended View/CollectionView/state owners. Registering a provider does not change source ownership, add transport, or install it on other independently configured classes.
