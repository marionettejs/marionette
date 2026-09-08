# Class Events

Class events let you respond as a view renders, a Region shows a view, or an
Application starts and stops. Marionette uses
[`triggerMethod`](./events.md#triggermethod) to dispatch these events, so you can
listen to an event or define its matching
[`onEvent` method](./events.md#onevent-binding).

Arguments depend on the event. Use the signatures below rather than assuming
the first argument is the instance that triggered it; for example, a Behavior's
proxied view events receive the host view.

## Documentation Index

* [Application Events](#application-events)
  * [`before:start` event](#beforestart-event)
  * [`start` event](#start-event)
  * [`before:stop` event](#beforestop-event)
  * [`stop` event](#stop-event)
* [Behavior Events](#behavior-events)
  * [`initialize` event](#initialize-event)
  * [Proxied Events](#proxied-events)
* [Region Events](#region-events)
  * [`show` and `before:show` events](#show-and-beforeshow-events)
  * [`empty` and `before:empty` events](#empty-and-beforeempty-events)
* [MnObject Events](#mnobject-events)
* [View Events](#view-events)
  * [`add:region` and `before:add:region` events](#addregion-and-beforeaddregion-events)
  * [`remove:region` and `before:remove:region` events](#removeregion-and-beforeremoveregion-events)
* [CollectionView Events](#collectionview-events)
  * [`add:child` and `before:add:child` events](#addchild-and-beforeaddchild-events)
  * [`remove:child` and `before:remove:child` events](#removechild-and-beforeremovechild-events)
  * [`sort` and `before:sort` events](#sort-and-beforesort-events)
  * [`filter` and `before:filter` events](#filter-and-beforefilter-events)
  * [`render:children` and `before:render:children` events](#renderchildren-and-beforerenderchildren-events)
  * [`destroy:children` and `before:destroy:children` events](#destroychildren-and-beforedestroychildren-events)
  * [CollectionView EmptyView Region Events](#collectionview-emptyview-region-events)
* [DOM Change Events](#dom-change-events)
  * [`render` and `before:render` events](#render-and-beforerender-events)
  * [`attach` and `before:attach` events](#attach-and-beforeattach-events)
  * [`detach` and `before:detach` events](#detach-and-beforedetach-events)
  * [`dom:refresh` event](#domrefresh-event)
  * [`dom:remove` event](#domremove-event)
  * [Advanced Event Settings](#advanced-event-settings)
* [Destroy Events](#destroy-events)
  * [`destroy` and `before:destroy` events](#destroy-and-beforedestroy-events)
* [Wrapping legacy views](#wrapping-legacy-views)

## Application Events

Application events describe its asynchronous lifecycle. Use a readiness method
when completion must wait for work; event-listener return values are not awaited.

### `before:start` event

Receives `(application, options, context)` before startup completes. The matching
`onBeforeStart(application, options, { signal })` method may return a Promise to
delay readiness. Pass the signal to cancellable work and prevent stale results
from committing application side effects.

### `start` event

Receives `(application, options)` after readiness and owned child startup complete.
The matching `onStart(application, options)` method can show the feature's View.
Both are completion notifications; their return values are not awaited.

Use the [Application lifecycle example](./marionette.application.md#starting-an-application)
for startup and the [routing guide](./routing.md) to connect an application's
router. Starting a history service is application setup, not a Marionette lifecycle
requirement.

The `options` passed to a lifecycle operation reach its hooks and events.
Readiness hooks and `before:*` events also receive a context whose signal is
aborted when a later operation invalidates that readiness. A transferred stop
phase retains its original options, context, and un-aborted signal. Only a Promise
returned by `onBeforeStart`, `onBeforeStop`, or `onBeforeDestroy` delays its phase.
See [Application lifecycle](./marionette.application.md#application-lifecycle)
for operation results, ordering, and cancellation.

### `before:stop` event

Fired just before the application is stopped. A Promise returned by
`onBeforeStop` delays completion of the stop lifecycle.

### `stop` event

Fired after the application has stopped. This event is a completion
notification and its return value is not awaited.

#### Application `destroy` events

The `Application` class also triggers `before:destroy` and `destroy` as part of
its [asynchronous lifecycle](./marionette.application.md#application-lifecycle).
`onBeforeDestroy` is awaited and receives `(application, options, context)`;
`onDestroy` is a completion notification and receives `(application, options)`.

## Behavior Events

### `initialize` event

After the view and behavior are [constructed and initialized](./marionette.behavior.md#initialize-order),
the last event to occur is an `initialize` event on the behavior which is passed
the view instance and any options passed to the view at instantiation.

```javascript
import { Behavior, View } from 'marionette';

const MyBehavior = Behavior.extend({
  onInitialize(view, options) {
    console.log(options.msg);
  }
});

const MyView = View.extend({
  behaviors: [MyBehavior]
});

const myView = new MyView({ msg: 'view initialized' });
```

**Note** This event is unique in that the triggering class instance (the view) is not the same instance
as the handler (the behavior). In most cases internally triggered events are triggered and handled by
the same instance, but this is an exception.

### Proxied Events

A `Behavior`'s view events [are proxied directly on the behavior](./marionette.behavior.md#proxy-handlers).

**Note** In order to prevent conflict `Behavior` does not trigger [destroy events](#destroy-and-beforedestroy-events)
with its own destruction. A `destroy` event occurring on the `Behavior` will have originated from the related view.

## Region Events

When you show a view inside a region - either using [`region.show(view)`](./marionette.region.md#showing-a-view) or
[`showChildView('region', view)`](./marionette.view.md#showing-a-child-view) - the `Region` will emit events around the view
events that you can hook into.

The `Region` class also triggers [Destroy Events](#destroy-and-beforedestroy-events).

### `show` and `before:show` events

These events fire before (`before:show`) and after (`show`) showing anything in a region.
A view may or may not be rendered during `before:show`, but a view will be rendered by `show`.

The `show` events will receive the region instance, the view being shown, and any options passed to `region.show`.

```javascript
import { Region, View } from 'marionette';

const MyRegion = Region.extend({
  onBeforeShow(myRegion, view, options) {
    console.log(myRegion.hasView()); //false
    console.log(view.isRendered()); // false
    console.log(options.foo === 'bar'); // true
  },
  onShow(myRegion, view, options) {
    console.log(myRegion.hasView()); //true
    console.log(view.isRendered()); // true
    console.log(options.foo === 'bar'); // true
  }
});

const MyView = View.extend({
  template: () => 'hello'
});

const regionElement = document.createElement('div');
const myRegion = new MyRegion({ el: regionElement });

myRegion.show(new MyView(), { foo: 'bar' });
```

### `empty` and `before:empty` events

These events fire before (`before:empty`) and after (`empty`) emptying a region's view.
These events will not fire if there is no view in the region, even if the region detaches
DOM from within the region's `el`.
The view will not be detached or destroyed during `before:empty`,
but will be detached or destroyed during the `empty`.

The empty events will receive the region instance, the view leaving the region.

```javascript
import { Region, View } from 'marionette';

const MyRegion = Region.extend({
  onBeforeEmpty(myRegion, view) {
    console.log(myRegion.hasView()); //true
    console.log(view.isDestroyed()); // false
  },
  onEmpty(myRegion, view) {
    console.log(myRegion.hasView()); //false
    console.log(view.isDestroyed()); // true
  }
});

const MyView = View.extend({
  template: () => 'hello'
});

const regionElement = document.createElement('div');
const myRegion = new MyRegion({ el: regionElement });

myRegion.empty(); // no events, no view emptied

myRegion.show(new MyView());

myRegion.empty();
```
## MnObject Events

The `MnObject` class triggers [Destroy Events](#destroy-and-beforedestroy-events).

## View Events

### `add:region` and `before:add:region` events

These events fire before (`before:add:region`) and after (`add:region`) a region is added to a view.
This event handler will receive the view instance, the region name string, and the region instance as
event arguments. The Region is fully instantiated for both events.

### `remove:region` and `before:remove:region` events

These events fire before (`before:remove:region`) and after (`remove:region`) a region is removed from a view.
This event handler will receive the view instance, the region name string, and the region instance as
event arguments. The Region is not yet destroyed in the before event, but is destroyed by `remove:region`.

`removeRegion()` and the View's Region cleanup path emit these events. Destroying
a Region directly does not itself emit the owning View's remove-region events.

## CollectionView Events

The `CollectionView` triggers unique events specifically related to child management.

### `add:child` and `before:add:child` events

These events fire before (`before:add:child`) and after (`add:child`) each child
View is added to [`children`](./marionette.collectionview.md#accessing-a-child-view).
Both receive `(collectionView, childView)`; the child is already constructed at
`before:add:child`.
These will fire once for each model in the attached collection or for any view added using
[`addChildView`](./marionette.collectionview.md#adding-a-child-view).

### `remove:child` and `before:remove:child` events

These events fire before (`before:remove:child`) and after (`remove:child`) each child view
is removed from the [`children`](./marionette.collectionview.md#accessing-a-child-view).
A view may be removed from the `children` if it is destroyed, if it is removed
from the `collection` or if it is removed with [`removeChildView`](./marionette.collectionview.md#removing-a-child-view).

**NOTE** A childview may or may not be destroyed by this point.

**NOTE** When a `CollectionView` is destroyed it will not individually remove its `children`.
Each childview will be destroyed, but any needed clean up during the `CollectionView`'s destruction
should happen in [`before:destroy:children`](#destroychildren-and-beforedestroychildren-events).

### `sort` and `before:sort` events

These events fire before (`before:sort`) and after (`sort`) sorting the children in the `CollectionView`.
These events fire when there are managed children and `getComparator()` returns
an active comparator, including the default comparator for collection order.
See [`viewComparator`](./marionette.collectionview.md#defining-the-viewcomparator).

### `filter` and `before:filter` events

These events fire before (`before:filter`) and after (`filter`) filtering the children in the `CollectionView`.
This event will only fire if there are [`children`](./marionette.collectionview.md#accessing-a-child-view)
and a [`viewFilter`](./marionette.collectionview.md#defining-the-viewfilter).

When the `filter` event is fired the children filtered out will have already been
detached from the view's `el`, but new children will not yet have been rendered.
The `filter` event receives `(collectionView, passingViews, filteredViews)`.
Passing Views are the selected result; some may already be attached, while new
ones are rendered and attached by the following child-render pass.

```javascript
import { CollectionView } from 'marionette';

const MyCollectionView = CollectionView.extend({
  onBeforeFilter(myCollectionView) {
   console.log('Nothing has changed yet!');
  },
  onFilter(myCollectionView, passingViews, filteredViews) {
    console.log('Views passing the filter', passingViews);
    console.log('Views excluded by the filter', filteredViews);
  }
});
```

### `render:children` and `before:render:children` events

Similar to [`Region` `show` and `before:show` events](#show-and-beforeshow-events) these events fire
before (`before:render:children`) and after (`render:children`) the `children` of the `CollectionView`
are attached to the `CollectionView`'s `el` or `childViewContainer`.

These events will be passed the `CollectionView` instance and the array of views being attached.
The views in the array may or may not be rendered or attached for `before:render:children`,
but will be rendered and attached by `render:children`.

Both events receive the complete current presented `children` array, including
already-rendered survivors. An empty result still emits both events with an empty
array while the empty-View Region is updated. “Attached” here means inserted into
the CollectionView container; the container itself may be detached from the document.

### `destroy:children` and `before:destroy:children` events

These events fire before (`before:destroy:children`) and after (`destroy:children`) destroying the children
in the `CollectionView`. These events will only fire if there are [`children`](./marionette.collectionview.md#accessing-a-child-view).

### CollectionView EmptyView Region Events

The `CollectionView` uses a Region internally to show or destroy its empty View.
See [Region Events](#region-events).

```javascript
import { CollectionView, View } from 'marionette';

const MyEmptyView = View.extend({ template: () => 'No items' });
const MyView = CollectionView.extend({
  emptyView: MyEmptyView
});

const myView = new MyView();

myView.getEmptyRegion().on({
  'show'() {
    console.log('CollectionView is empty!');
  },
  'before:empty'() {
    if (this.hasView()) {
      console.log('CollectionView is removing the emptyView');
    }
  }
});

myView.render();
```

## DOM Change Events

### `render` and `before:render` events

For `View`, these events bracket template rendering. For `CollectionView`,
they bracket the complete child rebuild/render pass, even without a template.
Both receive the instance as their argument.

`before:render` will occur prior to removing any current child views.
`render` is an ideal event for attaching child views to the view's template as the first
render _generally_ occurs prior to the view attaching to the DOM.

```javascript
import { View, CollectionView } from 'marionette';

const MyChildView = View.extend({ template: () => 'Child' });

const MyView = View.extend({
  template: () => '<div class="foo-region"></div>',
  regions: {
    'foo': '.foo-region'
  },
  onRender() {
    this.showChildView('foo', new MyChildView());
  }
});

const MyCollectionView = CollectionView.extend({
  childView: MyChildView,
  onRender() {
    // Add a child not from the `collection`
    this.addChildView(new MyChildView());
  }
})
```

Adopting [prerendered contents](./dom.prerendered.md) does not itself emit these
events. Use `initialize` for initial child setup on that path. `View#render()`
returns without events when `template` is `false`; `CollectionView#render()`
still emits its render events when its template is `false` or absent.

### `attach` and `before:attach` events

Reflects when the `el` of a view is attached to the DOM. These events will not trigger when
a view is re-rendered as the `el` itself does not change.

`attach` is the ideal event to setup any external DOM listeners such as `jQuery` plugins
that use the view's `el`, but _not_ its contents.

### `detach` and `before:detach` events

Reflects when the `el` of a view is detached from the DOM. These events will not trigger when
a view is re-rendered as the `el` itself does not change.

`before:detach` is the ideal event to clean up any external DOM listeners such as `jQuery` plugins
that use the view's `el`, but _not_ its contents.

### `dom:refresh` event

Reflects when the _contents_ of a view's `el` change in the DOM.
This event will fire when the view is first [`attach`ed](#attach-and-beforeattach-events).
It will also fire if an attached view is re-rendered.

This is the ideal event to setup any external DOM listeners such as `jQuery` plugins
that use DOM _within_ the `el` of the view and not the view's `el` itself.

The monitor requires both `isAttached()` and `isRendered()` to be true.
Prerendered contents can establish rendered state, and a CollectionView render
establishes it even without a template.

### `dom:remove` event

Reflects when the _contents_ of a view's `el` are about to change in the DOM.
This event will fire when the view is about to be [`detach`ed](#detach-and-beforedetach-events).
It will also fire before an attached view is re-rendered.

This is the ideal event to clean up any external DOM listeners such as `jQuery` plugins
that use DOM _within_ the `el` of the view and not the view's `el` itself.

The monitor requires both `isAttached()` and `isRendered()` to be true.
Prerendered contents can establish rendered state, and a CollectionView render
establishes it even without a template.

### Advanced Event Settings

Marionette is able to trigger `attach`/`detach` events down the view tree along with
triggering the `dom:refresh`/`dom:remove` events because of the view event monitor.
This monitor starts when a Marionette View is constructed.

In some cases it may be a useful performance improvement to disable this functionality.
Doing so is as easy as setting `monitorViewEvents: false` on the view class.

```javascript
import { View } from 'marionette';

const NonMonitoredView = View.extend({
  monitorViewEvents: false
});
```

**Note**: Disabling the view monitor will break the monitor generated events for this view
_and all child views_ of this view. Disabling should be done carefully.

## Destroy Events

### `destroy` and `before:destroy` events

Every class has a `destroy` method which can be used to clean up the instance.
With the exception of `Behavior`, each class triggers a `before:destroy` and a
`destroy` event. Application uses the separate asynchronous lifecycle described
under [Application Events](#application-events); this section describes the
synchronous owner classes.

As a general rule, `onBeforeDestroy` is the best handler for cleanup as the instance
and any internally created children are already destroyed by the time `onDestroy` is called.

For classes with these lifecycle events, once destruction begins, reentrant
`destroy()` calls from `before:destroy` or `destroy`, and later repeated calls,
return the same instance without restarting teardown. `isDestroyed()` remains
`false` during `before:destroy` and is `true` by the time `destroy` is triggered.
If a synchronous lifecycle handler throws, its error propagates and teardown
stops. Later `destroy()` calls do not retry the lifecycle or resume partial
cleanup. Application's asynchronous operation failures follow its separate
lifecycle contract.

Use [`dom:remove`](#domremove-event) or [`before:detach`](#detach-and-beforedetach-events)
for work tied to those transitions. Resources created while detached, or while
attachment monitoring is disabled, also need owner cleanup in `onBeforeDestroy`;
do not rely on a DOM notification that may never occur.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  onBeforeDestroy(view, options) {
    console.log(options.foo);
  }
});

const myView = new MyView();

myView.destroy({ foo: 'destroy view' });
```

#### `CollectionView` `destroy:children` and `before:destroy:children` events

Similar to `destroy`, `CollectionView` has events for when all of its children
are destroyed. See [the CollectionView's events](#destroychildren-and-beforedestroychildren-events)
for more information.

## Wrapping legacy views

Managed children provide Marionette's render and destroy lifecycle themselves.
`supportsRenderLifecycle` and `supportsDestroyLifecycle` are removed; Regions and
CollectionViews do not supply missing lifecycle events or call `remove()` as a
substitute for `destroy()`.

Keep non-Marionette views inside a [Marionette wrapper](./marionette.region.md#wrapping-a-non-marionette-view)
that owns their rendering and cleanup. Mixing `Marionette.Events` into a Backbone
View does not make it a supported managed child.
