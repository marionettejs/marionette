# Terms used in these guides

These names describe what a value does, where it belongs, and who cleans it up.
The distinctions matter when connecting data, composing Views, or waiting for an
Application to finish starting.

## Models, template data, and state

A **model** is one value displayed by a View or represented by a CollectionView's
child View. It may be a plain object or a value from your chosen data library.
An **ordered model snapshot** is the current sequence returned by
`DataApi.models(collection)`. Collection change records refer to those original
models through `added`, `removed`, `previous`, and `current`.

**Serialized data** is the value prepared for a template. The default
`serializeCollection()` returns each model's serialized value; it does not return
the raw model snapshot. An override may return another shape. When the View has
no model, its template receives that collection serialization result as `models`.
See [Rendering](https://github.com/marionettejs/marionette/blob/master/docs/view.rendering.md).

A **state source** holds state for an Application, MnObject, View, CollectionView,
or Behavior. `getState()` returns the source itself, with its own values and
methods. State is configured separately from the model or collection a View
displays. See [State sources](./marionette.state.md).

| API | What it connects |
| --- | --- |
| [`DataApi`](./data.api.md) | Model reads, template serialization, collection order, and data events. |
| [`StateApi`](./marionette.state.md#stateapi) | State events and cleanup of owned state. |
| [`DomApi`](https://github.com/marionettejs/marionette/blob/master/docs/dom.api.md) | Element creation, selection, content, and attachment. |

An **adapter** implements the methods for one or more of these APIs using your
chosen tools. Installing an integration package makes its adapter available;
configure it on the runtime or class that will use it. A partial adapter override
changes the supplied methods and keeps the inherited methods it omits.

## Ownership and cleanup

A Behavior's **host View** is the View it is attached to. A **child View** is shown
by a Region or managed by a CollectionView. These names describe relationships;
a particular child might be a row, a card, or another item in your interface.

A **parent Application** owns its registered child Applications. Parents locate
and control children; children receive the collaborators they need explicitly.
The Application at the top of that hierarchy is its **root Application**.

For state, **borrowed** and **owned** describe who is responsible for disposal:

- A supplied or declared `state` is borrowed. Destroying an owner releases that
  owner's subscriptions and leaves the source available to other users.
- A `createState()` result is owned. Destroying the owner releases its
  subscriptions, then calls the selected StateApi's optional `disposeOwned()`.

A **cleanup function** releases a subscription or other resource. **Idempotent**
means repeated calls have the same effect as one call. Marionette wraps adapter
subscription cleanup functions to make them idempotent.

## Default and isolated runtimes

The named exports from `marionette` belong to the **default runtime**.
`createMarionette()` returns an **isolated runtime** with its own classes,
adapter and renderer configuration, and Radio channels. Choose one runtime's
classes and setters when composing that part of the application. See
[Runtime isolation](./runtime-isolation.md).

A state source created for one owner is still an owned state source; it does not
create another runtime. Current package imports use `marionette`; historical
migration guides may refer to the old `backbone.marionette` package name.

## Application lifecycle and readiness

`start()`, `stop()`, `restart()`, and `destroy()` are Application **lifecycle
operations**. A **readiness hook** is one of `onBeforeStart`, `onBeforeStop`, or
`onBeforeDestroy`. Marionette awaits a Promise returned by one of those hooks
before completing that phase.

The corresponding `before:*` event listeners are synchronous notifications;
their return values are not awaited. `onStart`, `onStop`, `onDestroy`, and their
matching events are **completion notifications** and are not awaited either.
See [Application lifecycle](https://github.com/marionettejs/marionette/blob/master/docs/marionette.application.md) for ordering,
cancellation, and the readiness `AbortSignal`.
