# View reference member audit

Date: 2026-09-29. Scope: [View](../../../docs/api/view.md) and its canonical [shared runtime](../../../docs/api/view-runtime.md), using current declarations and implementation. This is an author contract audit, not an independent-reader usability result. No runtime changes were made for this audit.

## Candidate surface and dispositions

Candidates include `ViewConfiguration`, `ViewInstance` and inherited `CommonMixin`/`ViewFluent`, `ViewConstructor` statics, implementation lifecycle events, and relevant exported types. The rows enumerate every declaration member, grouped by authoritative section; names within a row have the same disposition. Internal members are retained below rather than silently omitted.

| Candidate members | Disposition / canonical reference | Source evidence |
| --- | --- | --- |
| `new View(options?)`, `preinitialize`, `initialize`, `options`, `cid`, `cidPrefix` | Documented: [construction](../../../docs/api/view.md#construction-and-options). | `src/modules/view.ts` constructor and `ViewInstance`; `src/mixins/common.ts`; `src/mixins/view.ts`. |
| `el`, `tagName`, `id`, `className`, `attributes` | Documented: [options](../../../docs/api/view.md#construction-and-options), [existing elements](../../../docs/api/view.md#existing-elements), [root attributes](../../../docs/api/view-runtime.md#root-attributes). | `ViewConfiguration`, `ViewOptions`, `_getEl`, `_getAttributes`, `renderAttributes`. |
| `model`, `collection`, `template`, `templateContext` | Documented: [options](../../../docs/api/view.md#construction-and-options), [templates](../../../docs/api/view-runtime.md#templates-and-data). | `src/mixins/template-render.ts`; `src/runtime/data-api.ts`. |
| `events`, `triggers`, `delegateEvents`, `undelegateEvents` | Documented: [DOM events](../../../docs/api/view-runtime.md#dom-events). | `src/mixins/view-events.ts`, `src/mixins/view.ts`, `src/runtime/event-delegator.ts`. |
| `modelEvents`, `collectionEvents`, `delegateEntityEvents`, `undelegateEntityEvents` | Documented: [data bindings](../../../docs/api/view-runtime.md#data-bindings). Explicit undelegation before rebinding; no false claim that delegation alone replaces old bindings. | `src/mixins/delegate-entity-events.ts`, `src/utils/subscribe-bindings.ts`. |
| `ui`, `$`, `getUI`, `bindUIElements`, `unbindUIElements`, `normalizeUIString`, `normalizeUIKeys`, `normalizeUIValues` | Documented: [UI bindings](../../../docs/api/view-runtime.md#ui-bindings). Query type, timing, missing-map errors, and normalizer mutation behavior included. | `src/mixins/ui.ts`, `src/mixins/view.ts`, `src/runtime/dom-api.ts`. |
| `childViewEvents`, `childViewTriggers`, `childViewEventPrefix` | Documented: [child events](../../../docs/api/view-runtime.md#child-events). Default prefix false, unchanged arguments, handler → mapping → prefix order, detachment cleanup. | `src/mixins/view.ts` event proxies; Region `_stopChildViewEvents`; CollectionView child removal. |
| `behaviors` | Documented: [composition option](../../../docs/api/view-runtime.md#behavior-composition). Array/object/callable definitions, nested host composition, lifecycle binding, host UI precedence. Full standalone Behavior reference remains outside this slice. | `src/mixins/behaviors.ts`, `src/modules/behavior.ts`. |
| `regions`, `regionClass`, `addRegion`, `addRegions`, `removeRegion`, `removeRegions`, `emptyRegions`, `hasRegion`, `getRegion`, `getRegions`, `showChildView`, `detachChildView`, `getChildView` | Documented: [named Regions](../../../docs/api/view.md#named-regions). Includes returns, ownership, name/runtime conflicts, render side effects, missing-name behavior, destruction, and no registration events. | `src/modules/view.ts` RegionsMixin and registration validation; `src/modules/common/build-region.ts`. |
| `render`, `destroy`, `isDestroyed`, `isRendered`, `isAttached` | Documented: [rendering/status](../../../docs/api/view.md#rendering-and-status), [lifecycle](../../../docs/api/view.md#lifecycle-hooks-and-events). | `src/modules/view.ts` render; `src/mixins/view.ts` destroy/status. |
| `renderAttributes` | Documented: [root attributes](../../../docs/api/view-runtime.md#root-attributes). | `src/mixins/view.ts`; native `DomApi.setAttributes`. |
| `getTemplate`, `serializeData`, `serializeModel`, `serializeCollection`, `mixinTemplateContext`, `attachElContent` | Documented: [template extension points](../../../docs/api/view-runtime.md#templates-and-data). | `src/mixins/template-render.ts`. |
| `monitorViewEvents` instance property; exported `monitorViewEvents(view)` | Documented: [lifecycle](../../../docs/api/view.md#lifecycle-hooks-and-events). Disabled on class, not recognized constructor option; installer is idempotent. | `src/modules/common/monitor-view-events.ts`; View constructor; Region monitor gate. |
| `Dom`, `Data`, `State`, `EventDelegator`, `_renderHtml`; static `setRenderer`, `setDomApi`, `setDataApi`, `setStateApi`, `setEventDelegator` | Documented: [class configuration](../../../docs/api/view-runtime.md#class-configuration). `_renderHtml` is explicitly retained as renderer extension slot despite underscore. Full provider-authoring reference remains a separate gap. | `src/runtime/*.ts`; `src/create-marionette.ts`; `ViewConstructor`. |
| `state`, `stateEvents`, `createState`, `getState` | Documented by canonical [state](../../../docs/api/state.md), linked from View. | `src/mixins/state.ts`; `src/runtime/state-api.ts`. |
| `getOption`, `mergeOptions`, `normalizeMethods`, `bindEvents`, `unbindEvents`, `bindRequests`, `unbindRequests` | Documented by canonical [common](../../../docs/api/common.md), linked from View. | `src/mixins/common.ts`; corresponding `packages/utils/src` exports. |
| `on`, `off`, `once`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, `stopListening` | Documented by canonical [events](../../../docs/api/events.md), linked from View. | `packages/utils/src/events.ts`; View destruction cleanup. |
| Static `extend`, `prototype`, `call`, `apply`, runtime `__super__` | Documented through [common constructor inheritance](../../../docs/api/common.md), linked from View. `prototype`/`call`/`apply` are constructor/JavaScript invocation surfaces, not independent View lifecycle operations. `__super__` is the parent prototype reference created by `extend`. | `ViewConstructor`; `src/utils/extend.ts`; `packages/utils/src/extend.ts`. |
| `_setOptions` | Internal: shared constructor setup helper; not an application extension point. Public `getOption`/`mergeOptions` are documented. | `src/mixins/common.ts`, invocation in View constructor. |
| `_removeBehavior` | Internal: Behavior-to-host registration teardown, included structurally in declarations to satisfy composition; no consumer removal operation promised. | `src/mixins/behaviors.ts`; `Behavior.destroy()`. |
| `_getImmediateChildren` | Internal lifecycle adapter hook, included in the structural `ViewLifecycle` contract. Consumers of native View use Region methods. Custom foreign-View integration belongs to provider/ownership reference, not undocumented native customization. | `src/modules/view.ts`; `src/modules/common/view.ts`; `monitor-view-events.ts`. |

Other underscore members appear only in internal host interfaces/mixins and implement the documented operations: `_getEl`, `_getAttributes`, `_isElAttached`, status flags, Region registries, `_init*`, `_reInitRegions`, `_addRegions`, `_addRegion`, `_removeReferences`, `_getRegions`, `_removeChildren`, UI helpers, child proxy helpers, Behavior/entity/state subscription helpers and `_renderTemplate`. They are internal composition machinery; no source-supported application extension contract was identified for them. `_renderHtml` is the explicit exception above.

## Exported type disposition

| Types | Disposition |
| --- | --- |
| `ViewConfiguration`, `ViewInstance`, `ViewConstructor` | Documented generic roles/defaults and inference in [View TypeScript](../../../docs/api/view.md#typescript); constructor example uses actual `ViewConfiguration`. |
| `RegionDefinition`, `RegionClass`, `ShowOptions`, `SupportedView`, `ViewLifecycle` | Cross-reference Region/ownership contracts. `SupportedView` is a structural lifecycle+render/destroy contract; `ViewLifecycle` includes integration bookkeeping and is not a minimal custom View recipe. |
| `UISelectors`, `UIBindings`, `DOMEvents`, `DOMTriggers`, `TriggerDefinition`, `TriggerOptions`, `Bindings` | Documented shapes and semantics in [shared types](../../../docs/api/view-runtime.md#types). |
| `BehaviorDefinition`, `BehaviorDefinitions`, `BehaviorOptionsDefinition` | Documented composition shapes in shared types/Behavior composition; complete Behavior constructor/instance contracts deferred. |
| `Renderer`, `DomApiContract`, `DataApiContract`, `StateApiContract`, `EventDelegator`, `DelegateOptions`, `DelegatedEvent` | Documented use at View configuration boundaries; full provider method reference still deferred and explicitly not certified by this slice. |

## Lifecycle event audit

The [lifecycle table](../../../docs/api/view.md#lifecycle-hooks-and-events) documents `before:render`, `render`, `before:attach`, `attach`, `dom:refresh`, `before:detach`, `dom:remove`, `detach`, `before:destroy`, `destroy` and each matching `on…` hook. Render/DOM/attach/detach arguments are `(view)`; destroy arguments `(view, options)`. Hooks precede subscribers through `triggerMethod`. Initialization hooks are constructor hooks, not View initialization events; Behaviors receive a separate host initialization notification.

Monitoring emits nested notifications synchronously, so lifecycle phase order must not be represented as universal external subscriber order. Region/CollectionView ownership can detach before destroying; direct View destruction emits `before:destroy` before its own detach. No `before:add:region`, `add:region`, `before:remove:region`, or `remove:region` lifecycle exists in this v5 implementation.

## Verification performed

Ran 24 focused Vitest files: **261 tests passed** on 2026-09-29. Command:

```sh
npx vitest run test/unit/view-lifecycle.spec.js test/unit/view-fixed-root.spec.js test/unit/view-render-attributes.spec.js test/unit/view-constructor-options.spec.js test/unit/view-dom-delegation.spec.js test/unit/view.ui-bindings.spec.js test/unit/view.ui-event-and-triggers.spec.js test/unit/view.triggers.spec.js test/unit/view.renderer.spec.js test/unit/view-get-region.spec.js test/unit/view-get-regions.spec.js test/unit/view-has-region.spec.js test/unit/view-region-registration.spec.js test/unit/view-region-diagnostics.spec.js test/unit/view-ownership.spec.js test/unit/view.dynamic-regions.spec.js test/unit/view.child-views.spec.js test/unit/common/monitor-view-events.spec.js test/unit/mixins/template-render.spec.js test/unit/mixins/ui.spec.js test/unit/mixins/delegate-entity-events.spec.js test/unit/mixins/view-composition.spec.js test/unit/behavior-composition.spec.js test/unit/behavior-lifecycle.spec.js
```

Source/test checks establish: adoption/fixed root; attribute updates; lifecycle state/propagation; render and serializer behavior; Region query/operation side effects and registration conflicts; UI normalization and event delegation; explicit source rebinding; Behavior host composition. Tests using alternate adapters were read as contract evidence, not used as recommended application architecture.

The two new standalone code fences require a DOM environment and installed packages; one imports TypeScript types, one imports Lit. Their extraction, package declaration compilation, and execution are owned by the slice's integration check. This audit does not claim those checks ran until their result is recorded by that check. Independent reader effectiveness and full provider-authoring coverage remain unverified.
