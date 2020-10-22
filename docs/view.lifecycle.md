# View Lifecycle

Both [`View` and `CollectionView`](./classes.md) are aware of their lifecycle state
which indicates if the view is rendered, attached to the DOM or destroyed.

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
* [Destroying Children](#rendering-children)

## Lifecycle State Methods

Both `View` and `CollectionView` share methods for checking lifecycle state.

### `isRendered()`

Returns a boolean value reflecting if the view is considered rendered.

### `isAttached()`

Returns a boolean value reflecting if the view is considered attached to the DOM.

### `isDestroyed()`

Returns a boolean value reflecting if the view has been destroyed.

## Instantiating a View

Marionette Views are Backbone Views and so when they are instantiated the view
has an `el`. That `el` will be the root node for the view and other than its contents it
will not change for the life of the view unless directly manipulated (ie: `view.$el.addClass`)

The view can be passed an existing `el` either in the DOM (ie: `el: $('.foo-selector')`)
or in memory (ie: `el: $('<div></div>')`) or most commonly, the view constructs
its own `el` at instantiation as [documented on backbonejs.org](http://backbonejs.org/#View-el).

Marionette will determine the initial state of the view as to whether the view is considered
already [rendered](#rendering-a-view) or [attached](#attaching-a-view). If a view is already
rendered or attached its [state](#lifecycle-state-methods) will reflect that status, but the
[related events](./events.class.md#dom-change-events) will not have fired.

For more information on instanting a view with pre-rendered DOM see: [Prerendered Content](./dom.prerendered.md).

### Using `setElement`

`Backbone.View` allows the user to change the view's `el` after instantiaton using
[`setElement`](http://backbonejs.org/#View-setElement). This method can be used in Marionette
as well, but should be done with caution. `setElement` will redelegate view events, but it will
essentially ignore children of the view, whether through `regions` or through `children` and the
view's `behaviors` will also be unaware of the change. It is likely better to reconstuct a new
view with the new `el` than to try to change the `el` of an existing view.

## Rendering a View

In Marionette [rendering a view](./view.rendering.md) is changing a view's `el`'s contents.

What rendering indicates varies slightly between the two Marionette views.

**Note** Once a view is considered "rendered" it cannot be unrendered until it is [destroyed](#destroying-a-view).

### `View` Rendering

For [`View`](./marionette.view.md), rendering entails serializing the view's data, passing it to a template,
and taking the results of that template and replacing the contents of the view's `el`. So when a `View` is
instantiated it is considered rendered if the `el` node contains any content. However after instantiation
a template may render empty in which case the `View` will still be considered "rendered" even though it
contains no content.

### `CollectionView` Rendering

For [`CollectionView`](./marionette.collectionview.md), rendering signifies that the view's
[`children`](./marionette.collectionview.md#collectionviews-children) were created and attached to the
view's `el`. So unlike `View` a `CollectionView` can be instantiated with content in its `el`, but until
the `children` are "rendered" the entire view is not considered rendered.

Notably if there are no `children` when rendering, the view will still be considered rendered. This is
true whether or not an [`emptyView`](./marionette.collectionview.md#collectionviews-emptyview) is rendered.
So it is possible for a `CollectionView` to be "rendered" but the `el` to only be an empty tag.
Also note that just like `View` a `CollectionView` may have a `template` which is rendered and attached to
the `el` during the `render`, but the template rendering itself has no bearing on the status of the `CollectionView`.

## Rendering Children

Rendering child views is often best accomplish after the view render as typically the first render happens prior to
the view entering the DOM. This helps to prevent unnecessary repaints and reflows by making the DOM insert at the
highest possible view in the view tree.

The exception is views with [prerendered content](./dom.prerendered.md). In the case that the view is instantiated
rendered, child views are best managed in the view's [`initialize`](./common.md#initialize).

### `View` Children

In general the best method for adding a child view to a `View` is to use [`showChildView`](./marionette.view.md#showing-a-view)
in the [`render` event](./events.class.md#render-and-beforerender-events).

View regions will be emptied on each render so views shown outside of the `render` event will still need be reshown
on subsequent renders.

### `CollectionView` Children

The primary use case for a `CollectionView` is maintaining child views to match the state of a Backbone Collection.
By default children will be added or removed to match the models within the collection.
However a `CollectionView` can have children in addition to, or instead of, views matching the `collection`.

#### Adding managed children

If you add a view to a `CollectionView`s children by default it will treat it as any other view added from the `collection`.
This means it is subject to the [`viewComparator`](./marionette.collectionview.md#defining-the-viewcomparator) and
[`viewFilter`](./marionette.collectionview.md#defining-the-viewfilter).

So if you are accounting for added views in your `viewFilter` and `viewComparator` the best place to add these children is
likely in the [`render` event](./events.class.md#render-and-beforerender-events) as the views will only be added once
(or re-added if the children are rebuilt in a subsequent `render`) and managed in the sort or filter as the `collection` is updated.

#### Adding unmanaged children

Unlike managed children there may be cases where you want to insert views to the results of the `CollectionView` after the
`collection` changes, or after sorting and/or filtering. In these cases the solution might depend slightly on the features
used on the `CollectionView`.

The goal will be to add the unmanaged views after other views are added and to remove any unmanaged views prior to any
managed `children` changes. To do so you must understand which [`CollectionView` event](./events.class.md#collectionview-events)
will occur prior to changes to the `children` for your particular use case. By default a `CollectionView` sorts according
to the `collection` sort, so unless `viewComparator` is disabled, the best event for removing unmanaged views is the
[`before:sort` event](./events.class.md#sort-and-beforesort-events), but if `viewComparator` is false the next event
to consider is the [`before:filter` event](./events.class.md#filter-and-beforefilter-events) if your `CollectionView` has
a `viewFilter`, otherwise the [`before:render:children` event](./events.class.md#renderchildren-and-beforerenderchildren-events)
is ideal.

Once you have determined the best strategy for removing your unmanaged child views, adding them is best handled in the
[`render:children` event](./events.class.md#renderchildren-and-beforerenderchildren-events). Additionally adding a child
with `addChildView` will itself cause these events to occur, so to prevent stack overflows, it is best to use a flag to guard
the adds and to insert a new view at a specified index.

The following simplistic example will add an unmanaged view at the 5th index and remove it prior to any changes to the `children`.
In a real world scenario it will likely be more complicated to keep track of which view to remove in the `onBeforeSort`.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  childView: MyChildView,
  onBeforeSort() {
    this.removeChildView(this.children.findByIndex(5));
  },
  onRenderChildren() {
    this.addFooView();
  },
  addFooView() {
    if (this.addingFooView) {
      return;
    }

    this.addingFooView = true;
    this.addChildView(new FooView(), 5);
    this.addingFooView = false;
  }
});
```

## Attaching a View

In Marionette a view is attached if the view's `el` can be found in the DOM.
The best time to add listeners to the view's `el` is likely in the [`attach` event](./events.class.md#attach-and-beforeattach-events).

While the `el` of the view can be attached the contents of the view can be removed and added to
during the lifetime of the view. If you are adding listeners to the contents of the view rather than
`attach` the [`dom:refresh` event](./events.class.md#domrefresh-event) would be best.

The attached state is maintained when attaching a view with a `Region` or as a child of a `CollectionView`
or during [view instantiation](#instantiating-a-view).
If a view is attached by other means like `$.append` [`isAttached`] may not reflect the actual state of attachment.

## Detaching a View

A view is detached when its `el` is removed from the DOM.
The best time to clean up any listeners added to the `el` is in the [`before:detach` event](./events.class.md#detach-and-beforedetach-events).

While the `el` of the view may remain attached, its contents will be removed on render.
If you have added listeners to the contents of the view rather than `before:detach` the
[`dom:remove` event](./events.class.md#domremove-event) would be best.

## Destroying a View

Destroying a view (ie: `myView.destroy()`) cleans up anything constucted within Marionette so that if
a view's instance is no longer referenced the view can be cleaned up by the browser's garbage collector.

The [`before:destroy` event](./events.class.md#destroy-and-beforedestroy-events) is the best place to clean
up any added listeners not related to the view's DOM.

The state of the view after the destroy is not attached and not rendered although the `el` is not emptied.

## Destroying Children

Children added to a `View`'s region or through a `CollectionView` will be automatically destroyed if the
view is re-rendered, if the view is destroyed, or for `CollectionView` if the `collection` is reset.

**Note** Children are removed after the DOM detach of the parent to prevent multiple reflows or repaints.
