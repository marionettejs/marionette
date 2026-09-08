# Public reference audit

This audit connects the public package surface to its documentation and executable
evidence. It is a coverage map for maintenance, not a claim that every sentence,
external demo, browser, or provider combination has been independently verified.
The generated documentation manifest identifies the source revision and local
changes represented by this map.

## Review scope

The review compared `src/index.ts`, class instance declarations and runtime
implementations, runtime setter implementations, and companion-package exports
with current reference pages. It concentrated on decisions that can change an
agent's implementation: imports, provider scope, constructor options, return
values, rendering side effects, ownership, asynchronous boundaries, and lookup
identity. The [consumer API index](../public-api.md) is the entry point for users.

## Core exports and evidence

Every core runtime export is listed below. Test paths identify existing evidence;
check the recorded validation section for which suites ran during this pass.

| Public symbols or contract | Canonical reference | Implementation and executable evidence |
| --- | --- | --- |
| `View` construction, rendering, attributes, Regions and child helpers | [View](../marionette.view.md), [rendering](../view.rendering.md), [DOM interactions](../dom.interactions.md) | `src/modules/view.ts`, `src/mixins/view.ts`; `test/unit/view-region-diagnostics.spec.js`, `view-get-region.spec.js`, `view-get-regions.spec.js`; `test/fixtures/docs-view-child-region`, `test/fixtures/docs-view-render-attributes` |
| `CollectionView` construction, child ownership, ordering, filtering and identity | [CollectionView](../marionette.collectionview.md), [DataApi](../data.api.md) | `src/modules/collection-view.ts`, `src/modules/child-view-container.ts`; `test/unit/collection-view/`, `test/unit/child-view-container.spec.js`; `test/fixtures/docs-collectionview-child-ownership` |
| `Region` showing, replacing, detaching, resetting and destruction | [Region](../marionette.region.md) | `src/modules/region.ts`; `test/unit/region-lifecycle.spec.js`, `region-el-validation.spec.js`; `test/fixtures/docs-region-lifecycle`, `docs-prerendered-content` |
| `Application` readiness, transitions, child ownership and root View | [Application](../marionette.application.md) | `src/modules/application.ts`; `test/unit/application.spec.js`, `application-root-view.spec.js`, `application-lifecycle.spec.js`, `application-child-lifecycle.spec.js`; `test/fixtures/docs-routing`, `docs-application-state` |
| `Behavior` host, UI, event proxies and destruction | [Behavior](../marionette.behavior.md) | `src/modules/behavior.ts`, `src/mixins/behaviors.ts`; `test/fixtures/docs-behavior-host` |
| `MnObject` initialization, Radio, State and synchronous destruction | [MnObject](../marionette.mnobject.md), [common methods](../common.md) | `src/modules/object.ts`, `src/mixins/destroy.ts`; `test/unit/object-application-composition.spec.js`; `test/fixtures/docs-radio-owner` |
| `Events` | [Events](../events.md), [common binding helpers](../common.md) | `packages/utils/src/events.ts`; `test/unit/radio-parity.spec.js` exercises channel event/listening interoperability |
| `Radio` | [Radio](../radio.md) | `packages/radio/src/`; `test/unit/radio-public.spec.js`, `radio-parity.spec.js`, `radio-composition.spec.js`; `test/fixtures/docs-radio-owner` |
| `DataApi`, `setDataApi` | [DataApi](../data.api.md), [configuration scope](../runtime-isolation.md#configuration-method-contract) | `src/runtime/data-api.ts`, `src/create-marionette.ts`; `test/unit/runtime/data-api.spec.js`, `create-marionette.spec.js` |
| `StateApi`, `setStateApi` | [State](../marionette.state.md), [configuration scope](../runtime-isolation.md#configuration-method-contract) | `src/runtime/state-api.ts`, `src/mixins/state.ts`; `test/unit/runtime/state-api.spec.js`, `application-state.spec.js`; `test/fixtures/docs-application-state` |
| `DomApi`, `setDomApi` | [DomApi](../dom.api.md) | `src/runtime/dom-api.ts`, `src/create-marionette.ts`; `test/unit/runtime/dom-api.spec.js`, `create-marionette.spec.js` |
| `setRenderer` | [Renderer](../view.rendering.md#using-a-custom-renderer) | `src/runtime/renderer.ts`, `src/mixins/template-render.ts`; `test/unit/runtime/renderer.spec.js`, `view.renderer.spec.js` |
| `setEventDelegator` | [EventDelegator](../dom.interactions.md#eventdelegator-adapter) | `src/runtime/event-delegator.ts`, `src/mixins/view-events.ts`; `test/unit/runtime/event-delegator.spec.js`; `test/browser/event-delegator-focus.mjs` |
| `createMarionette` | [Runtime isolation](../runtime-isolation.md) | `src/create-marionette.ts`; `test/unit/create-marionette.spec.js` |
| `monitorViewEvents` | [Public helper contract](../public-api.md#monitorvieweventsview), [View lifecycle](../view.lifecycle.md) | `src/modules/common/monitor-view-events.ts`; `test/unit/common/monitor-view-events.spec.js` |
| `extend`, `VERSION` | [Utilities](../utils.md) | `src/utils/extend.ts`, generated `src/version.js`; `test/fixtures/docs-utils-contract` |
| `MarionetteError` | [Diagnostics](../diagnostic-catalog.md) | `packages/utils/src/error.ts`, `config/diagnostics/catalog.json`; `test/unit/view-region-diagnostics.spec.js`, `scripts/diagnostics/check-catalog.mjs` |

## Companion packages and type surface

| Package surface | Reference | Evidence boundary |
| --- | --- | --- |
| `@mnjs/data`: `Model`, `Collection`, `DataApi`, `StateApi`, `triggerMethod` | [Data package](../../packages/data/readme.md) | `packages/data/src/index.ts` and runtime classes; packed CJS/ESM, Vite, browser, and type fixtures under `test/fixtures/data-package-*` |
| `@mnjs/radio`: `Radio`, `createRadio`, `Channel`, `Requests` | [Radio package](../../packages/radio/readme.md), [Radio](../radio.md) | `packages/radio/src/index.ts`; public/parity/composition suites |
| `@mnjs/utils`: events, bindings, options, inheritance, property and event-building helpers | [Utilities package](../../packages/utils/readme.md), [common methods](../common.md) | `packages/utils/src/index.ts`; lower-level event-building helpers have concise package descriptions rather than a separate tutorial per helper |
| `@mnjs/adapters/backbone` | [Optional Backbone](../optional-backbone.md) | `packages/adapters/package.json`, `src/data/backbone.ts`; adapter-first and Backbone-first CJS/ESM fixtures |
| `@mnjs/adapters/xstate` | [XState DataApi](../data.api.md#xstate-actors) and [adapter package](../../packages/adapters/readme.md) | `packages/adapters/src/data/xstate.ts`; `test/unit/xstate-adapter.spec.js`, package type fixtures |
| jQuery, Morphdom, Lit subpaths | [DomApi](../dom.api.md), [rendering](../view.rendering.md#rendering-to-dom), [adapter package](../../packages/adapters/readme.md) | `packages/adapters/package.json`; `test/fixtures/jquery-dom-api`, `dom-adapters-package`; real-browser adapter tests |
| Core and companion type-only exports | Package declarations; [maintaining declarations](./types.md) | `src/index.ts` and companion indexes; `test/types/` and packed ESM/CJS/legacy-resolution type fixtures. A passing type check does not establish runtime behavior. |

## Corrections made in this pass

- Fixed the Application `regionClass` example to instantiate its configured
  subclass. Clarified that showing a View is synchronous, does not start the
  Application, and returns the supplied View even when adoption is skipped.
- Corrected Region constructor coverage to include `parentEl` and
  `allowMissingEl`, with deferred selector resolution and per-show overrides.
- Added missing `stateEvents` options for View and CollectionView. Removed the
  statement that CollectionView inherits from itself or View's named Regions.
- Added View method results and rendering/ownership side effects, including
  `getChildView()` rendering an unrendered parent and named-Region diagnostics.
- Documented keyed child lookup, exact membership, missing indexes, iterable
  presentation order, and the difference between filtered membership and ownership.
- Documented Radio's synchronous failures, Promise passthrough, default reply
  arguments, replacement semantics, and removal before a one-time reply executes.
- Documented runtime/class configuration scope, setter return values, and the
  absence of implicit reset behavior. Clarified synchronous renderer output and
  corrected a literal dotted `className` example.
- Added the consumer public API index, including the previously hard-to-discover
  `monitorViewEvents` export and supported companion import paths.

## Validation and remaining limits

The following focused source run passed **11 suites and 232 tests** on 2026-09-08:

```sh
npx vitest run test/unit/application.spec.js test/unit/application-root-view.spec.js test/unit/view-region-diagnostics.spec.js test/unit/view-get-region.spec.js test/unit/view-get-regions.spec.js test/unit/child-view-container.spec.js test/unit/radio-public.spec.js test/unit/radio-parity.spec.js test/unit/create-marionette.spec.js test/unit/common/monitor-view-events.spec.js test/unit/runtime/renderer.spec.js --reporter=dot
```

This run covers Application, Region lookup, child-container, Radio, runtime
configuration, monitoring, and renderer contracts. Separate link and
executable-marker checks validate documentation structure; they do not execute
every example. Do not treat this recorded run as a replacement for rerunning
relevant checks after later code changes.

The complete reference application is deferred by product decision. Small
examples and task fixtures establish individual patterns, while cross-feature
composition and a continuous beginner learning path remain separate validation.
External JSFiddle examples are illustrative until their versions and behavior are
checked. No reading trial or source audit establishes comparative agent success
rates, production accessibility, performance, or third-party service reliability.

When a runtime export, public instance method, provider capability, or type-only
export changes, update the corresponding canonical page and this map in the same
change. Add executable evidence for behavior that would change an implementation
decision; avoid tests that only reproduce the wording of a table.
