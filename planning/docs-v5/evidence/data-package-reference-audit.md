# Native data reference audit

Audited 2026-09-30 against the working `5.0.0-rc.2` candidate. This establishes source coverage and executable example correctness, not independent reader effectiveness or registry publication.

## Objective and scope

Make the observable data package understandable without the records lesson or a particular evaluation task. Keep API/transport boundaries explicit, preserve small local Model uses, and describe the actual lifetime and notification contracts. The canonical reference is `docs/api/data.md`; `docs/setup.md` retains configuration and a short data introduction. `packages/data/readme.md` provides standalone use and candidate-local reference discovery, with no invented live publication link or duplicate full reference.

Sources inspected:

- `packages/data/package.json`: root ESM/CommonJS exports, declaration paths, packaged README, utility dependency.
- `packages/data/src/index.ts`: public runtime and type exports.
- `packages/data/src/model.ts`, `collection.ts`, `api.ts`: constructor signatures, implementation, exported interfaces and types.
- `test/unit/data-package/{model,collection,collection-observers,api-integration}.spec.js`: supported behavior and integration evidence.
- `docs/api/{events,common,state,data-providers,collection-view}.md`: existing canonical contracts linked from the new reference.

## Public surface disposition

| Surface | Canonical disposition |
| --- | --- |
| `Model` constructor / type | Model and TypeScript sections; optional attributes/options, initialization timing, generic/partial attributes. |
| `Model.extend` | TypeScript section and shared class extension reference. Initializer preferred over custom constructors; data classes do not inherit core owner option/binding helpers. |
| `defaults`, `idAttribute`, `initialize` | Model configuration table, including prototype timing and constructor option pass-through. |
| `attributes`, `changed`, `cid`, `id` | Model properties table; stable client identity, observed writes, sparse change state. |
| `get`, `has`, `set` (object/key forms), `unset`, `clear`, `reset`, `toObject` | Model operation table and mutation semantics, including own-property presence and shallow copies. |
| Model `change:<attribute>`, `change`, `destroy` and corresponding hooks | Model events table; payloads, order, synchronous delivery, no-op behavior, nested writes. |
| `Collection` constructor / type | Collection and TypeScript sections; scalar/array/null input, supplied Model identity versus raw-attribute factory. |
| `Collection.extend`, `model`, `comparator`, `initialize` | Collection configuration table and shared class extension reference; constructor `model` override and explicit sorting. |
| `models`, `length`, `at`, `get`, `indexOf`, `forEach`, `map`, iterator, `toArray` | Collection read/iterate table; exact identity resolution and copies versus Model references. |
| `add` (single/array, `options.at`), `remove` (single/array), `reset`, `move`, `sort` | Membership/ordering table; results, duplicate policy, ordering, notification consequences, no merge API. |
| Collection `add`, `remove`, `update`, `reset`, `sort`, `destroy` and corresponding hooks | Collection events table and forwarding explanation. Model destruction is handled by each Collection before it forwards that event. |
| `isDestroyed`, `destroy` on both classes | Destruction/ownership section; idempotence, read access retained, future mutations blocked, no transport, non-owning membership. |
| `on`, `once`, `off`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, `stopListening` | Explicit member list linking canonical Events signatures/cleanup. |
| `DataApi.key/get/has/serialize/models/subscribe/observeCollection` | Providers section with canonical native provider contract link; stable `cid`, copy/serialization behavior, normalized notifications. |
| `StateApi.subscribe/disposeOwned` | Providers section, native event-map overload, canonical provider/state ownership references. |
| Standalone `triggerMethod` re-export | TypeScript/export section with receiver example and shared Events contract. |
| `ModelAttributes`, `MutationOptions`, `ModelInput`, `CollectionOptions`, `CollectionChange`, `EventCallback`, `EventSource` | Exported type table; runtime versus type guarantees and generic boundaries. |
| Root ESM/CommonJS entrypoints | TypeScript/export section and standalone package instructions. Package metadata subpath remains metadata, not another API entrypoint. |

Private helpers, internal runtime interfaces, and non-root implementation aliases are not presented as public exports. There is no public `fetch`, `save`, `Collection.set`, automatic `toJSON`, validation, or silent mutation facility.

## Contract limitations recorded

No runtime or declaration changes were made. No source/type disagreement was found that blocks the documented supported operations.

- `Collection.toArray()` declarations return `ModelAttributes[]`, losing the member attribute generic. The reference says so rather than implying a narrower return type.
- `MutationOptions` is an open metadata shape; it does not type Model change payload fields. Event names do not infer payload types.
- Collection membership validates duplicate IDs on construction/reset and ignores them on add. Later Model ID mutations do not enforce uniqueness. The reference documents current lookup behavior and the consumer's identity responsibility.
- DataApi observation and Model events are distinct. Attribute writes do not implicitly refilter/resort a parent or notify structural observers.
- Native provider `subscribe` additionally accepts event maps; the generic core provider contract describes the literal-name signature.
- Local candidate documentation availability does not prove the same-version registry package includes these pages.

## Verification

- `npm run test:data`: **50 tests passed across 4 files** (Model, Collection, structural observation, View integration).
- All **3 actual data-reference fences executed against current source** with outcome checks from `test/docs/data-reference-checks.mjs`. Checks include defaults/reset/change delivery, retained membership and order, duplicate/no-op behavior, local destruction, and TypeScript example results.
- The TypeScript fence compiled with strict TypeScript 6.0.3 against the existing generated data declarations. This was not a rebuild or a legacy-TypeScript compatibility run.
- Assertions are integrated by the delivery worker into the normal reference-example runner; its candidate-package/build results are reported separately by the coordinator.
- A source-based independent read by the agent-discovery worker checked all data source modules. Applied its two corrections: documented the event-map provider overload, and clarified per-Collection destruction forwarding order.

This slice does not claim browser coverage, registry installation, independent fresh-reader transfer, or old/new documentation superiority. It removes the package README's escaping helper and parallel long reference while preserving useful standalone package guidance.

## Claude review follow-up

The coordinator's Claude review requested clearer post-destruction behavior and precise forwarded destruction order. The reference now says later data mutations are no-ops rather than throwing, and explicitly lists each containing Collection's `remove`, `update`, then forwarded `destroy` events.

The three reference fence checks were rerun after adding assertions for that sequence, retained snapshots after post-destruction mutation attempts, and both native providers' event-map subscription overload. The subscription assertions verify callback context, repeated cleanup, and preservation of independent subscriptions. All three passed against current source; the assertion module passed targeted ESLint. No runtime changes or additional public examples were needed. The package README keeps the verified candidate boundary and reuses one installation command.
