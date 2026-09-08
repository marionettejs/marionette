# Public API index

Use this index to identify the supported import and follow its behavior contract.
The `marionette` package has named exports; it has no default export. Import
optional integrations from their documented package subpaths, never from `src/`
or generated internal files.

## Core runtime exports

| Export | Purpose and reference |
| --- | --- |
| `View` | [Render and own one part of the interface](./marionette.view.md). |
| `CollectionView` | [Own ordered child Views](./marionette.collectionview.md). |
| `Region` | [Show, replace, detach, or destroy a current View](./marionette.region.md). |
| `Application` | [Coordinate asynchronous feature lifecycle and child Applications](./marionette.application.md). |
| `Behavior` | [Share host View interactions and lifecycle](./marionette.behavior.md). |
| `MnObject` | [Own nonvisual events, State, and synchronous cleanup](./marionette.mnobject.md). |
| `Events` | [Compose the event/listening contract](./events.md#events-api). |
| `Radio` | [Use the default runtime's named message channels](./radio.md). |
| `DataApi`, `setDataApi` | [Read and observe the selected data source](./data.api.md). |
| `StateApi`, `setStateApi` | [Observe State and dispose owned sources](./marionette.state.md). |
| `DomApi`, `setDomApi` | [Create, query, attach, and update DOM](./dom.api.md). |
| `setRenderer` | [Configure synchronous template evaluation](./view.rendering.md#using-a-custom-renderer). |
| `setEventDelegator` | [Configure DOM event registration and cleanup](./dom.interactions.md#eventdelegator-adapter). |
| `createMarionette` | [Create independent classes, configuration, and Radio](./runtime-isolation.md). |
| `monitorViewEvents` | [Bridge lifecycle notifications for supported custom Views](#monitorvieweventsview). |
| `extend` | [Extend a function constructor](./utils.md#extend). |
| `MarionetteError` | [Inspect a framework invariant failure](./diagnostic-catalog.md). |
| `VERSION` | [Read the package version](./utils.md#version). |

[Configuration method contracts](./runtime-isolation.md#configuration-method-contract)
identify which classes each setter affects, its return value, and its scope.
Choosing one provider does not configure the other providers.

## `monitorViewEvents(view)`

This synchronous helper installs lifecycle listeners on a supported custom View
and returns `undefined`. It propagates attachment and detachment notifications
to managed children and derives `dom:refresh`/`dom:remove` from render and
attachment state. Repeating the call does not install duplicate monitoring;
`monitorViewEvents: false` skips installation.

Marionette Views are monitored automatically. This helper is for integrations
that implement the [supported View lifecycle](./marionette.region.md#wrapping-a-non-marionette-view),
including event methods and managed-child access. It is not a MutationObserver:
appending arbitrary DOM does not notify it. Prefer a Marionette wrapper View
for third-party widgets so ownership and cleanup remain explicit.

## Companion packages

| Import | Public surface | Reference |
| --- | --- | --- |
| `@marionette/data` | `Model`, `Collection`, `DataApi`, `StateApi`, `triggerMethod` | [Native observable data](../packages/data/readme.md) |
| `@marionette/radio` | `Radio`, `createRadio`, `Channel`, `Requests` | [Standalone Radio](../packages/radio/readme.md) |
| `@marionette/utils` | Shared events, bindings, option, inheritance, and event-building helpers | [Utility exports](../packages/utils/readme.md) |
| `@marionette/adapters/backbone` | Default Backbone data/State adapter | [Backbone integration](./optional-backbone.md) |
| `@marionette/adapters/xstate` | Default `createXStateActorApi` factory | [XState integration](./data.api.md#xstate-actors) |
| `@marionette/adapters/dom/jquery` | Default jQuery DomApi | [jQuery DOM](./dom.api.md#optional-jquery-adapter) |
| `@marionette/adapters/dom/morphdom` | Default Morphdom DomApi | [DOM update adapters](./view.rendering.md#rendering-to-dom) |
| `@marionette/adapters/dom/lit-html` | Default Lit DomApi | [DOM update adapters](./view.rendering.md#rendering-to-dom) |

Add a companion package as a direct dependency when application code imports it.
Match Marionette package versions during alpha. Optional integrations need only
their selected peers; see [Choosing integrations](./choosing-integrations.md).

## TypeScript exports

Core also exports types for class instances and constructors, class configuration,
Region definitions and show options, Application readiness context, DOM events
and triggers, UI bindings, Behavior definitions, event and request contracts, and
provider contracts (`DataApiContract`, `DomApiContract`, `StateApiContract`,
`EventDelegator`, and `Renderer`). Use `import type` for these names. They do not
create runtime values or install a provider.

The package's declarations are the exact signature reference. Keep inferred
subclass types when possible rather than annotating an extended View as the broad
base instance type and losing its application-specific methods.
