# Marionette.View

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

A `View` can have [`Region`s](./marionette.region.md) and [`Behavior`s](./marionette.behavior.md)

## Documentation Index

* [Instantiating a View](#instantiating-a-view)
* [Rendering a View](#rendering-a-view)
  * [Using a View Without a Template](#using-a-view-without-a-template)
* [View Lifecycle and Events](#view-lifecycle-and-events)
* [Entity Events](#entity-events)
* [DOM Interactions](#dom-interactions)
* [Behaviors](#behaviors)
* [Managing Children](#managing-children)
  * [Laying Out Views - Regions](#laying-out-views---regions)
  * [Showing a Child View](#showing-a-child-view)
  * [Attaching a Child View](#attaching-a-child-view)
  * [Detaching a Child View](#detaching-a-child-view)
  * [Destroying a Child View](#destroying-a-child-view)
  * [Region Availability](#region-availability)
* [Efficient Nested View Structures](#efficient-nested-view-structures)
* [Listening to Events on Children](#listening-to-events-on-children)

## Instantiating a View

When instantiating a `View` there are several properties, if passed,
that will be attached directly to the instance:
`attributes`, `behaviors`, `childViewEventPrefix`, `childViewEvents`,
`childViewTriggers`, `className`, `collection`, `collectionEvents`, `el`,
`events`, `id`, `model`, `modelEvents`, `regionClass`, `regions`,
`tagName`, `template`, `templateContext`, `triggers`, `ui`

```javascript
import { View } from 'backbone.marionette';

const myView = new View({ ... });
```

Some of these properties come from Marionette, but many are inherited from
[`Backbone.View`](http://backbonejs.org/#View-constructor).

## Rendering a View

The Marionette View implements a powerful render method which, given a
[`template`](./view.rendering.md#setting-a-view-template), will build your
HTML from that template, mixing in `model` or `collection` data and any
extra [template context](./view.rendering.md#adding-context-data).

Unlike `Backbone.View` Marionette defines `render` and this method should
not be overridden. To add functionality to the render use the
[`render` and `before:render` events](./events.class.md#render-and-beforerender-events).

[Live example](https://jsfiddle.net/marionettejs/dhsjcka4/)

For more detail on how to render templates, see
[View Template Rendering](./view.rendering.md).

### Using a View Without a Template

By setting [`template` to `false`](./view.rendering.md#using-a-view-without-a-template) you can entirely disable
the view rendering and events. This may be useful for cases where you only need the `el` or have
[`prerendered content`](./dom.prerendered.md) that you do not intend to re-render.

## View Lifecycle and Events

An instantiated `View` is aware of its lifecycle state and will throw events related to when that state changes.

The view states indicate whether the view is rendered, attached to the DOM, or destroyed.

Read More:
- [View Lifecycle](./view.lifecycle.md)
- [View DOM Change Events](./events.class.md#dom-change-events)
- [View Destroy Events](./events.class.md#destroy-events)

## Entity Events

The `View` can bind to events that occur on the attached `model` and `collection` - this
includes both [standard backbone-events](http://backbonejs.org/#Events-catalog) and custom events.

Read More:
- [Entity Events](./events.entity.md)

## DOM Interactions

In addition to what Backbone provides the views, Marionette has additional API
for DOM interactions: `events`, `triggers`, and `ui`.

Read More:
- [DOM Interactions](./dom.interactions.md)

## Behaviors

A `Behavior` provides a clean separation of concerns to your view logic,
allowing you to share common user-facing operations between your views.

Read More:
- [Using `Behavior`s](./marionette.behavior.md#using-behaviors)

## Managing Children

`View` provides a simple interface for managing child-views with
[`showChildView`](#showing-a-child-view), [`getChildView`](#accessing-a-child-view), and
[`detachChildView`](#detaching-a-child-view).
These methods all access `regions` within the view.
We will cover this here but for more advanced information, see the
[documentation for regions](./marionette.region.md).

### Laying Out Views - Regions

The `Marionette.View` class lets us manage a hierarchy of views using `regions`.
Regions are a hook point that lets us show views inside views, manage the
show/hide lifecycles, and act on events inside the children.

**This Section only covers the basics. For more information on regions, see the
[Regions Documentation.](./marionette.region.md)**

Regions are ideal for rendering application layouts by isolating concerns inside
another view. This is especially useful for independently re-rendering chunks
of your application without having to completely re-draw the entire screen every
time some data is updated.

Regions can be added to a View at class definition, with [`regions`](./marionette.region.md#defining-regions),
or at runtime using [`addRegion`](./marionette.region.md#adding-regions).

When you extend `View`, we use the `regions` attribute to point to the selector
where the new view will be displayed:

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template(`
    <div id="first-region"></div>
    <div id="second-region"></div>
    <div id="third-region"></div>
  `),
  regions: {
    firstRegion: '#first-region',
    secondRegion: '#second-region'
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/4e3qdgwr/)

When we show views in the region, the contents of `#first-region` and
`#second-region` will be replaced with the contents of the view we show. The
value in the `regions` hash is just a jQuery selector, and any valid jQuery
syntax will suffice.

### Showing a Child View

To show a view inside a region, simply call `showChildView(regionName, view)`. This
will handle rendering the view's HTML and attaching it to the DOM for you:

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';
import SubView from './subview';

const MyView = View.extend({
  template: _.template('<h1>Title</h1><div id="first-region"></div>'),

  regions: {
    firstRegion: '#first-region'
  },

  onRender() {
    this.showChildView('firstRegion', new SubView());
  }
});
```

Note: If `view.showChildView(region, subView)` is invoked before the `view` has been rendered, it will automatically render the `view` so the region's `el` exists in the DOM.

[Live example](https://jsfiddle.net/marionettejs/98u073m0/)

### Accessing a Child View

To access the child view of a `View` - use the `getChildView(regionName)` method.
This will return the view instance that is currently being displayed at that
region, or `null`:

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette'
import SubView from './subview';

const MyView = View.extend({
  template: _.template('<h1>Title</h1><div id="first-region"></div>'),

  regions: {
    firstRegion: '#first-region'
  },

  onRender() {
    this.showChildView('firstRegion', new SubView());
  },

  onSomeEvent() {
    const first = this.getChildView('firstRegion');
    first.doSomething();
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/b12kgq3t/)

If no view is available, `getChildView` returns `null`.

### Detaching a Child View

You can detach a child view from a region through `detachChildView(region)`

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette'
import SubView from './subview';

const MyView = View.extend({
  template: _.template(`
    <h1>Title</h1>
    <div id="first-region"></div>
    <div id="second-region"></div>
  `),
  regions: {
    firstRegion: '#first-region',
    secondRegion: '#second-region'
  },

  onRender() {
    this.showChildView('firstRegion', new SubView());
  },

  onMoveView() {
    const view = this.detachChildView('firstRegion');
    this.showChildView('secondRegion', view);
  }
});
```
This is a proxy for [region.detachView()](./marionette.region.md#detaching-existing-views)

### Destroying a Child View

There are two ways to easily destroy a child view.

```javascript
// Directly
myChildView.getChildView('regionName').destroy();

// Indirectly
myChildView.getRegion('regionName').empty();
```

### Region Availability

Any defined regions within a `View` will be available to the `View` or any
calling code immediately after rendering the `View`. Using `getRegion` or any
of the child view methods above will first render the view so that the region is
available.

## Efficient Nested View Structures

When your views get some more regions, you may want to think of the most
efficient way to render your views. Since manipulating the DOM is performance
heavy, it's best practice to render most of your views at once.

Marionette provides a simple mechanism to infinitely nest views in a single
paint: just render all of the children in the `onRender` callback for the
[`render` event](./events.class.md#render-and-beforerender-events).

```javascript
import { View } from 'backbone.marionette';

const ParentView = View.extend({
  // ...
  onRender() {
    this.showChildView('header', new HeaderView());
    this.showChildView('footer', new FooterView());
  }
});

myRegion.show(new ParentView());
```

In this example, the doubly-nested view structure will be rendered in a single paint.

This system is recursive, so it works for any deeply nested structure. The child
views you show can render their own child views within their onRender callbacks!

## Listening to Events on Children

Using regions lets you listen to the events that fire on child views - views
attached inside a region. This lets a parent view take action depending on what
events are triggered in views it directly owns.

Read More:
- [Child Event Bubbling](./events.md#event-bubbling)
