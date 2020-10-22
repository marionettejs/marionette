# Marionette.CollectionView

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

A `CollectionView` can have [`Behavior`s](./marionette.behavior.md).

## Documentation Index

* [Instantiating a CollectionView](#instantiating-a-collectionview)
* [Rendering a CollectionView](#rendering-a-collectionview)
  * [Rendering a Template](#rendering-a-template)
  * [Defining the `childViewContainer`](#defining-the-childviewcontainer)
  * [Re-rendering the CollectionView](#re-rendering-the-collectionview)
* [View Lifecycle and Events](#view-lifecycle-and-events)
* [Entity Events](#entity-events)
* [DOM Interactions](#dom-interactions)
* [Behaviors](#behaviors)
* [Managing Children](#managing-children)
  * [Attaching `children` within the `el`](#attaching-children-within-the-el)
  * [Destroying All `children`](#destroying-all-children)
* [CollectionView's `childView`](#collectionviews-childview)
  * [Building the `children`](#building-the-children)
  * [Passing Data to the `childView`](#passing-data-to-the-childview)
* [CollectionView's `emptyView`](#collectionviews-emptyview)
  * [CollectionView's `getEmptyRegion`](#collectionviews-getemptyregion)
  * [Passing Data to the `emptyView`](#passing-data-to-the-emptyview)
  * [Defining When an `emptyView` shows](#defining-when-an-emptyview-shows)
* [Accessing a Child View](#accessing-a-child-view)
  * [CollectionView `children` Iterators And Collection Functions](collectionview-children-iterators-and-collection-functions)
* [Listening to Events on the `children`](#listening-to-events-on-the-children)
* [Self Managed `children`](#self-managed-children)
  * [Adding a Child View](#adding-a-child-view)
  * [Removing a Child View](#removing-a-child-view)
  * [Detaching a Child View](#detaching-a-child-view)
  * [Swapping Child Views](#swapping-child-views)
* [Sorting the `children`](#sorting-the-children)
  * [Defining the `viewComparator`](#defining-the-viewcomparator)
  * [Maintaining the `collection`'s sort](#maintaining-the-collections-sort)
* [Filtering the `children`](#filtering-the-children)
  * [Defining the `viewFilter`](#defining-the-viewfilter)

## Instantiating a CollectionView

When instantiating a `CollectionView` there are several properties, if passed,
that will be attached directly to the instance:
`attributes`, `behaviors`, `childView`, `childViewContainer`, `childViewEventPrefix`,
`childViewEvents`, `childViewOptions`, `childViewTriggers`, `className`, `collection`,
`collectionEvents`, `el`, `emptyView`, `emptyViewOptions`, `events`, `id`, `model`,
`modelEvents`, `sortWithCollection`, `tagName`, `template`, `templateContext`,
`triggers`, `ui`, `viewComparator`, `viewFilter`

```javascript
import { CollectionView } from 'backbone.marionette';

const myCollectionView = new CollectionView({ ... });
```

Some of these properties come from Marionette, but many are inherited from
[`Backbone.View`](http://backbonejs.org/#View-constructor).

## Rendering a CollectionView

The `render` method of the `CollectionView` is primarily responsible
for rendering the entire collection. It loops through each of the
children in the collection and renders them individually as a
`childView`.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({...});

// all of the children views will now be rendered.
new MyCollectionView().render();
```

### Rendering a Template

In addition to rendering children, the `CollectionView` may have a
`template`.  The child views can be rendered within a DOM element of
this template. The `CollectionView` will serialize either the `model`
or `collection` along with context for the `template` to render.

For more detail on how to render templates, see
[View Template Rendering](./view.rendering.md).

### Defining the `childViewContainer`

By default the `CollectionView` will render the children into the `el`
of the `CollectionView`. If you are rendering a template you will want
to set the `childViewContainer` to be a selector for an element within
the template for child view attachment.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  childViewContainer: '.js-widgets',
  template: _.template('<h1>Widgets</h1><ul class="js-widgets"></ul>')
});
```

**Errors** An error will throw if the childViewContainer can not be found.

### Re-rendering the CollectionView

If you need to re-render the entire collection or the template, you can call the
`collectionView.render` method. This method will destroy all of
the child views that may have previously been added.

## View Lifecycle and Events

An instantiated `CollectionView` is aware of its lifecycle state and will throw events related
to when that state changes. The view states indicate whether the view is rendered, attached to
the DOM, or destroyed.

Read More:
- [View Lifecycle](./view.lifecycle.md)
- [View DOM Change Events](./events.class.md#dom-change-events)
- [View Destroy Events](./events.class.md#destroy-events)

## Entity Events

The `CollectionView` can bind to events that occur on the attached `model` and `collection` - this
includes both [standard backbone-events](http://backbonejs.org/#Events-catalog) and custom events.

Read More:
- [Entity Events](./events.entity.md)

## DOM Interactions

In addition to what Backbone provides the views, Marionette has additional API
for DOM interactions: `events`, `triggers`, and `ui`.

By default `ui` is only bound to the elements within the [template](#rendering-a-template).
However as `events` and `triggers` are delegated to the view's `el` they will apply to any children.
There may be instances where binding `ui` is helpful when you want to access elements inside
`CollectionView`s children with [`getUI()`](./dom.interactions.md#accessing-ui-elements). For these
cases you will need to bind `ui` yourself. To do so run `bindUIElements` on the `CollectionView`:

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  // ...

  ui: {
    checkbox: 'input[type="checkbox"]'
  }
});

const collectionView = new MyCollectionView();

collectionView.bindUIElements();

console.log(collectionView.getUI('checkbox')); // Output all checkboxes.
```

Read More:
- [DOM Interactions](./dom.interactions.md)

## Behaviors

A `Behavior` provides a clean separation of concerns to your view logic,
allowing you to share common user-facing operations between your views.

Read More:
- [Using `Behavior`s](./marionette.behavior.md#using-behaviors)

## Managing Children

Children are automatically managed once the `CollectionView` is
[rendered](#rendering-a-collectionview). For each model within the
`collection` the `CollectionView` will build and store a `childView`
within its `children` object. This allows you to easily access
the views within the collection view, iterate them, find them by
a given indexer such as the view's model or id and more.

After the initial `render` the `CollectionView` binds to the `update`
and `reset` events of the `collection`.

When the `collection` for the view is `reset`, the view will destroy all
children and re-render the entire collection.

When a model is added to the `collection`, the `CollectionView` will render that
one model into the `children`.

When a model is removed from the `collection` (or destroyed / deleted), the `CollectionView`
will destroy and remove that model's child view.

When the `collection` for the view is sorted, the view by default automatically re-sorts
its child views unless the `sortWithCollection` attribute on the `CollectionView` is set
to `false`, or the `viewComparator` is `false`.

```javascript
import Backbone from 'backbone';
import { View, CollectionView } from 'backbone.marionette';

const collection = new Backbone.Collection();

const MyChildView = View.extend({
  template: false
});

const MyCollectionView = CollectionView.extend({
  childView: MyChildView,
  collection,
});

const myCollectionView = new MyCollectionView();

// Collection view will not re-render as it has not been rendered
collection.reset([{foo: 'foo'}]);

myCollectionView.render();

// Collection view will effectively re-render displaying the new model
collection.reset([{foo: 'bar'}]);
```

When the children are rendered the
[`render:children` and `before:render:children` events](./events.class.md#renderchildren-and-beforerenderchildren-events)
will trigger.

When a childview is added to the children
[`add:child` and `before:add:child` events](./events.class.md#addchild-and-beforeaddchild-events)
will trigger

When a childview is removed from the children
[`remove:child` and `before:remove:child` events](./events.class.md#removechild-and-beforeremovechild-events)
will trigger.

### Attaching `children` within the `el`

By default the `CollectionView` will add the HTML of each ChildView
into an element buffer array, and then call the DOM API's
[appendContents](./dom.api.md#appendcontentsel-contents) once at the end
to move all of the HTML within the collection view's `el`.

You can override this by specifying an `attachHtml` method in your
view definition. This method takes two parameters and has no return value.

```javascript
import { CollectionView } from 'backbone.marionette';

CollectionView.extend({

  // The default implementation:
  attachHtml(els, $container){
    // Unless childViewContainer, $container === this.$el
    this.Dom.appendContents(this.el, els);
  }
});
```

The first parameter is the HTML buffer, and the second parameter
is the expected container for the children which by default equates
to the view's `el` unless a [`childViewContainer`](#defining-the-childViewContainer)
is set.

### Destroying All `children`

`CollectionView` implements a `destroy` method which automatically
destroys its children and cleans up listeners.

When the children are destroyed the
[`destroy:children` and `before:destroy:children` events](./events.class.md#destroychildren-and-beforedestroychildren-events)
will trigger.

Read More:
- [View Destroy Events](./events.class.md#destroy-events)

## CollectionView's `childView`

When using a `collection` to manage the children of `CollectionView`,
specify a `childView` for your `CollectionView`. This must be
a Backbone view class definition, not an instance. It can be any
`Backbone.View` related class including both Marionette's `View` and
`CollectionView`.

```javascript
import { View, CollectionView } from 'backbone.marionette';

const MyChildView = View.extend({});

const MyCollectionView = CollectionView.extend({
  childView: MyChildView
});
```

**Errors** If you do not specify a `childView`, an exception will be thrown
stating that you must specify a `childView`.

You can also define `childView` as a function. In this form, the value
returned by this method is the `ChildView` class that will be instantiated
when a `Model` needs to be initially rendered. This method also gives you
the ability to customize per `Model` `ChildViews`.

```javascript
import _ from 'underscore';
import Backbone from 'backbone';
import { View, CollectionView } from 'backbone.marionette';

const FooView = View.extend({
  template: _.template('foo')
});

const BarView = View.extend({
  bar
});

const MyCollectionView = CollectionView.extend({
  collection: new Backbone.Collection(),
  childView(item) {
    // Choose which view class to render,
    // depending on the properties of the item model
    if  (item.get('isFoo')) {
      return FooView;
    }
    else {
      return BarView;
    }
  }
});

const collectionView = new MyCollectionView();

const foo = new Backbone.Model({
  isFoo: true
});

const bar = new Backbone.Model({
  isFoo: false
});

// Renders a FooView
collectionView.collection.add(foo);

// Renders a BarView
collectionView.collection.add(bar);
```

**Errors** If `childView` is a function that does not return a view class
an error will be thrown.

### Building the `children`

The `buildChildView` method is responsible for taking the ChildView class and
instantiating it with the appropriate data. This method takes three
parameters and returns a view instance to be used as the child view.

```javascript
buildChildView(child, ChildViewClass, childViewOptions){
  // build the final list of options for the childView class
  const options = _.extend({model: child}, childViewOptions);
  // create the child view instance
  const view = new ChildViewClass(options);
  // return it
  return view;
},
```

Override this method when you need a more complicated build, but use [`childView`](#collectionviews-childview)
if you need to determine _which_ View class to instantiate.

```javascript
import _ from 'underscore';
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';
import MyListView from './my-list-view';
import MyView from './my-view';

const MyCollectionView = CollectionView.extend({
  childView(child) {
    if (child.get('type') === 'list') {
      return MyListView;
    }

    return MyView;
  },
  buildChildView(child, ChildViewClass, childViewOptions) {
    const options = {};

    if (child.get('type') === 'list') {
      const childList = new Backbone.Collection(child.get('list'));
      options = _.extend({collection: childList}, childViewOptions);
    } else {
      options = _.extend({model: child}, childViewOptions);
    }

    // create the child view instance
    const view = new ChildViewClass(options);
    // return it
    return view;
  }
});
```

### Passing Data to the `childView`

There may be scenarios where you need to pass data from your parent
collection view in to each of the childView instances. To do this, provide
a `childViewOptions` definition on your collection view as an object
literal. This will be passed to the constructor of your childView as part
of the `options`.

```javascript
import { View, CollectionView } from 'backbone.marionette';

const ChildView = View.extend({
  initialize(options) {
    console.log(options.foo); // => "bar"
  }
});

const MyCollectionView = CollectionView.extend({
  childView: ChildView,

  childViewOptions: {
    foo: 'bar'
  }
});
```

You can also specify the `childViewOptions` as a function, if you need to
calculate the values to return at runtime. The model will be passed into
the function should you need access to it when calculating
`childViewOptions`. The function must return an object, and the attributes
of the object will be copied to the `childView` instance's options.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  childViewOptions(model) {
    // do some calculations based on the model
    return {
      foo: 'bar'
    };
  }
});
```

## CollectionView's `emptyView`

When a collection has no children, and you need to render a view other than
the list of childViews, you can specify an `emptyView` attribute on your
collection view. The `emptyView` just like the [`childView`](#collectionviews-childview) can also be passed as an option on instantiation or can be a
function that returns the `emptyView`.

```javascript
import _ from 'underscore';
import { View, CollectionView } from 'backbone.marionette';

const MyEmptyView = View.extend({
  template: _.template('Nothing to display.')
});

const MyCollectionView = CollectionView.extend({
  // ...

  emptyView: MyEmptyView
});
```

### CollectionView's `getEmptyRegion`

When a `CollectionView` is instantiated it creates a region for showing the [`emptyView`](#collectionviews-emptyview).
This region can be requested using the `getEmptyRegion` method. The region will share the `el` with the `CollectionView`
and is shown with [`replaceElement: false`](./marionette.region.md#additional-options).

**Note** The `CollectionView` expects to be the only entity managing the region.
Showing things in this region directly is not advised.

```javascript
const isEmptyShowing = myCollectionView.getEmptyRegion().hasView();
```

This region can be useful for handling the
[EmptyView Region Events](./events.class.md#collectionview-emptyview-region-events).

### Passing Data to the `emptyView`

Similar to [`childView`](#collectionviews-childview) and [`childViewOptions`](#padding-data-to-the-childview),
there is an `emptyViewOptions` property that will be passed to the `emptyView` constructor.
It can be provided as an object literal or as a function.

If `emptyViewOptions` aren't provided the `CollectionView` will default to passing the `childViewOptions` to the `emptyView`.

```javascript
import { View, CollectionView } from 'backbone.marionette';

const EmptyView = View.extend({
  initialize(options){
    console.log(options.foo); // => "bar"
  }
});

const MyCollectionView = CollectionView.extend({
  emptyView: EmptyView,

  emptyViewOptions: {
    foo: 'bar'
  }
});
```

### Defining When an `emptyView` shows

If you want to control when the empty view is rendered, you can override
`isEmpty`:

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  isEmpty() {
    // some logic to calculate if the view should be rendered as empty
    return this.collection.length < 2;
  }
});
```

The default implementation of `isEmpty` returns `!this.children.length`.

You can also use this method to determine when the empty view was shown:

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  // ...
  onRenderChildren() {
    if (this.isEmpty()) { console.log('Empty View Shown'); }
  }
});
```

## Accessing a Child View

You can retrieve a view by a number of methods. If the findBy* method cannot find the view,
it will return `undefined`.

**Note** That `children` represents the views rendered that are or will be
attached within the view's `el`.

#### CollectionView `children`'s: `findByCid`
Find a view by its cid.

```javascript
const bView = myCollectionView.children.findByCid(buttonView.cid);
```

#### CollectionView `children`'s: `findByModel`
Find a view by model.

```javascript
const bView = myCollectionView.children.findByModel(buttonView.model);
```

#### CollectionView `children`'s: `findByModelCid`
Find a view by model cid.

```javascript
const bView = myCollectionView.children.findByModelCid(buttonView.model.cid);
```

#### CollectionView `children`'s: `findByIndex`

Find by numeric index (unstable)

```javascript
const bView = myCollectionView.children.findByIndex(0);
```

#### CollectionView `children`'s: `findIndexByView`

Find the index of the view inside the children

```javascript
const index = myCollectionView.children.findIndexByView(bView);
```

### CollectionView `children` Iterators And Collection Functions

The container object borrows several functions from
[Underscore.js](http://underscorejs.org/), to provide iterators and other
collection functions, including:

* [each](http://underscorejs.org/#each)
* [map](http://underscorejs.org/#map)
* [reduce](http://underscorejs.org/#reduce)
* [find](http://underscorejs.org/#find)
* [filter](http://underscorejs.org/#filter)
* [reject](http://underscorejs.org/#reject)
* [every](http://underscorejs.org/#every)
* [some](http://underscorejs.org/#some)
* [contains](http://underscorejs.org/#contains)
* [invoke](http://underscorejs.org/#invoke)
* [toArray](http://underscorejs.org/#toArray)
* [first](http://underscorejs.org/#first)
* [initial](http://underscorejs.org/#initial)
* [rest](http://underscorejs.org/#rest)
* [last](http://underscorejs.org/#last)
* [without](http://underscorejs.org/#without)
* [isEmpty](http://underscorejs.org/#isEmpty)
* [pluck](http://underscorejs.org/#pluck)
* [partition](http://underscorejs.org/#partition)

These methods can be called directly on the container, to iterate and process
the views held by the container.

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';

const collectionView = new CollectionView({
  collection: new Backbone.Collection()
});

collectionView.render();

// iterate over all of the views and process them
collectionView.children.each(function(childView) {
  // process the `childView` here
});
```

## Listening to Events on the `children`

The `CollectionView` can take action depending on what
events are triggered in its `children`.

Read More:
- [Child Event Bubbling](./events.md#event-bubbling)

## Self-Managed `children`

In addition to children added by Marionette matching the model of a `collection`,
the `children` of the `CollectionView` can be manually managed.

### Adding a Child View

The `addChildView` method can be used to add a view that is independent of your
`Backbone.Collection`. This method takes three parameters, the child view instance,
optionally the index for where it should be placed within the
[CollectionView's `children`](#managing-children), and an options hash.
It returns the added view.

```javascript
import { CollectionView } from 'backbone.marionette';
import ButtonView from './button-view';

const MyCollectionView = CollectionView.extend({
  onRender() {
    View = new ButtonView();
    this.addChildView(buttonView, this.children.length);
  }
});

const myCollectionView = new MyCollectionView();

myCollectionView.render();
```
**Note** Unless an index is specified, this added view will be subject to filtering
and sorting and may be difficult to manage in complex situations. Use with care.

**Errors** An error will be thrown if the view is already shown in a Region or CollectionView.

#### `preventRender` option

If you wish to add a child view to the children without the collectionview rendering
the children use the `preventRender` option.

```javascript
import { CollectionView } from 'backbone.marionette';
import ButtonView from './button-view';

const myCollectionView = new CollectionView({...});

const insertIndex = 0; // Add to the top

myCollectionView.addChildView(new ButtonView(), { preventRender: true, index: insertIndex });
myCollectionView.addChildView(new ButtonView(), insertIndex, { preventRender: true });
myCollectionView.addChildView(new ButtonView());  // renders all three children
```

### Removing a Child View

The `removeChildView` method is useful if you need to remove and destroy a view from
the `CollectionView` without affecting the view's collection.  In most cases it is
better to use the data to determine what the `CollectionView` should display.

This method accepts the child view instance to remove as its parameter. It returns
the removed view.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  onChildViewFooEvent(childView, model) {
    // NOTE: we must wait for the server to confirm
    // the destroy PRIOR to removing it from the collection
    model.destroy({wait: true});

    // but go ahead and remove it visually
    this.removeChildView(childView);
  }
});
```

### Detaching a Child View

The `detachChildView` method is the same as [`removeChildView`](#removing-a-child-view)
with the exception that the removed view is not destroyed.

### Swapping Child Views

Swap the location of two views in the `CollectionView` `children` and in the `el`.
This can be useful when sorting is arbitrary or is not performant.

**Errors** If either of the two views aren't part of the `CollectionView` an error will be thrown.

If one child is in the `el` but the other is not, [filter](#filtering-the-children) will be called.

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';
import MyChildView from './my-child-view';

const collection = new Backbone.Collection([
  { name: 'first' },
  { name: 'middle' },
  { name: 'last' }
]);

const myColView = new CollectionView({
  collection: collection,
  childView: MyChildView
});

myColView.swapChildViews(myColView.children.first(), myColView.children.last());

myColView.children.first().model.get('name'); // "last"
myColView.children.last().model.get('name'); // "first"
```

## Sorting the `children`

The `sort` method will loop through the `CollectionView` `children` prior to filtering
and sort them with the [`viewComparator`](#defining-the-viewcomparator).
By default, if a `viewComparator` is not set, the `CollectionView` will sort
the views by the order of the models in the `collection`. If set to `false` view
sorting will be disabled.

This method is called internally when rendering and
[`sort` and `before:sort` events](./events.class.md#sort-and-beforesort-events)
will trigger.

By default the `CollectionView` will maintain a sorted collection's order
in the DOM. This behavior can be disabled by specifying `{sortWithCollection: false}`
on initialize.

### Defining the `viewComparator`

`CollectionView` allows for a custom `viewComparator` option if you want your
`CollectionView`'s children to be rendered with a different sort order than the
underlying Backbone collection uses.

```javascript
import { CollectionView } from 'backbone.marionette';

const myCollectionView = new CollectionView({
  collection: someCollection,
  viewComparator: 'otherFieldToSortOn'
});
```

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';

const myCollection = new Backbone.Collection([
  { id: 1 },
  { id: 4 },
  { id: 3 },
  { id: 2 }
]);

myCollection.comparator = 'id';

const mySortedColView = new CollectionView({
  //...
  collection: myCollection
});

const myUnsortedColView = new CollectionView({
  //...
  collection: myCollection,
  viewComparator: false
});

mySortedColView.render(); // 1 4 3 2
myUnsortedColView.render(); // 1 4 3 2

myCollection.sort();
// mySortedColView auto-renders 1 2 3 4
// myUnsortedColView has no change
```

The `viewComparator` can take any of the acceptable `Backbone.Collection`
[comparator formats](http://backbonejs.org/#Collection-comparator) -- a sortBy
(pass a function that takes a single argument), as a sort (pass a comparator
function that expects two arguments), or as a string indicating the attribute to
sort by.

#### `getComparator`

Override this method to determine which `viewComparator` to use.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  sortAsc(model) {
    return -model.get('order');
  },
  sortDesc(model) {
    return model.get('order');
  },
  getComparator() {
    // The collectionView's model
    if (this.model.get('sorted') === 'ASC') {
      return this.sortAsc;
    }

    return this.sortDesc;
  }
});
```

#### `setComparator`

The `setComparator` method modifies the `CollectionView`'s `viewComparator`
attribute and re-sorts. Passing `{ preventRender: true }` in the options argument
will prevent the view being rendered.

```javascript
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  collection: someCollection
});

cv.render();

// Note: the setComparator is preventing the automatic re-render
cv.setComparator('orderBy', { preventRender: true });

// Render the children ordered by the orderBy attribute
cv.render();
```

#### `removeComparator`

This function is actually an alias of `setComparator(null, options)`. It is useful
for removing the comparator. `removeComparator` also accepts `preventRender` as a option.

```javascript
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  collection: someCollection
});

cv.render();

cv.setComparator('orderBy');

//Remove the current comparator without rendering again.
cv.removeComparator({ preventRender: true });
```

### Maintaining the `collection`'s sort

By default the `CollectionView` will maintain a sorted collection's order
in the DOM. This behavior can be disabled by specifying `{sortWithCollection: false}`
on initialize or on the view definiton.

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';

const myCollection = new Backbone.Collection([
  { id: 1 },
  { id: 4 },
  { id: 3 },
  { id: 2 }
]);

myCollection.comparator = 'id';

const mySortedColView = new CollectionView({
  //...
  collection: myCollection
});

const myUnsortedColView = new CollectionView({
  //...
  collection: myCollection,
  sortWithCollection: false
});

mySortedColView.render(); // 1 4 3 2
myUnsortedColView.render(); // 1 4 3 2

myCollection.sort();
// mySortedColView auto-renders 1 2 3 4
// myUnsortedColView has no change
```

## Filtering the `children`

The `filter` method will loop through the `CollectionView`'s sorted `children`
and test them against the [`viewFilter`](#defining-the-viewfilter).
The views that pass the `viewFilter`are rendered if necessary and attached
to the CollectionView and the views that are filtered out will be detached.
After filtering the `children` will only contain the views to be attached.

If a `viewFilter` exists the
[`filter` and `before:filter` events](./events.class.md#filter-and-beforefilter-events)
will trigger.

By default the CollectionView will refilter when views change or when the
CollectionView is sorted.

**Note** This is a presentation functionality used to easily filter in and out
constructed children. All children of a `collection` will be instantiated once
regardless of their filtered status. If you would prefer to manage child view
instantiation, you should filter the `collection` itself.

### Defining the `viewFilter`

`CollectionView` allows for a custom `viewFilter` option if you want to prevent
some of the underlying `children` from being attached to the DOM.
A `viewFilter` can be a function, predicate object. or string.

**Errors** An error will be thrown if the `ViewFilter` is not one of these options.

#### `viewFilter` as a function

The `viewFilter` function takes a view from the `children` and returns a truthy
value if the child should be attached, and a falsey value if it should not.

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  childView: SomeChildView,
  emptyView: SomeEmptyView,
  collection: new Bb.Collection([
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 }
  ]),

  // Only show views with even values
  viewFilter(view, index, children) {
    return view.model.get('value') % 2 === 0;
  }
});

// renders the views with values '2' and '4'
cv.render();
```

#### `viewFilter` as a predicate object

The `viewFilter` predicate object will filter against the view's model attributes.

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  childView: SomeChildView,
  emptyView: SomeEmptyView,
  collection: new Bb.Collection([
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 }
  ]),

  // Only show views with value 2
  viewFilter: { value: 2 }
});

// renders the view with values '2'
cv.render();
```

#### `viewFilter` as a string

The `viewFilter` string represents the view's model attribute and will filter
truthy values.

```javascript
import Backbone from 'backbone';
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  childView: SomeChildView,
  emptyView: SomeEmptyView,
  collection: new Bb.Collection([
    { value: 0 },
    { value: 1 },
    { value: 2 },
    { value: null },
    { value: 4 }
  ]),

  // Only show views 1,2, and 4
  viewFilter: 'value'
});

// renders the view with values '1', '2', and '4'
cv.render();
```

#### `getFilter`

Override this function to programatically decide which
`viewFilter` to use when `filter` is called.

```javascript
import { CollectionView } from 'backbone.marionette';

const MyCollectionView = CollectionView.extend({
  summaryFilter(view) {
    return view.model.get('type') === 'summary';
  },
  getFilter() {
    if (this.collection.length > 100) {
      return this.summaryFilter;
    }
    return this.viewFilter;
  }
});
```

#### `setFilter`

The `setFilter` method modifies the `CollectionView`'s `viewFilter` attribute and filters.
Passing `{ preventRender: true }` in the options argument will prevent the view
being rendered.

```javascript
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  collection: someCollection
});

cv.render();

const newFilter = function(view, index, children) {
  return view.model.get('value') % 2 === 0;
};

// Note: the setFilter is preventing the automatic re-render
cv.setFilter(newFilter, { preventRender: true });

// Render the new state of the ChildViews instead of the whole DOM.
cv.render();
```

#### `removeFilter`

This function is actually an alias of `setFilter(null, options)`. It is useful
for removing filters. `removeFilter` also accepts `preventRender` as a option.

```javascript
import { CollectionView } from 'backbone.marionette';

const cv = new CollectionView({
  collection: someCollection
});

cv.render();

cv.setFilter(function(view, index, children) {
  return view.model.get('value') % 2 === 0;
});

// Remove the current filter without rendering again.
cv.removeFilter({ preventRender: true });
```
