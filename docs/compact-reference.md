# Compact framework reference

Generated from the reviewed public contract inventory by `npm run check:api-contracts -- --write`. Read this with the documentation shipped by the installed package. Source-only additions may be absent from an older installed artifact. The linked guides own complete examples and argument details.

## Choose an owner

Use plain functions or classes when you do not need Marionette lifecycle, events, or ownership. MnObject is an optional evented, destroyable convenience. Application owns feature readiness and coordination such as feed loading, pagination/retry, and route activation; Views render supplied data and emit intent. See the [complete feature](./application-composition.md#a-complete-paginated-feature). Application is never a Region-renderable object.

| Owner | Ownership | Guide |
| --- | --- | --- |
| MnObject | Supplied state is borrowed; createState results are owned. Radio bindings belong to the owner. | [Instantiating a MnObject](./marionette.mnobject.md#instantiating-a-mnobject) |
| View | View owns its Regions and Behaviors, and owns only factory-created state. A Region or CollectionView can own the View. | [Method results and side effects](./marionette.view.md#method-results-and-side-effects) |
| Region | show adopts a View; detach releases ownership without destroying it; empty/replacement destroy the current View. | [Lifecycle transition contract](./marionette.region.md#lifecycle-transition-contract) |
| CollectionView | Managed children belong to the CollectionView; stable unchanged model sources preserve child identity; same-key replacement recreates a child. | [Managing Children](./marionette.collectionview.md#managing-children) |
| Behavior | Host owns top-level and nested Behaviors; direct Behavior destruction does not destroy its host. | [Behavior Lifecycle](./marionette.behavior.md#behavior-lifecycle) |
| Application | Named children belong to the Application until removal. setView temporarily owns a prepared View; showView hands it to the Region and records the Application's selected displayed root. A direct Region display is not adopted or claimable; an Application may reselect its own displayed root. | [Application Lifecycle](./marionette.application.md#application-lifecycle) |

## Lifecycle and cancellation

### Synchronous failures

- **Outcome:** A synchronous callback/adapter exception escapes; no successful result or rollback is promised.

Read [Synchronous failures](./view.lifecycle.md#synchronous-failures).

### Application start, stop, restart, and destroy

- **Results:** Operations resolve true at the requested target, false when superseded, and compatible calls share in-flight promises. Current readiness failure rejects the operation promise.

- **Timing:** Before and completion notifications are synchronous and ignore returns. Only prepareStart/prepareStop/prepareDestroy are awaited with options and an abort context; start completion receives one resolved preparation result. Supersession aborts before replacement preparation; adopted stop retains its original context/options without abort. Startup Region binding occurs before startup notifications, after any adopted stop readiness finishes. isRunning and configured stateEvents follow activation: false during startup preparation, true immediately before start notification through pending ordinary stop/restart permission, and false before root teardown or immediately when terminal destruction begins. Suppressed state events are not replayed.

- **Cleanup:** Destruction blocks owner and descendant start/restart; successful destruction destroys owned children. Readiness rejection preserves the documented retry and partial-child boundaries.

Read [Application Lifecycle](./marionette.application.md#application-lifecycle).

### Application children and root Views

- **Results:** Construction, addChildApp, setView and showView(view) return their public instance; showView() returns the prepared or selected displayed View, or undefined; repeated showView() on the selected displayed root is a no-op; removeChildApp returns a Promise of the removed child or undefined; queries return the declared state or optional owner member.

- **Timing:** Construction, registration, root preparation/display and queries are synchronous; removeChildApp awaits child destruction before releasing ownership. childApps resolves a map or function once and registers fresh no-argument children before initialize; declarations do not activate children. Parent restart retains registered instances without reconstructing or automatically reactivating them; start selected children explicitly.

- **Cleanup:** Stop destroys a prepared View and empties the host only when its selected displayed View is still current, or when a directly shown View occupies an Application-created Region. Destroy also tears down owned children and a constructed root Region; it preserves unrelated content in a borrowed Region. Direct destruction releases preparation; displayed View associations end on Region replacement, empty, or detachment.

Read [Application Lifecycle](./marionette.application.md#application-lifecycle).

Application readiness cancellation prevents stale framework completion. Application code must also respect the readiness signal before committing its own asynchronous side effects. Completion hooks are synchronous notifications. Use the [routing recipe](./routing.md) for cooperative cancellation and late-result checks.

## Rendering, lookup, and child identity

### View.render

- **Effects:** render replaces template contents and refreshes UI bindings; renderAttributes explicitly refreshes root attributes. Named Region lookup does not render; getChildView renders an unrendered parent before reading its child.

- **Repeated calls:** render may repeat while live; rendering after destruction is a no-op.

Read [Method results and side effects](./marionette.view.md#method-results-and-side-effects).

### View Region lookup and child operations

- **Effects:** hasRegion/getRegion/getRegions inspect registrations without rendering. getChildView/showChildView/detachChildView and emptyRegions render an unrendered parent first; removal destroys the Region.

- **Repeated calls:** Region registration reads are side-effect free; child operations skip parent rendering once it is rendered and retain their own show/detach effects.

Read [Method results and side effects](./marionette.view.md#method-results-and-side-effects).

### CollectionView structural updates and render

- **Effects:** Structural updates add/remove affected children and reorder survivor elements; reset destructively replaces the list. Filters affect presentation.

- **Repeated calls:** Explicit live render destroys all existing children and reconstructs collection-derived children; structural source updates reconcile survivors without an explicit render. Comparator ties preserve documented order.

Read [Managing Children](./marionette.collectionview.md#managing-children).

### CollectionView manual children

- **Effects:** Manual child order is preserved during managed replacement; swap moves existing child elements and keeps identity.

- **Repeated calls:** Swapping a child with itself leaves it in place; ownership conflicts are rejected before adoption.

Read [Self-Managed `children`](./marionette.collectionview.md#self-managed-children).

### View.renderAttributes

- **Effects:** Applies current root attributes without rendering templates, emitting render lifecycle, rebinding composition or changing child identity.

- **Repeated calls:** Operates on the current configuration; repeated reads are side-effect free.

Read [Refreshing Root Attributes](./marionette.view.md#refreshing-root-attributes).

## State sources and domain data

StateApi governs an owner’s state-source observation and disposal. DataApi governs model reads, serialization, ordered collection snapshots, and structural observation. Configure each capability explicitly before constructing its consumers. `getState()` returns the exact source; call that source’s own mutation API.

### Plain objects and arrays

- **Behavior:** Plain objects and array snapshots remain exact borrowed sources; array order is read on explicit render.

- **Ownership:** Destroying a consumer does not dispose borrowed models or arrays.

- **Cleanup:** Consumer destruction releases its Views without mutating the source.

Read [Adapter contract](./data.api.md#adapter-contract).

### @mnjs/data

- **Behavior:** Native Model identity survives key/id changes and reorder; Collection structural mutations notify all live consumers.

- **Ownership:** Supplied data/state sources are borrowed; factory-created state is disposed through StateApi.

- **Cleanup:** Removed consumers receive no later render notification; owned state subscriptions are released before disposal.

Read [Optional `@mnjs/data` sources](./data.api.md#optional-mnjsdata-sources).

### Backbone

- **Behavior:** Backbone models retain reference identity; Backbone event names and callback arguments remain native.

- **Ownership:** Backbone sources remain borrowed for data consumers; StateApi disposal releases subscriptions without calling Model.destroy.

- **Cleanup:** Survivors continue rendering after another consumer is destroyed; borrowed source remains usable.

Read [Backbone](../packages/adapters/readme.md#backbone).

### XState actors

- **Behavior:** Actor reference is model identity; selection returns ordered distinct stable actor references. A respawned actor with the same id has new identity.

- **Ownership:** Borrowed actors stay active after consumer destruction; only factory-owned state actors stop.

- **Cleanup:** Owned actor subscriptions release before actor.stop; data consumers do not stop borrowed actors.

Read [XState actors](./data.api.md#xstate-actors).

### Custom providers

- **Behavior:** Custom provider state/data retains opaque source identity and provider-owned event vocabulary.

- **Ownership:** Multiple owners may borrow a state source; factory state alone is owned.

- **Cleanup:** Successful cleanup removes externally tracked subscriptions and precedes owned-source disposal; synchronous failures abort without rollback or attempt-all cleanup.

Read [Adapter contract](./data.api.md#adapter-contract).

## Events, communication, and cleanup

### DOM events and delegateTarget

- **Result:** Returns the View. With the default native EventDelegator, event.delegateTarget is the matched selector element, event.currentTarget is the listener host (the View root), and event.target is the originating node. Use delegateTarget to read the matched control.

- **Ownership:** Does not transfer ownership; the owner keeps its existing composition.

Read [EventDelegator Adapter](./dom.interactions.md#eventdelegator-adapter).

### Events subscriptions

- **Result:** on/off/once/listenTo/listenToOnce/stopListening/trigger return their receiver; triggerMethod has its own result contract.

- **Ownership:** listenTo subscriptions belong to the listener; off removes source registrations.

Read [Events API](./events.md#events-api).

### triggerMethod

- **Result:** Returns the matching onEventName method result; undefined when absent. triggerMethod("item:select") calls onItemSelect before emitting item:select. Calling it again from onItemSelect recurses; forward with a distinct event name, or use trigger for listener-only emission.

- **Ownership:** No ownership transfer.

Read [`triggerMethod`](./events.md#triggermethod).

### Radio channels

- **Result:** channel returns a named channel; direct Channel construction is independent; messaging forwards Events/Requests results.

- **Ownership:** Each Radio registry owns its channel references; owner bindings are scoped by context.

Read [Channel Lifecycle](./radio.md#channel-lifecycle).

### Radio requests

- **Result:** request returns the handler result, undefined when no applicable reply exists, or mapped results for request maps.

- **Ownership:** Replies use configured context; stopReplying supports selective removal.

Read [Requests and Replies](./radio.md#requests-and-replies).

Own external timers, DOM listeners, and widgets in the lifecycle that actually contains their use. Release render-scoped work before replacement and owner-scoped work on destruction. See [resource lifetimes](./view.lifecycle.md), [Behavior composition](./marionette.behavior.md), and [safe rendering](./security.md). No resource registry or extension-hook API is implied.

## Runtime imports and optional integrations

| Entrypoint | Runtime exports |
| --- | --- |
| `marionette` | `Application`, `Behavior`, `CollectionView`, `createMarionette`, `DataApi`, `DomApi`, `Events`, `extend`, `MarionetteError`, `MnObject`, `monitorViewEvents`, `Radio`, `Region`, `setDataApi`, `setDomApi`, `setEventDelegator`, `setRenderer`, `setStateApi`, `StateApi`, `VERSION`, `View` |
| `@mnjs/utils` | `bindEvents`, `bindRequests`, `buildEventArgs`, `callHandler`, `Events`, `extend`, `getOption`, `getValue`, `isString`, `MarionetteError`, `mergeOptions`, `normalizeBindings`, `normalizeMethods`, `onceWrap`, `resolveMethod`, `setProperty`, `triggerMethod`, `unbindEvents`, `unbindRequests`, `uniqueId` |
| `@mnjs/radio` | `Channel`, `createRadio`, `Radio`, `Requests` |
| `@mnjs/data` | `Collection`, `DataApi`, `Model`, `StateApi`, `triggerMethod` |
| `@mnjs/adapters/backbone` | `default` |
| `@mnjs/adapters/dom/jquery` | `default` |
| `@mnjs/adapters/xstate` | `default` |
| `@mnjs/adapters/dom/morphdom` | `default` |
| `@mnjs/adapters/dom/lit-html` | `default` |

Runtime configuration and Radio channels are isolated; class setters affect that class and descendants. Configure before constructing or registering consumers; new event registrations use current adapters and existing registrations retain their cleanup. [Configuration method contract](./runtime-isolation.md#configuration-method-contract).

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
| `MN0041` | application-region-conflict |

Use public return values, DOM state, child identity, events, and externally counted subscriptions to prove behavior. Test focus and editable state in a real browser; test cancellation with held readiness and late results. A generated contract record proves consistency, not behavior or agent effectiveness.

Canonical examples and counterexamples: [class choice](./classes.md), [integration choice](./choosing-integrations.md), [Region composition](./marionette.region.md), [state ownership](./marionette.state.md), [forms](./forms-and-accessibility.md), and [routing](./routing.md). The [consumer guide](./agents.md) explains the workflow; the [API index](./public-api.md) locates detailed references.
