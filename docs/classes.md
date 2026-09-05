# Marionette Classes

Each Marionette class has a job: render a piece of interface, manage where it goes,
repeat it, share an interaction, or coordinate a feature. Start with the job you
need, then follow the reference for its options and lifecycle.

The classes share [configuration and inheritance patterns](./basics.md#class-based-inheritance)
and a [common set of methods](./common.md).

### [Marionette.View](./marionette.view.md)

A `View` owns a piece of interface through its root element, `el`. It renders a
template, handles DOM interactions, and can divide a screen into Regions for child
Views. Plain objects and function templates work with the default configuration.

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

A `CollectionView` manages an ordered set of child Views inside its root element.
Use it for rows, cards, or other repeated content. A plain array supplies a static
collection; an observable data integration can notify it of changes. You can also
manage child Views directly without supplying a collection.

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

A `Region` gives a View a place to appear. Showing a new View renders and attaches
it; replacing or emptying the Region destroys its current View by default.

`Region` includes:
- [Class Events](./events.class.md#region-events)
- [The DOM API](./dom.api.md)

### [Marionette.Behavior](marionette.behavior.md)

A `Behavior` shares interaction logic between Views, such as keyboard shortcuts or
a reusable button action. The host View constructs and cleans up its Behaviors.

`Behavior` includes:
- [Class Events](./events.class.md#behavior-events)
- [DOM Interactions](./dom.interactions.md)
- [Entity Events](./events.entity.md)

### [Marionette.Application](marionette.application.md)

An `Application` coordinates a feature's asynchronous start, stop, restart, and
destruction. It can own child Applications and display a View through an optional
Region. Use it for work that should start and stop together.

`Application` includes:
- [Class Events](./events.class.md#application-events)
- [Radio API](./radio.md#marionette-integration)
- [Common Marionette Functionality](./common.md)
- [State API](./marionette.state.md)

An `Application` can have a single [region](./marionette.application.md#application-region).

### [Marionette.MnObject](marionette.mnobject.md)

`MnObject` gives a nonvisual object initialization, events, options, and cleanup.
Use it when those conventions are useful without an element or an Application's
asynchronous lifecycle.

`MnObject` includes:
- [Class Events](./events.class.md#mnobject-events)
- [Radio API](./radio.md#marionette-integration).

### [State sources and StateApi](marionette.state.md)

Give a feature or View its own state, or pass in a source it should share.
`StateApi` connects that source's notifications and cleanup to its owner.

## Routing in Marionette

Choose a router that fits your application. Route handlers can start an Application
or show a View using ordinary application code.

[Continue Reading](./routing.md) about routing in Marionette.
