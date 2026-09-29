# Shared reference member audit

Audited 2026-09-29 against current source and declarations for the View/Region reference slice. This covers the inherited common/event APIs and state-owner contract. It does not certify the standalone utility/Radio/provider export surface as complete. Source and tests supplied contracts; no retired documentation was read.

## Member dispositions

| Candidate surface | Disposition and canonical documentation | Source / contract evidence |
| --- | --- | --- |
| Static `extend(prototypeProperties?, staticProperties?)`; child `prototype`, `constructor`, `__super__` | Documented in [class definition](../../../docs/api/common.md#define-a-class). Includes shared object defaults, parent invocation and shallow overriding. `__super__` is retained in the public account despite its underscores because the runtime intentionally exposes it and the constructor declarations declare it. | [extend implementation and types](../../../packages/utils/src/extend.ts); [core constructor typing](../../../src/utils/extend.ts); `test/unit/utils/extend.spec.js`. |
| `options`, `initialize`; applicable `preinitialize` | Documented in [options and initialization](../../../docs/api/common.md#options-and-initialization). Per-class construction ordering remains on class pages; only Application, View and CollectionView call preinitialize. | [CommonMixin](../../../src/mixins/common.ts); constructors in `src/modules/{application,view,collection-view,region,behavior,object}.ts`; `test/unit/mixins/common.spec.js`. |
| `getOption` | Documented with option precedence, function-value preservation and return in [common table](../../../docs/api/common.md#options-and-initialization). | `packages/utils/src/get-option.ts`; `test/unit/common/get-option.spec.js`. |
| `mergeOptions` | Documented with own enumerable string keys, undefined skipping, nullish input and void return in [common table](../../../docs/api/common.md#options-and-initialization). | `packages/utils/src/merge-options.ts`; `test/unit/common/merge-options.spec.js`. |
| `normalizeMethods` | Documented with new-map return, method resolution, no binding, and missing-handler diagnostic in [common table](../../../docs/api/common.md#options-and-initialization). | `packages/utils/src/normalize-methods.ts`; `test/unit/common/normalize-methods.spec.js`. |
| `bindEvents`, `unbindEvents` | Documented with receiver return, literal names, method-name support, owner-scoped removal and protected-key diagnostic in [binding helpers](../../../docs/api/common.md#binding-helpers). | `packages/utils/src/bind-events.ts`; `test/unit/common/bind-events.spec.js`; `test/unit/events-literal-names.spec.js`. |
| `bindRequests`, `unbindRequests` | Documented with receiver return, channel/context calls, owner-scoped removal and explicit reply cleanup in [binding helpers](../../../docs/api/common.md#binding-helpers). Full Radio semantics remain pending separately. | `packages/utils/src/bind-requests.ts`; `test/unit/common/bind-request.spec.js`; no request tracking exists in these helpers. |
| `on`, `once`, `off` | Documented with name/map overloads, contexts, matching removal, once behavior and receiver return in [Events](../../../docs/api/events.md#subscribe-and-unsubscribe). | [Events implementation and declarations](../../../packages/utils/src/events.ts); `test/unit/events-parity.spec.js`, `events-literal-names.spec.js`, `events-iteration.spec.js`. |
| `listenTo`, `listenToOnce`, `stopListening` | Documented with source compatibility, map overloads, listener context, selective removal and receiver return in [Events](../../../docs/api/events.md#subscribe-and-unsubscribe). Native/external destruction boundary covered in [cleanup](../../../docs/api/events.md#cleanup). | Same Events source; `test/unit/events-iteration.spec.js`, `events-literal-names.spec.js`, `destroy-listener-cleanup.spec.js`. |
| `trigger`, `triggerMethod`, special `all` event | Documented with literal names, exact payloads, hook lookup/order, return values, synchronous exceptions and Promise behavior in [event triggering](../../../docs/api/events.md#trigger-events-and-hooks). | `packages/utils/src/{events,trigger-method,build-event-args}.ts`; `test/unit/events-single-dispatch.spec.js`, `common/trigger-method.spec.js`. |
| `state`, `createState(options)`, `getState`, `stateEvents` | Documented in [State](../../../docs/api/state.md). Includes source selection, lazy creation, source-specific payloads, binding timing, per-owner delivery, borrowed/owned disposal and restart retention. | [state mixin](../../../src/mixins/state.ts); [binding adapter](../../../src/utils/subscribe-bindings.ts); `test/unit/state-owner.spec.js`, `application-state.spec.js`, `application-state-events.spec.js`, `utils/subscribe-bindings.spec.js`. |
| Instance/prototype `State`, static `setStateApi`; global/runtime setters | Documented for owner consumption/configuration in [State configuration](../../../docs/api/state.md#configure-the-stateapi). Full provider-authoring reference remains partial by slice boundary. | [StateApi](../../../src/runtime/state-api.ts); `src/create-marionette.ts`; `test/unit/runtime/state-api.spec.js`, `state-owner.spec.js`. |
| Shared `isDestroyed` / `destroy` | Class-owned lifecycle contract; View/Region pages document their supported calls, hooks, arguments and returns. Shared incoming/outgoing event consequences documented in Events. | `src/mixins/destroy.ts`, `src/mixins/view.ts`, `src/modules/{application,region,behavior}.ts`; `test/unit/destroy-listener-cleanup.spec.js`. |
| `_setOptions`; Events `_rdEvents`, `_rdListeningTo`, `_rdListeners`, `_rdListenId`; state `_initState`, `_initStateEvents`, `_destroyState`, `_state`, `_stateOptions`, `_ownsState`, `_stateReleased`, `_stateEventCleanup` | Internal. Constructor/mixin bookkeeping and cleanup implementation, not owner extension hooks. Internal TypeScript host interfaces make implementation composition possible; supported entry points are listed above. | `src/mixins/common.ts`, `packages/utils/src/events.ts`, `src/mixins/state.ts`. |
| Standalone `@mnjs/utils` helpers/types, complete Radio API, custom StateApi authoring | Partial/deferred by approved slice, not classified internal. Shared method contracts are reusable when those pages are authored. Export/type coverage remains visible in the framework inventory. | [coverage scope](../coverage.md#view-and-region-reference-slice). |

## Checks

Executed `npx vitest run` with these exact file arguments (16 files; **240 tests passed**):

```text
test/unit/common/get-option.spec.js
test/unit/common/merge-options.spec.js
test/unit/common/normalize-methods.spec.js
test/unit/common/bind-events.spec.js
test/unit/common/bind-request.spec.js
test/unit/common/trigger-method.spec.js
test/unit/mixins/common.spec.js
test/unit/utils/extend.spec.js
test/unit/events-literal-names.spec.js
test/unit/events-single-dispatch.spec.js
test/unit/events-iteration.spec.js
test/unit/events-parity.spec.js
test/unit/state-owner.spec.js
test/unit/application-state.spec.js
test/unit/application-state-events.spec.js
test/unit/runtime/state-api.spec.js
```

Also executed `npx vitest run test/unit/destroy-listener-cleanup.spec.js test/unit/utils/subscribe-bindings.spec.js`: **26 tests passed** across 2 files. Total for this shared-contract audit: **266 passing tests in 18 files**.

The three new JavaScript fences are standalone after installing the documented packages and providing the browser DOM. They do not need the records app, Lit, or global renderer configuration. Root-slice verification extracts and runs them against the candidate package and checks declaration use; that execution result is recorded separately from these source tests. No comparative reader trial or maintainership approval is implied by this audit.
