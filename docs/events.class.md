# Class Events

Marionette uses [`triggerMethod`](./events.md#triggermethod) internally to trigger various
events used within the [classes](./classes.md). This provides ['onEvent' binding](./events.md#onevent-binding)
providing convenient hooks for handling class events. Notably all internally triggered events
will pass the triggering class instance as the first argument of the event.

## Documentation Index

* [Application Events](#application-events)
  * [`before:start` event](#before-start-event)
  * [`start` event](#start-event)
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
* [Supporting Backbone Views](#supporting-backbone-views)
  * [`Marionette.Events` and `triggerMethod`](#marionetteevents-and-triggermethod)
  * [Lifecycle Events](#lifecycle-events)

## Application Events

The `Application` object will fire two events:

### `before:start` event

Fired just before the application is started. Use this to prepare the
application with anything it will need to start, for example instantiating
routers, models, and collections.

### `start` event

Fired as part of the application startup. This is where you should be showing
your views and starting `Backbone.history`.

```javascript
import Bb from 'backbone';
import { Application } from 'backbone.marionette';

import MyModel from './mymodel';
import MyView from './myview';

const MyApp = Application.extend({
  region: '#root-element',

  initialize(options) {
    console.log('Initialize' + options.foo);
  },

  onBeforeStart(app, options) {
    this.model = new MyModel(options.data);
  },

  onStart(app, options) {
    this.showView(new MyView({model: this.model}));
    Bb.history.start();
  }
});

const myApp = new MyApp({ foo: 'My App' });
myApp.start({ data: { bar: true } });
```

[Live example](https://jsfiddle.net/marionettejs/ny59rs7b/)

As shown the `options` object is passed into the `Application` as the
second argument to `start`.

#### Application `destroy` events

The `Application` class also triggers [Destroy Events](#destroy-and-beforedestroy-events).

## Behavior Events

### `initialize` event

After the view and behavior are [constructed and initialized](./marionette.behavior.md#events--initialize-order),
the last event to occur is an `initialize` event on the behavior which is passed
the view instance and any options passed to the view at instantiation.

```javascript
import { Behavior, View } from 'backbone.marionette';

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
[`showChildView('region', view)`](./marionette.view.md#showing-a-view) - the `Region` will emit events around the view
events that you can hook into.

The `Region` class also triggers [Destroy Events](#destroy-and-beforedestroy-events).

### `show` and `before:show` events

These events fire before (`before:show`) and after (`show`) showing anything in a region.
A view may or may not be rendered during `before:show`, but a view will be rendered by `show`.

The `show` events will receive the region instance, the view being shown, and any options passed to `region.show`.

```javascript
import { Region, View } from 'backbone.marionette';

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
  template: _.template('hello')
});

const myRegion = new MyRegion({ el: '#dom-hook' });

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
import { Region, View } from 'backbone.marionette';

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
  template: _.template('hello')
});

const myRegion = new MyRegion({ el: '#dom-hook' });

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
event arguments. The region is fully instantated for both events.

### `remove:region` and `before:remove:region` events

These events fire before (`before:remove:region`) and after (`remove:region`) a region is removed from a view.
This event handler will receive the view instance, the region name string, and the region instance as
event arguments. The region will be not be destroyed in the before event, but is destroyed by `remove:region`.

**Note** Currently these events are only triggered using the `view.removeRegion` API and not when the region
is destroyed directly. https://github.com/marionettejs/backbone.marionette/issues/3602

## CollectionView Events

The `CollectionView` triggers unique events specifically related to child management.

### `add:child` and `before:add:child` events

These events fire before (`before:add:child`) and after (`add:child`) each child view
is instantiated and added to the [`children`](./collectionview.md#collectionviews-children).
These will fire once for each item in the attached collection or for any view added using
[`addChildView`](./collectionview.md#adding-a-child-view).

### `remove:child` and `before:remove:child` events

These events fire before (`before:remove:child`) and after (`remove:child`) each child view
is removed to the [`children`](./collectionview.md#collectionviews-children).
A view may be removed from the `children` if it is destroyed, if it is removed
from the `collection` or if it is removed with [`removeChildView`](./collectionview.md#removing-a-child-view).

**NOTE** A childview may or may not be destroyed by this point.

**NOTE** When a `CollectionView` is destroyed it will not individually remove its `children`.
Each childview will be destroyed, but any needed clean up during the `CollectionView`'s destruction
should happen in [`before:destroy:children`](#destroychildren-and-beforedestroychildren-events).

### `sort` and `before:sort` events

These events fire before (`before:sort`) and after (`sort`) sorting the children in the `CollectionView`.
These events will only fire if there are [`children`](./collectionview.md#collectionviews-children)
and a [`viewComparator`](./collectionview.md#defining-the-viewcomparator)

### `filter` and `before:filter` events

These events fire before (`before:filter`) and after (`filter`) filtering the children in the `CollectionView`.
This event will only fire if there are [`children`](./collectionview.md#collectionviews-children)
and a [`viewFilter`](./collectionview.md#defining-the-viewfilter).

When the `filter` event is fired the children filtered out will have already been
detached from the view's `el`, but new children will not yet have been rendered.
The `filter` event not only receives the view instance, but also arrays of attached views,
and detached views.

```javascript
const MyCollectionView = CollectionView.extend({
  onBeforeFilter(myCollectionView) {
   console.log('Nothing has changed yet!');
  },
  onFilter(myCollectionView, attachViews, detachedView) {
    console.log('Array of attached views', attachedView);
    console.log('Array of detached views', attachedView);
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

If the `CollectionView` can determine that added views will only be appended to the end, only the appended views
will be passed to the event. Otherwise all of the `children` views will be passed.

**Note** if you consistently need all of the views within this event use [`children`](./marionette.collectionview.md#collectionviews-children)

### `destroy:children` and `before:destroy:children` events

These events fire before (`before:destroy:children`) and after (`destroy:children`) destroying the children
in the `CollectionView`. These events will only fire if there are [`children`](./collectionview.md#collectionviews-children).

### CollectionView EmptyView Region Events

The `CollectionView` uses a region internally that can be used to know when the empty view is show or destroyed.
See [Region Events](#region-events).

```javascript
import { CollectionView } from 'backbone.marionette';

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

Reflects when a view's template is being rendered into its `el`.

`before:render` will occur prior to removing any current child views.
`render` is an ideal event for attaching child views to the view's template as the first
render _generally_ occurs prior to the view attaching to the DOM.

```javascript
import { View, CollectionView } from 'backbone.marionette';
import MyChildView from './MyChildView';

const MyView = View.extend({
  template: _.template('<div class="foo-region"></div>'),
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

**Note** This event is only triggered when rendering a template into a view. A view that
is pre-rendered will not have this event triggered unless re-rendered. [Pre-rendered views](./dom.prerendered.md)
should use `initialize` for attaching child views and the `render` event if the view is re-rendered.

**Note** If a view's `template` is set to `false` this event will not trigger.

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

**NOTE** This event will not fire if the view has no template to render unless it contains
prerendered html.

### `dom:remove` event

Reflects when the _contents_ of a view's `el` are about to change in the DOM.
This event will fire when the view is about to be [`detach`ed](#detach-and-beforedetach-events).
It will also fire before an attached view is re-rendered.

This is the ideal event to clean up any external DOM listeners such as `jQuery` plugins
that use DOM _within_ the `el` of the view and not the view's `el` itself.

**NOTE** This event will not fire if the view has no template to render unless it contains
prerendered html.

### Advanced Event Settings

Marionette is able to trigger `attach`/`detach` events down the view tree along with
triggering the `dom:refresh`/`dom:remove` events because of the view event monitor.
This monitor starts when a view is created or shown in a region (to handle non-Marionette views).

In some cases it may be a useful performance improvement to disable this functionality.
Doing so is as easy as setting `monitorViewEvents: false` on the view class.

```javascript
import { View } from 'backbone.marionette';

const NonMonitoredView = View.extend({
  monitorViewEvents: false
});
```

**Note**: Disabling the view monitor will break the monitor generated events for this view
_and all child views_ of this view. Disabling should be done carefully.

## Destroy Events

### `destroy` and `before:destroy` events

Every class has a `destroy` method which can be used to clean up the instance.
With the exception of `Behavior`'s each of these methods triggers a `before:destroy`
and a `destroy` event.

As a general rule, `onBeforeDestroy` is the best handler for cleanup as the instance
and any internally created children are already destroyed by the time `onDestroy` is called.

**Note** For views this is not the ideal location for clean up of anything touching the DOM.
See [`dom:remove`](#domremove-event) or [`before:detach`] for DOM related clean up.

```javascript
import { Application, View } from 'backbone.marionette';

const MyView = View.extend({
  onBeforeDestroy(options) {
    console.log(options.foo);
  }
});

const myView = new MyView();

mvView.destroy({ foo: 'destroy view' });

const MyApp = Application.extend({
  onBeforeDestroy(options) {
    console.log(options.foo);
  }
});

const myApp = new MyApp();

myApp.destroy({ foo: 'destroy app' });
```

#### `CollectionView` `destroy:children` and `before:destroy:children` events

Similar to `destroy`, `CollectionView` has events for when all of its children
are destroyed. See [the CollectionView's events](#destroychildren-and-beforedestroychildren-events)
for more information.

## Supporting Backbone Views

### `Marionette.Events` and `triggerMethod`

Internally Marionette uses [`triggerMethod`](./common.md#triggermethod) for event triggering.
This API is not available to `Backbone.View`s so in order to support `Backbone.View`s in Marionette v4+,
`Marionette.Events` must be mixed into the non-Marionette view.

This can be done for an individual view definition:
```javascript
import { Events } from 'backbone.marionette';

const MyBbView = Backbone.View.extend(Events);
```
or for all `Backbone.View`s
```javascript
_.extend(Backbone.View.prototype, Events);
```

### Lifecycle Events

#### `render` and `destroy`

To support non-Marionette Views, Marionette uses two flags to determine if it should trigger
`render` and `destroy` events on the view. If a custom view throws it's own `render` or `destroy`
events, the related flag should be set to `true` to avoid Marionette duplicating these events.

```javascript
// Add support for triggerMethod
import { Events } from 'backbone.marionette';

_.extend(Backbone.View.prototype, Events);

const MyCustomView = Backbone.View.extend({
  supportsRenderLifecycle: true,
  supportsDestroyLifecycle: true,
  render() {
    this.triggerMethod('before:render');

    this.$el.html('render html');

    // Since render is being triggered here set the
    // supportsRenderLifecycle flag to true to avoid duplication
    this.triggerMethod('render');
  },
  destroy() {
    this.triggerMethod('before:destroy');

    this.remove();

    // Since destroy is being triggered here set the
    // supportsDestroyLifecycle flag to true to avoid duplication
    this.triggerMethod('destroy');
  }
});
```

#### DOM Change Lifecycle Events

As mentioned in [Advanced Event Settings](#advanced-event-settings) some DOM events
are triggers from the view event monitor that will handle DOM attachment related events
down the view tree. Backbone View's won't have the functionality unless the monitor is
added. This will include all [DOM Change Events](#dom-change-events) other than render.

You can add the view events monitor to any non-Marionette view:
```javascript
import { monitorViewEvents, Events } from 'backbone.marionette';

// Add support for triggerMethod
_.extend(Backbone.View.prototype, Events);

const MyCustomView = Backbone.View.extend({
  initialize() {
    monitorViewEvents(this);
    // Ideally this happens first prior to any rendering
    // or attaching that might occur in the initialize
  }
});
```
