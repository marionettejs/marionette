# Upgrade Guide from v2 to v3

Marionette 3 introduces a number of breaking changes. This upgrade guide will go
through the major changes and describe how to change your application to
accommodate them.

An [upgrade tool](https://github.com/marionettejs/marionette-v3-compat) is available
and covers the breaking changes in detail.

Where possible, we will document how to make the changes in Marionette 2.x so
that your applications can continue to work and to ease the burden of upgrading
to Marionette 3.

You can run Marionette 3 alongside Marionette 2 with the Marionette.noConflict() function.

## Views

The most noticeable change to Marionette 3 is the consolidation of `ItemView`
and `LayoutView` into `View`. In addition, `CompositeView` has been removed and
its functionality merged into `CollectionView` and `View`.

### Removing `LayoutView` and `ItemView`

Using separate `View` `LayoutView` and `ItemView` was complicating the API for
Marionette needlessly. The new `View` replaces all of this and sets a clear
recommendation for building layout trees.

#### Upgrading for Marionette 2.x

For updating in Marionette 2.x, it is recommended you change all instances of
`ItemView` to `LayoutView`.

#### Upgrading to Marionette 3

Change all instances of `LayoutView` and `ItemView` to `View`. Any views that
previously extended `View` with a custom `render` should work relatively
unchanged.

### Removing `CompositeView`

The `CompositeView` was deprecated in favor of using `View` and
`CollectionView`. The `CompositeView` will be completely removed in Marionette
4.

See [`CollectionView`](./marionette.collectionview.md#rendering-collectionviews)
for detail on upgrading to Marionette 3. This technique works in both Marionette
2.x and Marionette 3.

### Removing `CollectionView.getChildView()`

The `getChildView` method has been removed in favor of the `childView` property,
[which now accepts a function](basics.md#functions-returning-values).

#### Upgrading to Marionette 3

Simply replace all instances of `getChildView` with `childView`.

### Removing `CollectionView.getEmptyView()`

The `getEmptyView` method has been removed in favor of the `emptyView` property,
[which now accepts a function](basics.md#functions-returning-values).

#### Upgrading to Marionette 3

Simply replace all instances of `getEmptyView` with `emptyView`.

### Child event handlers

The `childEvents` attribute was renamed to `childViewEvents`.

Child event bubbling above one level is now removed in most instances and
deprecated pending removal everywhere else. This can no longer be relied upon.
To pass events further up the chain, you must explicitly using
`childViewTriggers` to convert the event from the child into an event on the
parent. These can be chained all the way up to the level you require them to be.

Bubbled child events no longer pass the `childView` implicitly and only pass the
arguments passed as part of `triggerMethod`. This means that the arguments
passed to `onEvent` and `onChildviewEvent` are now identical. See the
[documentation on event lifecycles](./view.lifecycle.md) for more information.

In Marionette 2, `childEvents` were bound on every event. In Marionette 3,
`childViewEvents` are bound once and cached. This means that you cannot add new
events after the view has been created.

### View `triggers`

The view `triggers` attribute no longer passes an `options` attribute to event
handlers, instead passing the view instance that triggered the event.

## Events

A number of lifecycle events were changed or removed from Marionette 3.
Information on which ones were removed, changed, or added will be found here
with recommendations on how to update your code.

### `show` and `before:show`

The `show` events were removed completely as they were redundant and were being
used incorrectly to show child regions. The `show` event was fired after the
view had been attached, meaning the DOM was being constantly updated, leading to
deteriorated performance.

#### Upgrading for Marionette 2.x

Replace all instances of `onShow`, `on('show')`, `onBeforeShow` and
`on('before:show')` to use the `render` and `before:render` events. This is the
recommendation for Marionette 3 and ensures the DOM tree is built in-memory
before modifying the DOM.

#### Upgrading to Marionette 3

Replace all instances of `show` and `before:show` with `render` and
`before:render`. If you want the view to be visible in the DOM, then listen to
the `dom:refresh` event.

### Changes to `region.show()`

The `region.show()` method (that also backs `showChildView()`) was changed to
not remove HTML outside the `$el` of the displayed view. In Marionette 2,
the `region.show()` method would call `region.$el.empty()` before showing the
new HTML.

In Marionette 3, this was changed to unhook `region.currentView` from the DOM,
remove all event handlers, then delete it. Any HTML added to the region that
isn't contained in the DOM of the View won't be removed.

For example:

```javascript
var _ = require('underscore');
var Mn = require('backbone.marionette');

var app = require('./app');

var MyView = Mn.View.extend({
  template: _.template('View contents')
});

var ParentView = Mn.View.extend({
  template: _.template('<div class="view-hook"></div>'),
  regions: {
    child: '.view-hook'
  }
});

var parent = new ParentView();
app.showView(parent);

var child = new MyView();

parent.showChildView('child', child);
parent.getRegion('child').$el.append('<p>Not removed</p>');
parent.showChildView('child', new MyView());
```

In Marionette 2, the HTML output will be:

```html
<div class="view-hook">
  <div>View contents</div>
</div>
```

In Marionette 3, the HTML will be:

```html
<div class="view-hook">
  <p>Not Removed</p>
  <div>View contents</div>
</div>
```

### Arguments for Lifecycle Events

The arguments for a number of lifecycle events were changed. For consistency,
all events will now receive the view that is emitting the event as the first
argument. See the [documentation for view lifecycles](./view.lifecycle.md) for
more complete information.

#### Upgrading to Marionette 3

The following events, with their accompanying `before:` event were changed and
may need to be updated:

|      Class       |              Event               |
|------------------|----------------------------------|
|     `Object`     |           `destroy`              |
|     `Region`     |            `show`                |
|      `View`      | `add:region` and `remove:region` |
| `CollectionView` |  `add:child` and `remove:child`  |
|   `Application`  |            `start`               |

## Templates

The biggest change to templates is renaming `templateHelpers` to
`templateContext` - the aim is to be more in-line with terminology from other
frameworks.

### Upgrading to Marionette 3

Simply replace all instances of `templateHelpers` with `templateContext`

## Regions

There are a number of changes to how regions behave - the biggest change being
the removal of the ability to access regions as attributes

### Removing `view.region`

The `view.<region_name>` syntax has been removed in favor of `view.getRegion()`,
`view.getChildView()` and `view.showChildView()`.

#### Upgrading for Marionette 2.x

Change all references to `view.region` to `view.getRegion('region')`. For
example, in Mn 2.x and below:

```javascript
var AnotherView = require('./anotherview');

var MyView = Mn.LayoutView.extend({
  regions: {
    myregion: '.regionname'
  },

  onRender: function() {
    this.myregion.show(new AnotherView());
  }
});
```

This does not work in Mn 3 - instead do:

```javascript
var AnotherView = require('./anotherview');

/* In Mn 2.x we can just use LayoutView */
var MyView = Mn.View.extend({
  regions: {
    myregion: '.regionname'
  },

  onRender: function() {
    this.showChildView('myregion', new AnotherView());
  }
});
```

See the documentation for [views](marionette.view.md#laying-out-views---regions)
to learn more about how to manage regions in Marionette 3.

## Modules

Marionette Modules have been completely removed in favor of using the more
standard JavaScript module loaders e.g.
[Webpack](./installation.md#quick-start-using-npm-and-webpack) or
[Browserify](./installation.md#quick-start-using-npm-and-browserify). See the
[installation](./installation.md) documentation for a list of potential options.

## Backbone.Babysitter

The dependency on `Backbone.Babysitter` has been removed in favour of an
in-built implementation that is maintained within the main Marionette codebase.

BabySitter provides a simple way to manage child views in Backbone/Marionette or
any object that manages lists of views. The external Babysitter library was used
in Marionette to manage the `CollectionView` children.

### Main Differences

The main difference between Babysitter and the Marionette implementation is the
removal of `.call` and `.apply` on `CollectionView.children`. Instead you should
use `.invoke` or
[any of the methods provided](./marionette.collectionview.md#collectionview-childview-iterators-and-collection-functions).

For example:

```javascript
var MyCollectionView = require('./views');
var MyCollection = require('./collections');

var collection = new MyCollection();
collection.fetch();

var myView = new MyCollectionView({collection: collection});
myView.children.invoke('render');
myView.children.map(function(view) {
  view.doMethod();
});
```
