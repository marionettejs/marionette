# Compact framework reference

Generated from the reviewed public contract inventory by `npm run check:api-contracts -- --write`. Read this with the documentation shipped by the installed package. Source-only additions may be absent from the published beta. The linked guides own complete examples and argument details.

## Choose an owner

Use plain functions or classes when you do not need Marionette lifecycle, events, or ownership. MnObject is an optional evented, destroyable convenience; Application adds an active asynchronous lifecycle. Application is never a Region-renderable object.

| Owner | Ownership | Guide |
| --- | --- | --- |
| MnObject | Supplied state is borrowed; createState results are owned. Radio bindings belong to the owner. | [Instantiating a MnObject](./marionette.mnobject.md) |
| View | View owns its Regions and Behaviors, and owns only factory-created state. A Region or CollectionView can own the View. | [Method results and side effects](./marionette.view.md) |
| Region | show adopts a View; detach releases ownership without destroying it; empty/replacement destroy the current View. | [Lifecycle transition contract](./marionette.region.md) |
| CollectionView | Managed children belong to the CollectionView; stable unchanged model sources preserve child identity; same-key replacement recreates a child. | [Managing Children](./marionette.collectionview.md) |
| Behavior | Host owns top-level and nested Behaviors; direct Behavior destruction does not destroy its host. | [Behavior Lifecycle](./marionette.behavior.md) |
| Application | Named children belong to the Application until removal; the configured Region owns its current View. | [Application Lifecycle](./marionette.application.md) |

## Lifecycle and cancellation

A synchronous callback/adapter exception escapes; no successful result or rollback is promised. Synchronous; callback or adapter exceptions abort the operation without rollback or attempt-all cleanup. Accepted idempotence guards remain; Application asynchronous cancellation is a distinct contract. [Synchronous failures](./view.lifecycle.md).

Operations resolve true at the requested target, false when superseded, and compatible calls share in-flight promises. Current readiness failure rejects the operation promise. Readiness is awaited; superseded signals abort before replacement readiness; adopted stop retains its original context/options without abort. Destruction blocks owner and descendant start/restart; successful destruction destroys owned children. Readiness rejection preserves the documented retry and partial-child boundaries. [Application Lifecycle](./marionette.application.md).

Construction and addChildApp/showView return their public instance; removeChildApp returns a Promise of the removed child or undefined; queries return the declared state or optional owner member. Construction, registration, root-view display and queries are synchronous; removeChildApp awaits child destruction before releasing ownership. Destroy tears down owned children and a constructed root Region; it empties but preserves a supplied borrowed Region. [Application Lifecycle](./marionette.application.md).

Application readiness cancellation prevents stale framework completion. Application code must also respect the readiness signal before committing its own asynchronous side effects. Completion hooks are synchronous notifications. Use the [routing recipe](./routing.md) for cooperative cancellation and late-result checks.

## Rendering, lookup, and child identity

render replaces template contents and refreshes UI bindings; renderAttributes explicitly refreshes root attributes. Named Region lookup does not render; getChildView renders an unrendered parent before reading its child. render may repeat while live; rendering after destruction is a no-op. [Method results and side effects](./marionette.view.md).

hasRegion/getRegion/getRegions inspect registrations without rendering. getChildView/showChildView/detachChildView and emptyRegions render an unrendered parent first; removal destroys the Region. Region registration reads are side-effect free; child operations skip parent rendering once it is rendered and retain their own show/detach effects. [Method results and side effects](./marionette.view.md).

Structural updates add/remove affected children and reorder survivor elements; reset destructively replaces the list. Filters affect presentation. Explicit live render destroys all existing children and reconstructs collection-derived children; structural source updates reconcile survivors without an explicit render. Comparator ties preserve documented order. [Managing Children](./marionette.collectionview.md).

Manual child order is preserved during managed replacement; swap moves existing child elements and keeps identity. Swapping a child with itself leaves it in place; ownership conflicts are rejected before adoption. [Self-Managed `children`](./marionette.collectionview.md).

Applies current root attributes without rendering templates, emitting render lifecycle, rebinding composition or changing child identity. Operates on the current configuration; repeated reads are side-effect free. [Refreshing Root Attributes](./marionette.view.md).

## State sources and domain data

StateApi governs an owner’s state-source observation and disposal. DataApi governs model reads, serialization, ordered collection snapshots, and structural observation. Configure each capability explicitly before constructing its consumers. `getState()` returns the exact source; call that source’s own mutation API.

Plain objects and array snapshots remain exact borrowed sources; array order is read on explicit render. Destroying a consumer does not dispose borrowed models or arrays. Consumer destruction releases its Views without mutating the source. [Adapter contract](./data.api.md).

Native Model identity survives key/id changes and reorder; Collection structural mutations notify all live consumers. Supplied data/state sources are borrowed; factory-created state is disposed through StateApi. Removed consumers receive no later render notification; owned state subscriptions are released before disposal. [Optional `@mnjs/data` sources](./data.api.md).

Backbone models retain reference identity; Backbone event names and callback arguments remain native. Backbone sources remain borrowed for data consumers; StateApi disposal releases subscriptions without calling Model.destroy. Survivors continue rendering after another consumer is destroyed; borrowed source remains usable. [Backbone](../packages/adapters/readme.md).

Actor reference is model identity; selection returns ordered distinct stable actor references. A respawned actor with the same id has new identity. Borrowed actors stay active after consumer destruction; only factory-owned state actors stop. Owned actor subscriptions release before actor.stop; data consumers do not stop borrowed actors. [XState actors](./data.api.md).

Custom provider state/data retains opaque source identity and provider-owned event vocabulary. Multiple owners may borrow a state source; factory state alone is owned. Successful cleanup removes externally tracked subscriptions and precedes owned-source disposal; synchronous failures abort without rollback or attempt-all cleanup. [Adapter contract](./data.api.md).

## Events, communication, and cleanup

Returns the View. Does not transfer ownership; the owner keeps its existing composition. [EventDelegator Adapter](./dom.interactions.md).

on/off/once/listenTo/listenToOnce/stopListening/trigger return their receiver; triggerMethod has its own result contract. listenTo subscriptions belong to the listener; off removes source registrations. [Events API](./events.md).

Returns the matching onEventName method result; undefined when absent. No ownership transfer. [`triggerMethod`](./events.md).

channel returns a named channel; direct Channel construction is independent; messaging forwards Events/Requests results. Each Radio registry owns its channel references; owner bindings are scoped by context. [Channel Lifecycle](./radio.md).

request returns the handler result, undefined when no applicable reply exists, or mapped results for request maps. Replies use configured context; stopReplying supports selective removal. [Requests and Replies](./radio.md).

Own external timers, DOM listeners, and widgets in the lifecycle that actually contains their use. Release render-scoped work before replacement and owner-scoped work on destruction. See [resource lifetimes](./view.lifecycle.md), [Behavior composition](./marionette.behavior.md), and [safe rendering](./security.md). No resource registry or extension-hook API is implied.

## Runtime imports and optional integrations

| Entrypoint | Runtime exports |
| --- | --- |
| `marionette` | `Application`, `Behavior`, `CollectionView`, `createMarionette`, `DataApi`, `DomApi`, `Events`, `extend`, `MarionetteError`, `MnObject`, `monitorViewEvents`, `Radio`, `Region`, `setDataApi`, `setDomApi`, `setEventDelegator`, `setRenderer`, `setStateApi`, `StateApi`, `VERSION`, `View` |
| `@mnjs/utils` | `bindEvents`, `bindRequests`, `buildEventArgs`, `callHandler`, `Events`, `eventSplitter`, `extend`, `getOption`, `getValue`, `isString`, `MarionetteError`, `mergeOptions`, `normalizeBindings`, `normalizeMethods`, `onceWrap`, `resolveMethod`, `setProperty`, `triggerMethod`, `unbindEvents`, `unbindRequests`, `uniqueId` |
| `@mnjs/radio` | `Channel`, `createRadio`, `Radio`, `Requests` |
| `@mnjs/data` | `Collection`, `DataApi`, `Model`, `StateApi`, `triggerMethod` |
| `@mnjs/adapters/backbone` | `default` |
| `@mnjs/adapters/dom/jquery` | `default` |
| `@mnjs/adapters/xstate` | `default` |
| `@mnjs/adapters/dom/morphdom` | `default` |
| `@mnjs/adapters/dom/lit-html` | `default` |

Runtime configuration and Radio channels are isolated; class setters affect that class and descendants. Configure before constructing or registering consumers; new event registrations use current adapters and existing registrations retain their cleanup. [Configuration method contract](./runtime-isolation.md).

Type-only exports live in the same package declarations. Core, utils, Radio, data, and adapters release together; keep their versions aligned. ESM is the canonical application path. See [installation](./installation.md), [TypeScript](./typescript.md), and the [migration procedure](../upgradeGuide.md).

Development tooling is separate: `marionette/eslint`. The [consumer lint guide](./consumer-lint.md) states availability and supported analysis. No validator, hierarchy inspector, or test-helper package is currently promised.

## Diagnostics and verification

Match a framework invariant by its stable diagnostic code, not message prose. The [diagnostic catalog](./diagnostic-catalog.md) defines the active codes and supported remedies.

| Code | Invariant |
| --- | --- |
| `MN0003` | view-already-owned |
| `MN0004` | region-el-required |
| `MN0005` | region-el-not-found |
| `MN0007` | region-view-destroyed |
| `MN0011` | collection-view-child-view-required |
| `MN0013` | collection-view-container-not-found |
| `MN0015` | collection-view-swap-non-children |
| `MN0017` | radio-channel-name-required |
| `MN0018` | ui-reference-invalid |
| `MN0019` | handler-not-callable |
| `MN0020` | named-region-not-found |
| `MN0021` | radio-channel-not-found |
| `MN0023` | ui-elements-unavailable |
| `MN0024` | child-container-argument-invalid |
| `MN0026` | entity-event-name-unsafe |
| `MN0030` | region-registration-conflict |
| `MN0031` | application-registration-conflict |
| `MN0032` | region-name-invalid |
| `MN0037` | adapter-observation-unsupported |
| `MN0039` | collection-data-contract-invalid |
| `MN0040` | private-framework-member-access |

Use public return values, DOM state, child identity, events, and externally counted subscriptions to prove behavior. Test focus and editable state in a real browser; test cancellation with held readiness and late results. A generated contract record proves consistency, not behavior or agent effectiveness.

Canonical examples and counterexamples: [class choice](./classes.md), [integration choice](./choosing-integrations.md), [Region composition](./marionette.region.md), [state ownership](./marionette.state.md), [forms](./forms-and-accessibility.md), and [routing](./routing.md). The [consumer guide](./agents.md) explains the workflow; the [API index](./public-api.md) locates detailed references.
