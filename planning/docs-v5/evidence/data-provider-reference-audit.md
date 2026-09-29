# DataApi and StateApi source audit

Audited 2026-09-29 against the current local `5.0.0-rc.2` source. This is contract evidence for the provider reference, not a recommended application architecture or evidence of documentation effectiveness. No runtime or public-documentation files were changed by this audit.

## Scope and authoritative sources

- `src/runtime/data-api.ts`, `src/runtime/state-api.ts`: exported defaults, provider signatures, class overlays.
- `src/create-marionette.ts`, `src/index.ts`: registration scope and public type exports.
- `src/mixins/template-render.ts`, `src/mixins/delegate-entity-events.ts`, `src/utils/subscribe-bindings.ts`: serialization and named-event consumers.
- `src/modules/collection-view.ts`, `src/mixins/view.ts`: collection snapshots, normalized notifications, reconciliation, teardown.
- `src/mixins/state.ts`, `src/modules/application.ts`: state ownership, lazy creation, subscription delivery, disposal.
- `packages/data/src/api.ts`, `model.ts`, `collection.ts`, `index.ts`: optional native providers and their actual source operations.
- `packages/adapters/src/data/backbone.ts`, `xstate.ts`, `internal/keyed-snapshot.ts`: optional adapter differences.
- `test/types/providers.mts` and `.cts`: intended registration and concrete-provider type boundaries (inspected; not separately compiled by this audit).

## DataApi surface

| Method | Consumer contract | Plain default |
| --- | --- | --- |
| `key(model)` | Non-null unique key, stable while a model remains in a CollectionView. Used for child lookup/reconciliation. Keys use Map/Set equality, including object identity. | Returns `model` itself. |
| `get(model, attribute)` | Read an attribute for string comparators and shorthand filters. | Reads own properties; absent is `undefined`. Nullish models are invalid direct inputs. |
| `has(model, attribute)` | Distinguish absence from an own property containing `undefined`, `null`, or another falsy value. | Own-property test; nullish sources yield `false`. |
| `serialize(model)` | Supplies template data through `serializeModel` or each item of `serializeCollection`. Does not imply cloning. | Returns the exact input. |
| `models(collection)` | Returns an ordered array of current model references/handles synchronously. CollectionView snapshots it and template serialization maps it. | Returns the exact array. |
| `subscribe(source, name, callback, context?)` | Bind one named model/collection event. Preserve source payload arguments and callback context. Return a callable unsubscribe function scoped to this subscription. | Uses `on`/`off`, validates those methods, and returns idempotent cleanup. Plain values with event maps throw `MN0037`. |
| `observeCollection(collection, callback, context?)` | Observe structural updates with the protocol below. Call with the supplied context and return subscription-specific cleanup. Current source must already reflect the notification. | Plain arrays are static: returns a no-op disposer and never notifies. Non-arrays throw `MN0037`. |

`modelEvents` and `collectionEvents` are separate subscriptions from CollectionView's structural observer. A model mutation does not implicitly rerender its child. Bind the relevant source event to `render` or another View update when needed. Rebinding entity events requires releasing prior bindings; assigning a different source/provider does not perform that release automatically.

DataApi has no source-disposal hook. Destroying a View releases its event subscriptions; destroying a CollectionView additionally releases its structural observer. Neither action destroys a borrowed `model` or `collection`. Configure the provider before constructing consumers; runtime/class overlays do not migrate live subscriptions.

### Structural notification schema

The core accepts these shapes at runtime:

```text
{ kind: 'reset' }
{ kind: 'reorder' }
{ kind: 'update',
  added: Model[],
  removed: Model[],
  updated: Array<{ previous: Model, current: Model }> }
```

- `models(collection)` must expose the complete current ordered source when the callback runs.
- `added` contains current source entries. `removed` contains previous source entries. These are model references/handles, not keys, serialized attributes, or indexes.
- Supply all three arrays on `update`, including empty arrays.
- `updated` describes an existing logical key. `previous` is the previously represented source and `current` is the source now represented by that same key. For a key change, report removal/addition instead.
- If `previous === current`, the existing child instance remains and its render is invalidated. A visible child rerenders through sorting/filtering. Avoid reporting the same mutation here as well as a model event unless the additional rerender is intentional.
- If `previous !== current`, the old child is replaced and destroyed. Equal keys do not preserve the child instance through immutable source replacement. Constructor-time model bindings and Behaviors then belong to the replacement child.
- `reorder` retains children and follows source order when `sortWithCollection` permits it. It does not imply model changes.
- `reset` destroys all existing children and creates children from the new snapshot, including when some model identities could have been retained.
- Notification delivery is synchronous. CollectionView queues nested notifications so it can reconcile against successive snapshots. Adapters should finish each source mutation before reporting it.
- Each observation must be independent. Unsubscribing one consumer must leave the source and other consumers usable.

CollectionView rejects missing, duplicate, and changed retained-model keys with `MN0039`. It distinguishes the same model repeated twice from distinct models sharing one key. This is not comprehensive schema validation: malformed `updated` entries can fail while normalizing instead of producing a tailored protocol diagnostic. The reference should state the required protocol rather than promise validation of every malformed notification.

### Default source limitations

The default supports plain objects/arrays without adaptation. Mutating an array or one of its records does not notify Views. Explicit rendering reads current data again. The default `key` means distinct plain objects remain distinct even if they have equal `id` properties; repeating the same object twice is invalid for CollectionView. Immutable replacements become new model identities unless a custom provider supplies another valid key policy.

## StateApi surface and ownership

`subscribe(source, name, callback, context?)` is required when the owner uses `stateEvents`. It preserves event names, callback arguments, and owner context. `disposeOwned(source)` is optional. The default StateApi's `subscribe` always throws `MN0037`; it does not infer observability from a source's shape. Plain default state is still usable without `stateEvents`.

The state-capable classes are Application, View, CollectionView, Behavior, and MnObject; Region does not own state. State follows its owner's lifetime, including across View renders and Application stops/restarts.

- `createState(options)` is lazy. `getState()` caches its result and marks it owned. Declared `stateEvents` requests state during construction.
- A supplied `state` option or prototype `state` is borrowed exactly as provided; functions are not evaluated. An explicit `undefined` means no supplied source.
- On destruction, release the owner's state subscriptions before calling `State.disposeOwned(source)` for an owned source. Borrowed state is never disposed by its borrower.
- A source that was never requested is not created just for teardown. First requesting an owned source after owner destruction disposes it immediately.
- The state mixin records release before cleanup/disposal and does not promise retry if a disposer throws.
- Application uses the same source/subscription across inactivity but gates handler delivery to the running state. Registering StateApi is not an activation/start hook.

## Native data providers

`@mnjs/data` exports `Model`, `Collection`, `DataApi`, `StateApi`, and a typed `CollectionChange` union. Native data is an optional observable in-memory layer; the examined source has no fetch/save/sync/API client or persistence contract. It can sit behind an application API layer or be replaced by another data solution.

- Native `DataApi.key` uses Model `cid`, so changing server `id` does not change child identity.
- `get`, `has`, and `serialize` recognize native Models and also accept plain records. Native `has` is own-attribute existence, including an attribute containing `undefined`.
- `serialize` returns `model.attributes` directly; it does not call a custom `toObject` or clone attributes.
- `models` requires an actual native Collection and returns a shallow copy of its model array. Installing this provider does not preserve the default array-as-collection contract.
- `subscribe` requires compatible `on` and `off` methods; event-map overloads also exist on this concrete provider. Cleanup is idempotent.
- `observeCollection` translates Collection `update` to its supplied `changes`, `reset` to reset, and `sort` to reorder. It uses the ordinary public event stream in registration order.
- Native add/remove updates contain `updated: []`. Model changes are model events, not immutable replacement notifications. `move`/`sort` reorder; `reset` resets. The native Collection has no `set`/merge operation in this source.
- Native `StateApi.disposeOwned` calls `source.destroy()` when present. Destroying a native Collection releases its own bindings but does not destroy its Models.

## Optional adapters: differences to retain

| Adapter | Data identity/observation | Owned state disposal |
| --- | --- | --- |
| `@mnjs/adapters/backbone` default export | Keys by `cid`; reads own attributes; serializes attributes directly; snapshots `collection.models`; normalizes structural events. Merges retain Models and report `updated: []`; model events update Views. Sorts emitted as part of add/set are suppressed in favor of update, preserving the tested Backbone notification boundary. | Deliberately no-op. Calling Backbone Model.destroy can perform persistence; there is no source-wide disposal that preserves caller-owned listeners. The owner handles any separate resource lifecycle. |
| `@mnjs/adapters/xstate` default factory | Actor-reference identity, object snapshot context, emitted events plus an opt-in `snapshotEvent` name. Optional `select` adds ordered collection observation. The same selected array reference means no structural recomputation; use a new array for changed membership/order. Distinct actors with reused IDs remain distinct. | Stops only factory-owned state actors through `actor.stop()`. Borrowed actors remain running. |

The XState adapter is not a universal immutable-record adapter: its collection layer compares actor references and emits add/remove/reorder with `updated: []`. It rejects missing/duplicate actors. The parent and child actors must supply synchronous snapshots; source subscription disposers are normalized to idempotent functions.

## Registration and type boundaries

- Global/runtime `setDataApi` configures View and CollectionView. Behavior observes its host's model/collection through the host Data provider.
- Global/runtime `setStateApi` configures Application, Behavior, CollectionView, MnObject, and View independently.
- Class-level `setDataApi`/`setStateApi` shallowly merge own properties into a new provider object and return the receiving class. Parent/sibling provider objects remain unchanged. Omitted methods are retained; explicit `undefined` can remove a capability. This is an overlay, not a provider-validity check.
- Root public types are `DataApiContract<Model = never, Collection = never, Attribute = never>` and `StateApiContract<Source = unknown>`. Configurable slots intentionally use opaque input types and optional methods; registration must not be treated as proof that arbitrary sources work with a concrete adapter.
- Core `observeCollection` callback payload is typed `unknown`, although runtime requires the structural protocol. The native data package exports its specific `CollectionChange<M>` type. There is no core-exported generic collection-change union in this snapshot.
- Concrete provider imports retain concrete signatures. Narrow provider registration is accepted without turning the provider into one that accepts every possible source.

## Verification run

Command:

```sh
npx vitest run test/unit/runtime/data-api.spec.js test/unit/runtime/state-api.spec.js test/unit/runtime/backbone-api.spec.js test/unit/data-api-integration.spec.js test/unit/data-api-redux.spec.js test/unit/provider-acceptance.spec.js test/unit/state-owner.spec.js test/unit/data-package/api-integration.spec.js test/unit/data-package/collection-observers.spec.js test/unit/xstate-adapter.spec.js test/unit/collection-view/collection-view-reconciliation.spec.js test/unit/collection-view/collection-view-data.spec.js
```

Result: **151 tests passed in 12 files**, exit 0, 2026-09-29. Run log: `/tmp/data-provider-audit-tests.log` (temporary local evidence).

This validates the examined runtime/provider contracts. It does not demonstrate a complete data product, correctness of a new adapter, or fresh-reader learning/agent transfer.

## Public draft review

Reviewed `docs/api/data-providers.md` and the Data/State portions of `docs/api/runtime.md` on 2026-09-29. All seven DataApi methods, both StateApi methods, native integration differences, registration scope, defaults, disposal, and public type boundaries have public dispositions. Owner lifecycle remains canonical in `docs/api/state.md`; class configuration and runtime isolation remain canonical in `runtime.md`. Optional Backbone/XState behavior is identified here as source evidence; full integration guides remain separate work.

No Data/State contract blocker was found. Two wording refinements are useful: call Marionette's provider the **built-in default** rather than “Native default,” which can be confused with the separate native data package; qualify the emission requirement as **structural changes**, since ordinary model attribute mutations need not emit collection notifications.

### Initial notification requirement

The prohibition on an initial structural notification is supported by the render order, not an existing explicit contract test: CollectionView builds its snapshot and children, then subscribes, and only afterward establishes its child container. A synchronous notification during subscription enters reconciliation before the container exists. The recommended precise wording is “Subscribe to subsequent changes; do not synchronously emit an initial notification.” The built-in, native-data and Backbone observers do not emit one. The keyed-snapshot adapter suppresses an unchanged selected snapshot, including an immediate unchanged source emission.

Ran this temporary read-only source probe (no repository test file was added):

```sh
node --experimental-strip-types --input-type=module <<'JS'
import { JSDOM } from 'jsdom';
const window = new JSDOM('<!doctype html><html><body></body></html>').window;
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node']) {
  globalThis[name] = name === 'window' ? window : window[name];
}
const { createMarionette } = await import('./src/index.ts');
for (const kind of ['reorder', 'reset', 'update']) {
  const runtime = createMarionette();
  let view;
  runtime.CollectionView.setDataApi({
    observeCollection(source, callback, context) {
      callback.call(context, kind === 'update'
        ? { kind, added: [], removed: [], updated: [] } : { kind });
      return () => {};
    }
  });
  try {
    view = new runtime.CollectionView({
      collection: [{ id: 1 }],
      childView: runtime.View.extend({ template: () => 'one' })
    });
    view.render();
    console.log(kind, 'pass', view.el.innerHTML);
  } catch (error) {
    console.log(kind, error.name, error.message);
  } finally {
    view?.destroy();
  }
}
JS
```

Observed output for each of `reorder`, `reset`, and `update`: `TypeError Cannot read properties of undefined (reading 'ownerDocument')`. The command exited 0 because it deliberately caught and reported each failure. This identifies an unsupported adapter behavior; it is not a newly passing runtime test or a request to alter the runtime in this documentation slice.
