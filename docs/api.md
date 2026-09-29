# API reference

These references target **5.0.0-rc.2**. Use the page for the class or contract you need. The reference is being rebuilt. Partial and missing coverage is identified below.

## Classes

| Class | Reference scope |
| --- | --- |
| [View](api/view.md) | Construction, rendering, UI bindings, named Regions, lifecycle, ownership, and extension points. |
| [Region](api/region.md) | Showing, replacing, detaching and emptying Views; element configuration and lifecycle. |
| [Application](api/application.md) | Preparation, lifecycle results/cancellation, restart, child Applications, root ownership, state and Radio bindings. |
| [CollectionView](api/collection-view.md) | Collection observation, sorting/filtering, empty presentation, child lookup/ownership, rendering and lifecycle. |
| [Behavior](api/behavior.md) | Host composition, reusable local interaction, UI/data bindings, forwarded events, and teardown. |
| [MnObject](api/mnobject.md) | Nonvisual objects, construction, state/Radio bindings, and synchronous destruction. |

## Shared contracts

- [Common class methods](api/common.md): construction, extension, options and binding helpers.
- [Events](api/events.md): subscription methods, notification arguments and cleanup.
- [State](api/state.md): creating, borrowing, observing and disposing state.
- [Rendering and View bindings](api/view-runtime.md): templates, UI, DOM/entity events and child event forwarding shared by View and CollectionView.

- [Runtime configuration](api/runtime.md): defaults, configuration scope, isolated class families, and composition.
- [Rendering and DOM providers](api/dom-providers.md): Renderer, DomApi, and EventDelegator authoring contracts.
- [Data and state providers](api/data-providers.md): reading, identity, collection notifications, subscriptions, and disposal.

## Integrations and remaining coverage

[Renderer and data setup](setup.md) documents the Lit and `@mnjs/data` configuration used by the quick start. `@mnjs/data` is an incomplete observable layer; API access and persistence require a separate solution.

Full Radio channel/request coverage, standalone utilities, optional-adapter guides, companion-package references, consumer lint, and the complete TypeScript guide are forthcoming. Class pages link to the relevant [shared configuration contracts](api/view-runtime.md#class-configuration); Region documents its own DOM setter.

For a first runnable result, use the [quick start](quick-start.md). For composition guidance, see [architecture](architecture.md).
