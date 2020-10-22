# Marionette Classes

Marionette follows Backbone's [pseudo-class architecture](./basics.md#class-based-inheritance).
This documentation is meant to provide a comprehensive listing of those classes so that
the reader can have a high-level view and understand functional similarities between the classes.
All of these classes share a [common set of functionality](./common.md).

### [Marionette.View](./marionette.view.md)

A `View` is used for managing portions of the DOM via a single parent DOM element or `el`.
It provides a consistent interface for managing the content of the `el` which is typically
administered by serializing a `Backbone.Model` or `Backbone.Collection` and rendering
a template with the serialized data into the `View`s `el`.

The `View` provides event delegation for capturing and handling DOM interactions as well as
the ability to separate concerns into smaller, managed child views.

`View` includes:
- [The DOM API](./dom.api.md)
- [Class Events](./events.class.md#view-events)
- [DOM Interactions](./dom.interactions.md)
- [Child Event Bubbling](./events.md#event-bubbling)
- [Entity Events](./events.entity.md)
- [View Rendering](./view.rendering.md)
- [Prerendered Content](./dom.prerendered.md)
- [View Lifecycle](./view.lifecycle.md)

A `View` can have [`Region`s](#marionetteregion) and [`Behavior`s](#marionettebehavior)

### [Marionette.CollectionView](./marionette.collectionview.md)

A `CollectionView` like `View` manages a portion of the DOM via a single parent DOM element
or `el`. This view manages an ordered set of child views that are shown within the view's `el`.
These children are most often created to match the models of a `Backbone.Collection` though a
`CollectionView` does not require a `collection` and can manage any set of views.

`CollectionView` includes:
- [The DOM API](./dom.api.md)
- [Class Events](./events.class.md#collectionview-events)
- [DOM Interactions](./dom.interactions.md)
- [Child Event Bubbling](./events.md#event-bubbling)
- [Entity Events](./events.entity.md)
- [View Rendering](./view.rendering.md)
- [Prerendered Content](./dom.prerendered.md)
- [View Lifecycle](./view.lifecycle.md)

A `CollectionView` can have [`Behavior`s](#marionettebehavior).

### [Marionette.Region](./marionette.region.md)

Regions provide consistent methods to manage, show and destroy views in your
applications and views.

`Region` includes:
- [Class Events](./events.class.md#region-events)
- [The DOM API](./dom.api.md)

### [Marionette.Behavior](marionette.behavior.md)

A `Behavior` provides a clean separation of concerns to your view logic, allowing you to
share common user-facing operations between your views.

`Behavior` includes:
- [Class Events](./events.class.md#behavior-events)
- [DOM Interactions](./dom.interactions.md)
- [Entity Events](./events.entity.md)

### [Marionette.Application](marionette.application.md)

An `Application` provides hooks for organizing and initiating other elements and a view tree.

`Application` includes:
- [Class Events](./events.class.md#application-events)
- [Radio API](./backbone.radio.md#marionette-integration)
- [MnObject's API](./marionette.mnobject.md)

An `Application` can have a single [region](./marionette.application.md#application-region).

### [Marionette.MnObject](marionette.mnobject.md)

`MnObject` incorporates backbone conventions `initialize`, `cid` and `extend`.

`MnObject` includes:
- [Class Events](./events.class.md#mnobject-events)
- [Radio API](./backbone.radio.md#marionette-integration).

## Routing in Marionette

Users of versions of Marionette prior to v4 will notice that a router is no longer bundled.
The [Marionette.AppRouter](https://github.com/marionettejs/marionette.approuter) was extracted
and the core library will no longer hold an opinion on routing.

[Continue Reading](./routing.md) about routing in Marionette.
