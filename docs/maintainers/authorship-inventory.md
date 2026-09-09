# Production authorship inventory closeout

This is the finite path reconciliation for [#329](https://github.com/marionettejs/marionette/issues/329), dated 2026-09-09. It accounts for all **46 historical paths** in the fork `662996b2` to `14db5c1a` inventory and all **62 current non-declaration authored TypeScript files (including type-only support modules)** at production source revision `6bc139c7`. Generated distributions, the generated version module, and `src/version.d.ts` are outside this authored-source inventory. The stabilization and closeout changes add no production framework source.

The historical comparisons with v4.1.3 (`9c0147b4`) and Toolkit remain in the issue's group assessments. This reconciliation updates their paths and dispositions; it is not a new line-by-line behavior audit. The [core](./source-comment-audit.md) and [companion](./package-comment-audit.md) comment audits record their separate full-file scope. The API inventory supplies the current file set, not proof of authorship or behavior.

## Current paths and final dispositions

“Retain” records the technical reason for the current implementation after completed corrections. No unresolved `align` item or separate behavior/API correction remains in this bounded inventory. A future finding needs its own concrete contract and issue; it does not reopen a cosmetic loop.

| Current path | Original inventory path | Final disposition and technical reason |
| --- | --- | --- |
| `packages/adapters/src/data/backbone.ts` | `backbone.js` | Retain opt-in data/state integration; the old prototype-patching Backbone shim is removed. #453 preserves model-owned rendering. |
| `packages/adapters/src/data/internal/keyed-snapshot.ts` | Not listed among the original 46 changed paths | Retain ordered keyed snapshot validation shared by optional adapters; no core import. |
| `packages/adapters/src/data/xstate.ts` | Not listed among the original 46 changed paths | Retain explicit actor snapshots/subscriptions and owned-actor disposal. |
| `packages/adapters/src/dom/jquery.ts` | `jquery-dom-api.js` | Retain an opt-in DOM adapter with synchronous commit, fixed-root ownership and conformance tests. |
| `packages/adapters/src/dom/lit-html.ts` | Not listed among the original 46 changed paths | Retain an opt-in DOM adapter with synchronous commit, fixed-root ownership and conformance tests. |
| `packages/adapters/src/dom/morphdom.ts` | Not listed among the original 46 changed paths | Retain an opt-in DOM adapter with synchronous commit, fixed-root ownership and conformance tests. |
| `packages/data/src/api.ts` | Not listed among the original 46 changed paths | Retain native package integration through public DataApi/StateApi protocols. |
| `packages/data/src/collection.ts` | Not listed among the original 46 changed paths | Retain native ordered collection/index ownership; #465 accounts for instance/ID/cid precedence and bounded bulk removal. |
| `packages/data/src/index.ts` | Not listed among the original 46 changed paths | Retain explicit public package exports; isolates optional dependencies and produces declarations. |
| `packages/data/src/model.ts` | Not listed among the original 46 changed paths | Retain native model events and identity; #465 preserves native subclasses. |
| `packages/radio/src/debug.ts` | `modules/common/radio.js` | Retain default and isolated debug closures so hooks and warning configuration follow their owning Radio. |
| `packages/radio/src/index.ts` | Not listed among the original 46 changed paths | Retain explicit public package exports; isolates optional dependencies and produces declarations. |
| `packages/radio/src/radio.ts` | `modules/radio.js` | Retain the separately published implementation, default singleton and isolated Radio factories. Current Channel constructors and debug hooks support runtime isolation; see the Radio guide. |
| `packages/radio/src/requests.ts` | `mixins/requests.js` | Retain request/reply ownership and cleanup with the selected Radio’s debug context. |
| `packages/utils/src/bind-events.ts` | `modules/common/bind-events.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/bind-requests.ts` | `modules/common/bind-requests.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/build-event-args.ts` | `utils/build-event-args.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/call-handler.ts` | Not listed among the original 46 changed paths | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/error.ts` | `utils/error.js` | Retain the single native Error subclass with stable codes and platform stack fallback. |
| `packages/utils/src/events.ts` | `mixins/events.js` | Retain owned event/listening implementation; removes Backbone as a core dependency. |
| `packages/utils/src/extend.ts` | `utils/extend.js` | Retain established extend composition with own-property copying and declared constructor replacement. |
| `packages/utils/src/get-option.ts` | Not listed among the original 46 changed paths | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/get-value.ts` | `utils/get-value.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/index.ts` | Not listed among the original 46 changed paths | Retain explicit public package exports; isolates optional dependencies and produces declarations. |
| `packages/utils/src/is-string.ts` | `utils/is-string.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/merge-options.ts` | `modules/common/merge-options.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/normalize-methods.ts` | `modules/common/normalize-methods.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/once-wrap.ts` | `utils/once-wrap.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/set-property.ts` | Not listed among the original 46 changed paths | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/trigger-method.ts` | `modules/common/trigger-method.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `packages/utils/src/unique-id.ts` | `utils/unique-id.js` | Retain the directly implemented shared helper and its documented input shape; removes Underscore and duplicate core implementations. |
| `src/create-marionette.ts` | Not listed among the original 46 changed paths | Retain isolated class/configuration construction; prevents one application changing another runtime. |
| `src/index.ts` | `index.js` | Retain explicit named package exports; no obsolete target-first root proxies. |
| `src/mixins/behaviors.ts` | `mixins/behaviors.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/common.ts` | `mixins/common.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/delegate-entity-events.ts` | `mixins/delegate-entity-events.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/destroy.ts` | `mixins/destroy.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/radio.ts` | `mixins/radio.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/state.ts` | Not listed among the original 46 changed paths | Retain explicit borrowed/owned state sources and disposal; no provider registry. |
| `src/mixins/template-render.ts` | `mixins/template-render.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/ui.ts` | `mixins/ui.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/view-events.ts` | `mixins/view-events.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/mixins/view.ts` | `mixins/view.js` | Retain fixed capability composition, public lifecycle order and successful subscription cleanup; no speculative synchronous recovery. |
| `src/modules/application.ts` | `modules/application.js` | Retain asynchronous readiness, cancellation and child ownership; #333 and #429 account for lifecycle and typing corrections. |
| `src/modules/behavior.ts` | `modules/behavior.js` | Retain borrowed host ownership and independent subscriptions; fixed roots supersede historical retargeting. Initialization correction belongs to #430. |
| `src/modules/child-view-container.ts` | `modules/child-view-container.js` | Retain documented child helpers, native iteration and exact identity indexes; removes Underscore while preserving evidenced vocabulary. |
| `src/modules/collection-view.ts` | `modules/collection-view.js` | Retain one reconciliation path and measured placement loop; #444–#454 account for ordering, cleanup and ordinary-path cost. |
| `src/modules/common/build-region.ts` | `modules/common/build-region.js` | Retain the actual shared Region factory implementation after source consolidation; the old forwarding-only implementation was removed in #335. |
| `src/modules/common/chainable-methods.ts` | Not listed among the original 46 changed paths | Retain shared fluent contract types; no per-instance resources. |
| `src/modules/common/monitor-view-events.ts` | `modules/common/monitor-view-events.js` | Retain shared lifecycle monitoring for owned children and actual document attachment; #336 narrows traversal to Arrays. |
| `src/modules/common/view.ts` | Not listed among the original 46 changed paths | Retain common View/CollectionView ownership contracts and types. |
| `src/modules/object.ts` | `modules/object.js` | Retain optional evented, destroyable owner; it does not replace plain application classes. |
| `src/modules/region.ts` | `modules/region.js` | Retain explicit ownership and releasable destroy listeners; #444–#453, #455 and #470 account for corrections. |
| `src/modules/view.ts` | `modules/view-region.js`, `mixins/regions.js`, `modules/view.js` | Retain fixed root construction and region capabilities in the owner; #402/#409 remove obsolete forwarding paths. |
| `src/runtime-id.ts` | Not listed among the original 46 changed paths | Retain private runtime identity for ownership checks; it is not an adapter or global registry. |
| `src/runtime/data-api.ts` | Not listed among the original 46 changed paths | Retain neutral static model/array reads and the explicit DataApi protocol. |
| `src/runtime/dom-api.ts` | `runtime/dom-api.js` | Retain native DOM operations and attachment checks; optional wrappers remain in adapter packages. |
| `src/runtime/event-delegator.ts` | `runtime/event-delegator.js` | Retain native delegated events including captured focus/blur; removes implicit Backbone/jQuery ownership. |
| `src/runtime/renderer.ts` | `runtime/renderer.js` | Retain synchronous render commit within a stable View root. |
| `src/runtime/state-api.ts` | Not listed among the original 46 changed paths | Retain state subscription/disposal protocol independent of domain data. |
| `src/utils/extend.ts` | Not listed among the original 46 changed paths | Retain Marionette-specific constructor inference on the shared extension implementation; no second runtime implementation. |
| `src/utils/subscribe-bindings.ts` | Not listed among the original 46 changed paths | Retain one subscription/release path for documented binding maps. |

## Removed historical paths

| Original path | Final disposition |
| --- | --- |
| `runtime/features.js` | Removed; the canonical root-attribute behavior and explicit runtime configuration replace the feature registry. |
| `utils/assign-in.js` | Removed; own-property composition replaces inherited copying. |
| `utils/each-own.js` | Removed; direct native traversal makes the supported input shape explicit. |
| `utils/deprecate.js` | Removed; pre-stable breaking changes are canonical rather than warning-backed aliases. |

## Superseded historical statements

The old comments describe an intermediate v5 tree. Radio’s implementation is now in `@mnjs/radio`; `marionette` still exports the default singleton, and `createMarionette()` supplies isolated Radio instances to its owners. The current [Radio](../radio.md) and [runtime isolation](../runtime-isolation.md) contracts supersede #338’s intermediate restriction of Channel constructors and debug hooks. The Backbone prototype shim and automatic Backbone.View lifecycle adaptation are gone; `@mnjs/adapters/backbone` now supplies data/state protocols. View roots stay fixed, so Behavior `_syncElement` and View `setElement` are not retained. The feature registry and compatibility aliases are removed. Stable behavioral diagnostics remain, while TypeScript expresses argument shapes. Historical references to failure-atomic registration do not authorize synchronous rollback: the [current failure boundary](../view.lifecycle.md#synchronous-failures) governs.

## Corrective work and validation evidence

- [#334](https://github.com/marionettejs/marionette/issues/334) through [#340](https://github.com/marionettejs/marionette/issues/340) own the initial API/helper/Radio/Region decisions and bounded polish.
- [#402](https://github.com/marionettejs/marionette/pull/402), [#409](https://github.com/marionettejs/marionette/pull/409), [#416](https://github.com/marionettejs/marionette/pull/416), [#429](https://github.com/marionettejs/marionette/pull/429), and [#430](https://github.com/marionettejs/marionette/pull/430) record source consolidation, naming/comments, typing, and Behavior initialization validation.
- The [September 8 closeout](https://github.com/marionettejs/marionette/issues/329#issuecomment-5577380939) links #444–#453 and their public ownership, focus, rendering and typing evidence. [#454](https://github.com/marionettejs/marionette/pull/454), [#455](https://github.com/marionettejs/marionette/pull/455), [#465](https://github.com/marionettejs/marionette/pull/465), and [#470](https://github.com/marionettejs/marionette/pull/470) account for subsequent performance, listener, native-data and test-hardening corrections.

The bounded authorship gate is satisfied when this reconciliation is merged: current paths are accounted for and no corrective item is outstanding. This is not a stable release certificate. [#147](https://github.com/marionettejs/marionette/issues/147) still owns validation and publication evidence for the exact future release commit and tarballs.
