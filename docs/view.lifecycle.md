# View Lifecycle

Both [`View` and `CollectionView`](./classes.md) are aware of their lifecycle state
which indicates whether the View is rendered, attached, or destroyed.

## Documentation Index

* [View Lifecycle](#view-lifecycle)
* [Lifecycle State Methods](#lifecycle-state-methods)
  * [`isRendered()`](#isrendered)
  * [`isAttached()`](#isattached)
  * [`isDestroyed()`](#isdestroyed)
* [Instantiating a View](#instantiating-a-view)
  * [Using `setElement`](#using-setelement)
* [Rendering a View](#rendering-a-view)
  * [`View` Rendering](#view-rendering)
  * [`CollectionView` Rendering](#collectionview-rendering)
* [Rendering Children](#rendering-children)
* [Attaching a View](#attaching-a-view)
* [Detaching a View](#detaching-a-view)
* [Destroying a View](#destroying-a-view)
* [Destroying Children](#destroying-children)

## Lifecycle State Methods

Both `View` and `CollectionView` share methods for checking lifecycle state.

### `isRendered()`

Returns a boolean value reflecting if the view is considered rendered.

### `isAttached()`

Returns a boolean value reflecting if the view is considered attached to the DOM.

### `isDestroyed()`

Returns a boolean value reflecting if the view has been destroyed.

### State vectors

The three lifecycle methods are independent observations, not one linear state enum.
`View` construction can therefore produce any of the four alive render/attachment vectors:

| Initial `el` | `isRendered()` | `isAttached()` | `isDestroyed()` |
| --- | --- | --- | --- |
| Empty and detached | `false` | `false` | `false` |
| Empty and in the document | `false` | `true` | `false` |
| Populated and detached | `true` | `false` | `false` |
| Populated and in the document | `true` | `true` | `false` |

`CollectionView` starts unrendered regardless of its initial contents and has its own
[lifecycle transition table](./marionette.collectionview.md#view-lifecycle-and-events).

With lifecycle monitoring enabled, Marionette-managed operations preserve the
following observable transitions:

| Operation | Result | Repeated call |
| --- | --- | --- |
| `View#render()` with a template function while alive | Runs `before:render` and `render`; rendered becomes `true`; attachment is unchanged | Renders again and runs the render lifecycle again |
| `View#render()` with `template: false` while alive | Returns the View without running the render lifecycle or changing contents or state | Repeated calls are the same no-op |
| `CollectionView#render()` while alive | Runs `before:render` and `render`, rebuilds its children, and becomes rendered; attachment is unchanged | Rebuilds the children and runs the render lifecycle again |
| `View#setElement(el)` while alive | Rendered reflects whether the replacement element has contents; attached reflects whether it is in the document | Recomputes the same state from the current element |
| `CollectionView#setElement(el)` while alive | Rendered is preserved; attached reflects whether the replacement element is in the document | Preserves rendered and recomputes attached from the current element |
| `region.show(view)` | Ensures the view is rendered; attached becomes `true` only when the Region is in the document | Showing the current view is a no-op |
| `region.detachView()` | Rendered stays `true`; attached becomes `false`; destroyed stays `false` | Returns `undefined` with no transition |
| Re-show a detached view | Rendered stays `true`; attachment reflects the Region | Does not render the view again |
| `region.empty()` or `view.destroy()` | Rendered and attached become `false`; destroyed becomes `true` | Repeated destroy is a no-op |
| `view.render()` after destruction | Returns the same View with rendered and attached `false` and destroyed `true` | Repeated calls are no-ops |
| `view.setElement(el)` once destruction begins | Returns the same View before inspecting or replacing the element or changing delegation, DOM, or lifecycle state | Calls during `before:destroy` and repeated calls after destruction are no-ops |
| `CollectionView#addChildView(view, ...)` once destruction begins | Returns the supplied child before inspecting or taking ownership of it; the caller remains responsible for that child | Repeated calls are no-ops for the destroyed CollectionView |
| `view.delegateEvents()` or `view.undelegateEvents()` once destruction begins | Returns the same View without changing View or Behavior DOM delegation | Repeated calls are no-ops |
| `view.bindUIElements()` once destruction begins | Returns the same View without resolving host UI, querying DOM, or binding View or Behavior UI | Repeated calls are no-ops |

Setting `monitorViewEvents: false` on a Region's owning view intentionally disables
attachment events and automatic `isAttached()` updates for the shown view.

This table specifies the managed and terminal operations listed above. Do not
infer behavior for other calls on a destroyed View; custom overrides also own
their behavior unless they delegate to a guarded base method.

## Instantiating a View

Every Marionette `View` and `CollectionView` has a native DOM element in `el`.
Pass an existing element with `el: document.querySelector('.foo-selector')`, or
create one first with `document.createElement()`. Selector strings and jQuery
collections are not valid View `el` values.

When `el` is omitted, Marionette creates the root element from `tagName` (a
`div` by default) and applies the resolved `id`, `className`, and `attributes`.
The element remains the View's root until application code explicitly replaces
it with [`setElement()`](#using-setelement). Native core does not create `$el`;
applications that require that compatibility surface can opt into the
[jQuery DOM adapter](./dom.api.md#optional-jquery-adapter).

Marionette determines whether the initial root is already
[rendered](#rendering-a-view) or [attached](#attaching-a-view). If a View starts
rendered or attached, its [state](#lifecycle-state-methods) reflects that status, but the
[related events](./events.class.md#dom-change-events) will not have fired.
An element owned by template content is detached while that owner document has no
document element. Showing its View later through an attached Region runs the managed
attachment lifecycle once for the View and its existing children.

For more information on instantiating a view with pre-rendered DOM, see
[Pre-rendered Content](./dom.prerendered.md).

### Using `setElement`

While a `View` is alive, `setElement()` replaces its root with a native DOM
element, recomputes `isRendered()` from the replacement element's contents, and
recomputes `isAttached()` from whether that element is in the document. A
`CollectionView` instead preserves its current rendered state and recomputes
only attachment from the replacement element.

Both classes remove their existing View and Behavior DOM delegation and delegate
it once against the replacement element. They preserve Region and child-view
ownership, but do not move any owned child's DOM from the old root to the new
one. A child can therefore remain physically under the old root with its prior
lifecycle state. Prefer constructing a new owner when existing children would
otherwise need to be moved or reconciled manually.

Calling the base `View#setElement` or `CollectionView#setElement` once destruction begins
returns the same instance before inspecting the supplied element or changing delegation,
DOM, element identity, or lifecycle state. A custom override owns its behavior unless it
delegates to the guarded base method.

## Rendering a View

In Marionette [rendering a view](./view.rendering.md) is changing a view's `el`'s contents.

What rendering indicates varies slightly between the two Marionette views.

**Note** Outside an alive View's explicit `setElement()` replacement, once a View is considered
rendered it cannot become unrendered until it is [destroyed](#destroying-a-view).

### `View` Rendering

For [`View`](./marionette.view.md), rendering with a template function runs the
`before:render` lifecycle, serializes the View's data, passes it to the template,
places the result in `el`, binds UI, marks the View rendered, and then runs the
`render` lifecycle. A newly constructed `View` is already considered rendered if
its initial `el` contains content. A later template may produce empty content;
the completed render still leaves the View rendered.

`template: false` is different from a template that returns an empty value.
Calling `View#render()` with `template: false` returns the View without running
the render lifecycle, changing the DOM, or changing its rendered state.

### `CollectionView` Rendering

For [`CollectionView`](./marionette.collectionview.md), every live `render()` is
bracketed by `before:render` and `render`. After it completes, collection-backed
children have been rebuilt, the optional template and visible children have
been rendered, and the CollectionView is rendered. Any children the
CollectionView owned before that render have been destroyed.

Inserting a child element into the CollectionView is not itself an attachment
transition. When the CollectionView is monitored as attached, rendering marks
and notifies the inserted children as attached; when the parent is detached or
child lifecycle monitoring is disabled, their monitored attachment state remains
detached even though their elements are inside the parent element.

A CollectionView with no children is still rendered, with or without an
[`emptyView`](./marionette.collectionview.md#collectionviews-emptyview). Its own
template controls the container markup but does not determine rendered state.

## Rendering Children

Rendering child views is often best accomplished after the View renders, as the first render typically happens before
the View enters the DOM. This helps to prevent unnecessary repaints and reflows by making the DOM insertion at the
highest practical View in the view tree.

The exception is Views with [pre-rendered content](./dom.prerendered.md). When a View is instantiated
rendered, child Views are best managed in the View's [`initialize`](./common.md#initialize).

### `View` Children

In general the best method for adding a child view to a `View` is to use [`showChildView`](./marionette.view.md#showing-a-view)
in the [`render` event](./events.class.md#render-and-beforerender-events).

View Regions are emptied on each render, so Views shown outside of the `render` event still need to be shown again
on subsequent renders.

### `CollectionView` Children

The primary use case for a `CollectionView` is maintaining collection-backed
child Views. Marionette creates and removes those children as the collection
changes.

`addChildView()` can also add a child that is independent of the collection,
but that child is not unmanaged. The CollectionView owns it, includes it in its
child containers, and may sort or filter it. Rendering, collection reset, or
CollectionView destruction destroys every child that is still owned, including
manually added children. `detachChildView()` is the explicit operation that
removes a child from ownership without destroying it and transfers cleanup
responsibility to the caller.

See [Self-Managed `children`](./marionette.collectionview.md#self-managed-children)
for the supported add, remove, detach, sorting, and filtering contracts.

## Attaching a View

`isAttached()` is Marionette's monitored lifecycle state, not a live query of
the physical DOM on every call. Construction and `setElement()` initialize it
from the current root element, and Marionette-managed Region and CollectionView
operations update it while attachment monitoring is enabled.
The [`attach` event](./events.class.md#attach-and-beforeattach-events) is the
appropriate place to add listeners to the root `el`. Render can replace the
contents while that root remains attached; use
[`dom:refresh`](./events.class.md#domrefresh-event) for listeners tied to those
rendered descendants.

Moving `view.el` directly with native DOM APIs, such as
`document.body.append(view.el)`, changes its physical location without running
Marionette attachment lifecycles or updating `isAttached()`. The same caveat
applies when application code directly removes or moves an attached root.
Prefer a Region or CollectionView for managed transitions; if application code
moves the element directly, it owns the resulting lifecycle mismatch.

A child shown in a rendered but detached parent View's Region is rendered and remains
detached. When the parent is later shown in an attached Region, attachment propagates
to its existing children. A child shown during the parent's `onAttach` is attached
immediately. Showing the same attached parent again is a no-op for both parent and child
attachment lifecycles.

## Detaching a View

A managed View becomes detached when Marionette removes its `el` from the DOM
and updates its monitored attachment state.
Use the [`before:detach` event](./events.class.md#detach-and-beforedetach-events)
to clean up listeners added to the root `el`. Render can replace descendants
while the root remains attached; use
[`dom:remove`](./events.class.md#domremove-event) to clean up listeners tied to
those rendered descendants.

Detaching a parent View propagates detachment to its managed Region children while
preserving their rendered state and ownership. Re-showing that parent attaches the same
children again. Emptying the parent-owning Region then detaches and destroys the parent
and its still-managed children once.

## Destroying a View

Destroying a View (for example, `myView.destroy()`) removes Marionette-owned
resources: delegated View and Behavior DOM handlers, bound UI, outgoing
`listenTo()` subscriptions, entity-event bookkeeping, Behaviors, Regions and
their current Views, and CollectionView children that remain owned. It detaches
the root element and leaves the View rendered `false`, attached `false`, and
destroyed `true` after successful teardown.

Destroy does not remove callbacks registered directly on the View with `on()`,
destroy its model, collection, or arbitrary option collaborators, or clean up
application resources Marionette does not own. Release those resources in the
appropriate lifecycle callback.

The [`before:destroy` event](./events.class.md#destroy-and-beforedestroy-events) is the best place to clean
up any added listeners not related to the view's DOM.

Once destruction begins, reentrant `destroy()` calls from `before:destroy` or
`destroy`, and later repeated calls, return the same View without restarting
teardown. During a normal successful teardown, an attached parent and its owned
children complete their detach and destroy lifecycles once.

Base `View#bindUIElements()` and `CollectionView#bindUIElements()` calls are
also terminal no-ops once destruction begins. They do not resolve callable UI,
query the retained root element, or bind attached Behaviors. A direct
`Behavior#bindUIElements()` call through a Behavior owned by or retained from
that host returns the Behavior without binding. `unbindUIElements()` remains
available for cleanup, and `getUI()` continues to throw `MN0023` when UI is
unbound.

Marionette establishes a retry boundary only around `before:destroy`. If that
callback throws, the error propagates, the destruction guard is cleared, and a
later `destroy()` call runs `before:destroy` again before framework cleanup.
Marionette does not roll back changes made by the throwing callback. If a later
detach, child, Behavior, or `destroy` callback throws, the error also propagates,
but teardown may already be partial and another `destroy()` call does not resume
it. Do not rely on a stable intermediate state after such an error.

Successful destruction retains the root `el` object but detaches it. Do not
infer that all of its contents are retained: owned child Views are removed as
they are destroyed, and Region or CollectionView cleanup can detach contents
from managed containers. Marionette makes no general cleanup promise for
unowned DOM outside those managed boundaries.

## Destroying Children

Children still owned by a View's Region or a CollectionView are automatically
destroyed when their owner completes a re-render or is destroyed. A CollectionView also
destroys its currently owned children when its collection is reset before
building the replacement collection-backed children. A child returned by
`detachView()` or `detachChildView()` is no longer owned and is not included in
later owner cleanup.

During owner destruction, children are removed after the parent root is detached
to avoid repeated reflows or repaints.
