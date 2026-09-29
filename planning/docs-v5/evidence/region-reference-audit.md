# Region reference member audit

Date: 2026-09-29. Scope: the supported Region reference, independent of the records example. No runtime changes were made for this audit. Source is the working tree based on `b6f23c5953793d5cef1cb51dbc675420214ffd01`; `git diff --binary HEAD -- src packages | shasum -a 256` returned `c356d888e6a87a840f754348b44cf32e684b0684026e4f9f29a640641755cdf6`.

Canonical page: [Region](../../../docs/api/region.md). Shared contracts are linked to their owning pages, rather than copied into a second Region definition. This audit inventories declarations and runtime-emitted hooks/events; it does not infer public support from old documentation or test architecture.

## Source surface

- [RegionOptions, RegionInstance, RegionConstructor and RegionInternals](../../../src/modules/region.ts): options at lines 17–26; public instances at 38–60; constructor/static declarations at 68–81; internal declarations at 83–106; implementation at 112–524.
- [Region fluent methods](../../../src/modules/common/chainable-methods.ts): `show`, `empty`, `reset`, and `destroy` preserve receiver typing; `show` may return `undefined`.
- [Common mixin](../../../src/mixins/common.ts) and [Events](../../../packages/utils/src/events.ts): inherited public surface.
- [RegionDefinition and RegionClass](../../../src/modules/common/build-region.ts): supported configuration forms and runtime ownership checks.
- [SupportedView and ViewLifecycle](../../../src/modules/common/view.ts): accepted child contract, conditional render, destruction helper.
- [View destruction](../../../src/mixins/view.ts), [CollectionView destruction](../../../src/modules/collection-view.ts), and [event monitoring](../../../src/modules/common/monitor-view-events.ts): outgoing-child and descendant notification order.
- [DOM provider](../../../src/runtime/dom-api.ts): native insertion/removal and static provider merging.
- [Core entrypoint](../../../src/index.ts): exported Region and related types; `RegionInternals` is not re-exported here.

## Member dispositions

Each named item below has a disposition. Grouped items share one canonical contract, not an assumed equivalent implementation.

| Candidate member | Disposition and canonical location | Verification / qualification |
| --- | --- | --- |
| Constructor `new Region(options?)` | Documented: [construction](../../../docs/api/region.md#construction-and-options) | Defers element resolution; invokes initialize with constructor arguments. |
| `initialize(options)` | Documented: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | No-op default from Common; called after options and cid setup. No Region preinitialize hook exists. |
| `el` option/class property | Documented: [construction](../../../docs/api/region.md#construction-and-options) and [queries](../../../docs/api/region.md#properties-and-queries) | String or Element; null/undefined are allowed during construction, not valid for showing. Initial value is retained privately for reset. |
| `parentEl` | Documented: [construction](../../../docs/api/region.md#construction-and-options) | Element/Document/function; absent result uses document; descendant query excludes parent itself. |
| `allowMissingEl` | Documented with known recovery limitation: [show](../../../docs/api/region.md#showing-a-view) | Boolean/function class value; boolean operation override. See unresolved recovery issue below. |
| `replaceElement` | Documented: [replacement](../../../docs/api/region.md#replacing-the-region-element) | Boolean/function class value; per-show boolean override. Requires a parent to exchange DOM nodes. |
| `options` | Documented: [queries](../../../docs/api/region.md#properties-and-queries), linked [common](../../../docs/api/common.md) | Merged defaults and supplied options. |
| `cid`, `cidPrefix` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | Unique identifier, default prefix mnr. |
| `Dom` | Documented: [queries](../../../docs/api/region.md#properties-and-queries), linked [runtime](../../../docs/api/view-runtime.md) | Class provider; no renderer/data/state provider methods belong to Region. |
| `currentView` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | Owned child, absent when empty; ownership changes go through lifecycle methods. |
| `show(view, options?)` | Documented: [show](../../../docs/api/region.md#showing-a-view) | Conditional render, ownership error, repeated show, return type, synchronous exceptions. |
| `empty(options?)` | Documented: [empty/detach/reset/destroy](../../../docs/api/region.md#empty-detach-reset-and-destroy) | Destroys live current child; clears unmanaged content if none; no-options missing-selector allowance. |
| `detachView()` | Documented: [empty/detach/reset/destroy](../../../docs/api/region.md#empty-detach-reset-and-destroy) | Returns live child/undefined; clears ownership and View-owner subscriptions. |
| `reset(options?)` | Documented: [empty/detach/reset/destroy](../../../docs/api/region.md#empty-detach-reset-and-destroy) | Calls empty, then restores initial reference. It cannot currently recover after a missing lookup erased el. |
| `destroy(options?)` | Documented: [empty/detach/reset/destroy](../../../docs/api/region.md#empty-detach-reset-and-destroy) | before:destroy, reset/empty, mark destroyed, unlink owner/name, destroy, stopListening/off. Destruction guards recorded. |
| `hasView()` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | Checks currentView without rendering. |
| `getOwner()` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | View registration only, including CV empty Region. Application does not populate _parentView. |
| `getName()` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | Named View registration or undefined. |
| `isReplaced()` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | Boolean replacement state. |
| `isSwappingView()` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | True through successful replacement callbacks; reset after show. No rollback on callback throw. |
| `isDestroyed()` | Documented: [queries](../../../docs/api/region.md#properties-and-queries) | True before final notification; early teardown failure can leave false/destroying. |
| `getEl(selector)` | Documented extension point: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | Returns first native Element or undefined. |
| `attachHtml(view)` | Documented extension point: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | Native append by default; not used for replacement. |
| `detachHtml()` | Documented extension point: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | Native clearing by default. |
| `removeView(view)` | Documented extension point: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | Calls destroyView by default; no return. |
| `destroyView(view)` | Documented extension point: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | Returns supplied child; no-op for destroyed child; observes monitoring policy. |
| Static `extend`, `prototype`, `call`, `apply` | Documented: [customization](../../../docs/api/region.md#customization-and-inherited-methods), linked [common construction](../../../docs/api/common.md) | Constructor declaration exposes these; custom constructor arguments and statics carry into derived types. |
| Static `setDomApi(partialApi)` | Documented: [customization](../../../docs/api/region.md#customization-and-inherited-methods) | Shallow merges into class prototype provider; returns receiving class. |
| `getOption`, `mergeOptions`, `normalizeMethods` | Documented inherited links: [common](../../../docs/api/common.md) | CommonMixin implementations. |
| `bindEvents`, `unbindEvents`, `bindRequests`, `unbindRequests` | Documented inherited links: [common](../../../docs/api/common.md) | Region has these explicit binding helpers, not Radio channel auto-configuration. |
| `on`, `once`, `off`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, `stopListening` | Documented inherited links: [events](../../../docs/api/events.md) | Native Events mixin; destruction calls stopListening and off after final notification, even if that hook throws. |
| `before:show` / `onBeforeShow`, `show` / `onShow` | Documented: [lifecycle](../../../docs/api/region.md#lifecycle-events-and-hooks) | Exactly `(region, incomingView, options)`; options can be undefined. |
| `before:empty` / `onBeforeEmpty`, `empty` / `onEmpty` | Documented: [lifecycle](../../../docs/api/region.md#lifecycle-events-and-hooks) | Exactly `(region, outgoingView)`; no options argument, including detach and external child destruction. |
| `before:destroy` / `onBeforeDestroy`, `destroy` / `onDestroy` | Documented: [lifecycle](../../../docs/api/region.md#lifecycle-events-and-hooks) | Exactly `(region, options)`; hook first, listeners second. |
| Outgoing CollectionView `before:destroy:children`, `destroy:children` | Documented cross-class ordering: [replacing a CollectionView](../../../docs/api/region.md#replacing-a-collectionview) | Exactly `(collectionView)` and belong to child, not Region; emitted only for nonempty managed children. |
| RegionOptions, ShowOptions, RegionInstance, RegionConstructor | Documented: [types](../../../docs/api/region.md#typescript-types) | Public exports; Options/Props/Args/Statics and fluent returns described. |
| RegionDefinition, RegionClass | Documented: [types](../../../docs/api/region.md#typescript-types), linked [View](../../../docs/api/view.md) | Definitions consumed by View/Application registration. |
| RegionOwner | Documented: [types](../../../docs/api/region.md#typescript-types) | Structural return type. `monitorViewEvents` is the owning View's public control; stopListening is inherited. `_proxyChildViewEvents`/`_removeReferences` remain framework coordination members, not recommended calls. |
| SupportedView, ViewLifecycle | Documented: [types](../../../docs/api/region.md#typescript-types) | Native classes satisfy these; includes lifecycle metadata, event methods, child traversal. Public custom-provider implementation guidance remains in broader provider-authoring scope. |

### Internal members

These are declared on `RegionInternals`, not on `RegionInstance`, and are implementation mechanisms rather than customization methods: `[runtimeId]`, `_initEl`, `_isReplaced`, `_isSwappingView`, `_isDestroying`, `_isDestroyed`, `_parentView`, `_name`, `_setEl`, `_setElement`, `_ensureElement`, `_getView`, `_setupChildView`, `_proxyChildViewEvents`, `_shouldDisableMonitoring`, `_isElAttached`, `_attachView`, `_replaceEl`, `_restoreEl`, `_empty`, `_stopChildViewEvents`, `_detachView`. The public counterparts are the reference's lifecycle/lookup methods and configuration options. `_setElement` is used by framework container retargeting; it is not a supported Region setter.

Inherited `_setOptions` and event bookkeeping (`_rd*`) are also internal. Declaration-only `RegionResult`, `Common`, and fluent composition helpers implement exported instance/constructor typing rather than additional runtime APIs. `RegionInternals` itself is not a core entrypoint type export. `ViewLifecycle`'s underscore fields and `_getImmediateChildren` are exposed structurally for native integration, not recommended application overrides.

## Known runtime limitation requiring a recovery decision

**Needs decision: recovery after an unmatched Region selector.** `show()` with `allowMissingEl: true` correctly returns undefined without rendering or owning the supplied View. However `_setEl` overwrites `region.el` with undefined. A subsequent `show()` or `reset()` throws `MN0004`, even after the target appears, because reset calls empty before restoring `_initEl`. The reference documents skip behavior without promising later recovery. No workaround helper or runtime patch was added.

Fresh source-level probe, run with Node's TypeScript stripping and JSDOM:

```text
new Region({ el: '#late', allowMissingEl: true })
initial show: undefined; region.el: undefined
append an element with id late
reset: MN0004 An "el" must be specified for a region.
show: MN0004 An "el" must be specified for a region.
```

The probe imported `src/modules/region.ts` and `src/modules/view.ts` directly, set `globalThis.document` from JSDOM, and used `new View({ template: false })`; it did not use a stale packaged Region build. This is not a documentation-caused failure. The choice of retry semantics remains outside this reference-only slice and must stay visible in the coverage inventory.

## Verification

Fresh command:

```sh
npx vitest run test/unit/region.spec.js test/unit/region-lifecycle.spec.js test/unit/region-el-validation.spec.js test/unit/region-adoption.spec.js test/unit/region-detach-contents.spec.js test/unit/collection-view/collection-view-lifecycle.spec.js
```

Result: **6 files, 141 tests passed**. This validates existing contract tests, not reader understanding.

Useful exact tests include:

- `Region lifecycle contract > reports swapping throughout replacement lifecycle callbacks`
- `Region lifecycle contract > destroys an occupied Region in public lifecycle order`
- `Region lifecycle contract > reads Region ownership without rendering or mutating it`
- `Region lifecycle contract > keeps the CollectionView empty Region unnamed and clears its owner`
- `Region lifecycle contract > runs reset and empty overrides during destruction (delegated reset)`
- `Region lifecycle contract > clears the Region once when its current View is destroyed externally`
- `Region adoption > renders a Marionette View once across Region adoption`
- `Region el validation > requires an element before showing a View`
- `Region.empty() with the native DomApi > clears the region element contents when no view is shown`
- `CollectionView lifecycle contract > destroys managed children after detaching the parent and only once`

Further source-backed tests inspected: [automatic observer cleanup](../../../test/unit/destroy-listener-cleanup.spec.js), [Region configuration forms](../../../test/unit/common/build-region.spec.js), and [TypeScript presentation surface](../../../test/types/presentation.mts). These were not included in the six-suite command above; aggregate slice verification records additional runs separately.

The new TypeScript snippet is self-contained with native DOM and imports; aggregate slice validation is responsible for extracting, compiling against package declarations, and executing it. The detailed replacement sequence is derived from Region, shared View teardown, CollectionView child teardown, and monitoring; aggregate lifecycle probes can verify the composed sequence. Do not report these as executed until that validation runs.

## Quality boundary

Coverage has a member disposition for the Region surface and the explicit missing-selector recovery issue. Accuracy has source checks and the six passing existing suites. Findability has dedicated headings and a direct class page; author lookup and link checks belong to aggregate verification. Architecture is explained through generic ownership and moving a settings View, independent of any application example. Reader usability is unverified. Shared inherited contracts have canonical links; full DOM-provider authoring remains separate inventory work.
