# API reference

These references target **5.0.0-rc.2**. Use the page for the class or contract you need. The reference is being rebuilt. Partial and missing coverage is identified below.

## Core classes

| Class | Reference scope |
| --- | --- |
| [View](api/view.md) | Construction, rendering, UI bindings, named Regions, lifecycle, ownership, and extension points. |
| [Region](api/region.md) | Showing, replacing, detaching and emptying Views; element configuration and lifecycle. |
| [Application](api/application.md) | Preparation, lifecycle results/cancellation, restart, child Applications, root ownership, state and Radio bindings. |
| [CollectionView](api/collection-view.md) | Collection observation, sorting/filtering, empty presentation, child lookup/ownership, rendering and lifecycle. |
| [Behavior](api/behavior.md) | Host composition, reusable local interaction, UI/data bindings, forwarded events, and teardown. |
| [MnObject](api/mnobject.md) | Nonvisual objects, construction, state/Radio bindings, and synchronous destruction. |

## Shared class contracts

These behaviors apply across several classes. Class pages link to the relevant contracts.

- [Common class methods](api/shared/common.md): construction, extension, options and binding helpers.
- [Events](api/shared/events.md): subscription methods, notification arguments and cleanup.
- [State](api/shared/state.md): creating, borrowing, observing and disposing state.
- [Rendering and View bindings](api/shared/view-bindings.md): templates, UI, DOM/entity events and child event forwarding shared by View and CollectionView.

## Runtime configuration

[Runtime configuration](api/runtime.md) covers defaults, configuration scope, setters, and isolated class families.

## Provider interfaces

Use these contracts when implementing or adapting an integration. For configuration with supplied packages, start with the [setup guide](integrations/setup.md).

- [Rendering and DOM providers](api/providers/dom.md): Renderer, DomApi, and EventDelegator authoring contracts.
- [Data and state providers](api/providers/data.md): reading, identity, collection notifications, subscriptions, and disposal.

## Companion packages

[@mnjs/data: Model and Collection](packages/data.md) is an optional observable data solution. Its reference covers operations, events, identity, disposal, and exported types. API access and persistence require a separate solution. Marionette can use another data layer through its core provider contracts.

[@mnjs/radio: channels and requests](packages/radio.md) covers channel registries, events, replies, cleanup, logging, and standalone use.

A standalone `@mnjs/utils` reference is forthcoming. Shared methods already documented above remain at their canonical locations.

## Integration guides and remaining coverage

[Renderer and data setup](integrations/setup.md) connects Lit and `@mnjs/data` to Marionette. Integration guides explain configuration and use; package references define the APIs supplied by each package.

Optional-adapter guides, errors and diagnostics guidance, consumer lint, and the complete TypeScript guide are forthcoming. Class pages link to the relevant [shared configuration contracts](api/shared/view-bindings.md#class-configuration); Region documents its own DOM setter.

For a first runnable result, use the [quick start](quick-start.md). For composition guidance, see [architecture](architecture.md).
