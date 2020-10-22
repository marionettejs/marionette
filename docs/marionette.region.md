# Marionette.Region

Regions provide consistent methods to manage, show and destroy
views in your applications and views.

`Region` includes:
- [Common Marionette Functionality](./common.md)
- [Class Events](./events.class.md#region-events)
- [The DOM API](./dom.api.md)

See the documentation for [laying out views](./marionette.view.md#laying-out-views---regions) for an introduction in
managing regions throughout your application.

Regions maintain the [View's lifecycle](./view.lifecycle.md) while showing or emptying a view.

## Documentation Index

* [Instantiating a Region](#instantiating-a-region)
* [Defining the Application Region](#defining-the-application-region)
* [Defining Regions](#defining-regions)
  * [String Selector](#string-selector)
  * [Additional Options](#additional-options)
  * [Specifying `regions` as a Function](#specifying-regions-as-a-function)
  * [Using a RegionClass](#using-a-regionclass)
  * [Referencing UI in `regions`](#referencing-ui-in-regions)
* [Adding Regions](#adding-regions)
* [Removing Regions](#removing-regions)
* [Using Regions on a view](#using-regions-on-a-view)
* [Showing a View](#showing-a-view)
  * [Checking whether a region is showing a view](#checking-whether-a-region-is-showing-a-view)
  * [Non-Marionette Views](#non-marionette-views)
    * [Partially-rendered Views](#partially-rendered-views)
* [Showing a Template](#showing-a-template)
* [Emptying a Region](#emptying-a-region)
  * [Preserving Existing Views](#preserving-existing-views)
  * [Detaching Existing Views](#detaching-existing-views)
* [`reset` A Region](#reset-a-region)
* [`destroy` A Region](#destroy-a-region)
* [Check If View Is Being Swapped By Another](#check-if-view-is-being-swapped-by-another)
* [Set How View's `el` Is Attached](#set-how-views-el-is-attached)
* [Configure How To Remove View](#configure-how-to-remove-view)

## Instantiating a Region

When instantiating a `Region` there are two properties, if passed,
that will be attached directly to the instance:
`el`, and `replaceElement`.

```javascript
import { Region } from 'backbone.marionette';

const myRegion = new Region({ ... });
```

While regions may be instantiated and useful on their own, their primary use case is through
the [`Application`](#defining-the-application-region) and [`View`](#defining-regions) classes.

## Defining the Application Region

The Application defines a single region `el` using the `region` attribute. This
can be accessed through `getRegion()` or have a view displayed directly with
`showView()`. Below is a short example:

```javascript
import { Application } from 'backbone.marionette';
import SomeView from './view';

const MyApp = Application.extend({
  region: '#main-content',

  onStart() {
    const mainRegion = this.getRegion();  // Has all the properties of a `Region`
    mainRegion.show(new SomeView());
  }
});
```

[Live example](http://jsfiddle.net/marionettejs/9fburmb8/)

For more information, see the
[Application docs](./marionette.application.md#application-region).

## Defining Regions

In Marionette you can define a region with a string selector or an object literal
on your `Application` or `View`. This section will document the two types as applied
to `View`, although they will work for `Application` as well - just replace `regions`
with `region` in your definition.

**Errors** An error will be thrown for an incorrect region configuration.

### String Selector

You can use a jQuery string selector to define regions.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  regions: {
    mainRegion: '#main'
  }
});
```

### Additional Options

You can define regions with an object literal. Object literal definitions expect
an `el` property - the selector string to hook the region into. With this
format is possible to define whether showing the region overwrites the `el` or
just overwrites the content (the default behavior).

To overwrite the parent `el` of the region with the rendered contents of the
inner View, use `replaceElement` as so:

```javascript
import { View } from 'backbone.marionette';

const OverWriteView = View.extend({
  className: '.new-class'
});

const MyView = View.extend({
  regions: {
    main: {
      el: '.overwrite-me',
      replaceElement: true
    }
  }
});
const view = new MyView();
view.render();

console.log(view.$('.overwrite-me').length); // 1
console.log(view.$('.new-class').length); // 0

view.showChildView('main', new OverWriteView());

console.log(view.$('.overwrite-me').length); // 0
console.log(view.$('.new-class').length); // 1
```

When the instance of `MyView` is rendered, the `.overwrite-me` element will be
removed from the DOM and replaced with an element of `.new-class` - this lets
us do things like rendering views inside `table` or `select` more easily -
these elements are usually very strict on what content they will allow.


```js
import { View } from 'backbone.marionette';

const MyView = View.extend({
  regions: {
    regionDefinition: {
      el: '.bar',
      replaceElement: true
    }
  }
});
```

**Errors** An error will be thrown in the regions `el` is not specified,
or if the `el` does not exist in the html.

### Specifying `regions` as a Function

On a `View` the `regions` attribute can also be a
[function returning an object](./basics.md#functions-returning-values):

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  regions(){
    return {
      firstRegion: '#first-region'
    };
  }
});
```

### Using a RegionClass

If you've created a custom region class, you can use it to define your region.

```javascript
import { Application, Region, View } from 'backbone.marionette';

const MyRegion = Region.extend({
  onShow(){
    // Scroll to the middle
    this.$el.scrollTop(this.currentView.$el.height() / 2 - this.$el.height() / 2);
  }
});

const MyApp = Application.extend({
  regionClass: MyRegion,
  region: '#first-region'
})

const MyView = View.extend({
  regionClass: MyRegion,
  regions: {
    firstRegion: {
      el: '#first-region',
      regionClass: Region // Don't scroll this to the top
    },
    secondRegion: '#second-region'
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/oLLrzx8g/)

### Referencing UI in `regions`

The UI attribute can be useful when setting region selectors - simply use
the `@ui.` prefix:

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  ui: {
    region: '#first-region'
  },
  regions: {
    firstRegion: '@ui.region'
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/ey1od1g8/)

## Adding Regions

To add regions to a view after it has been instantiated, simply use the
`addRegion` method:

```javascript
import MyView from './myview';

const myView = new MyView();
myView.addRegion('thirdRegion', '#third-region');
```

Now we can access `thirdRegion` as we would the others.

You can also add multiple regions using `addRegions`.

```javascript
import MyView from './myview';

const myView = new MyView();
myView.addRegions({
  main: {
    el: '.overwrite-me',
    replaceElement: true
  },
  sidebar: '.sidebar'
});
```

[Live example](http://jsfiddle.net/marionettejs/kjvzdyd6/)

## Removing Regions

You can remove all of the regions from a view by calling `removeRegions` or you can remove a
region by name using `removeRegion`. When a region is removed the region will be destroyed.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  regions: {
    main: '.main',
    sidebar: '.sidebar',
    header: '.header'
  }
});

const myView = new MyView();

// remove only the main region
const mainRegion = myView.removeRegion('main');

mainRegion.isDestroyed(); // -> true

// remove all regions
myView.removeRegions();
```

## Using Regions on a view

In addition to adding and removing regions there are a few
methods to help utilize regions. All of these methods will first
render an unrendered view so that regions are properly initialized.

- `getRegion(name)` - Request a region from a view by name.
- `getRegions()` - Returns an object literal of all regions on the view organized by name.
- `hasRegion(name)` - Check if a view has a region.
- `emptyRegions()` - Empty all of the regions on a view.

## Showing a View

Once a region is defined, you can call its `show` method to display the view:

```javascript
const myView = new MyView();
const childView = new MyChildView();
const mainRegion = myView.getRegion('main');

// render and display the view
mainRegion.show(childView, { fooOption: 'bar' });
```

This is equivalent to a view's `showChildView` which can be used as:

```javascript
const myView = new MyView();
const childView = new MyChildView();

// render and display the view
myView.showChildView('main', childView, { fooOption: 'bar' });
```

Both forms take an `options` object that will be passed to the
[events fired during `show`](./events.class.md#show-and-beforeshow-events).

For more information on `showChildView` and `getChildView`, see the
[Documentation for Views](./marionette.view.md#managing-children)

**Errors**
- An error will be thrown if the view is falsy or destroyed.
- An error will be thrown if the view is already shown in a Region or CollectionView.

### Checking whether a region is showing a view

If you wish to check whether a region has a view, you can use the `hasView`
function. This will return a boolean value depending whether or not the region
is showing a view.

```javascript
const myView = new MyView();
const mainRegion = myView.getRegion('main');

mainRegion.hasView() // false
mainRegion.show(new OtherView());
mainRegion.hasView() // true
```

If you show a view in a region with an existing view, Marionette will
[remove the existing View](#emptying-a-region) before showing the new one.

### Non-Marionette Views

Marionette Regions aren't just for showing Marionette Views - they can also
display instances of a [`Backbone.View`](http://backbonejs.org/#View).
To do this, ensure your view defines a `render()` method and just treat it like
a regular Marionette View:

```javascript
import _ from 'underscore';
import Bb from 'backbone';
import { View } from 'backbone.marionette';

const MyChildView = Bb.View.extend({
  render() {
    this.$el.append('<p>Some text</p>');
  },

  onRender() {
    console.log('Regions also fire Lifecycle events on Backbone.View!');
  }
});

const MyParentView = View.extend({
  regions: {
    child: '.child-view'
  },

  template: _.template('<div class="child-view"></div>'),

  onRender() {
    this.showChildView('child', new MyChildView());
  }
});
```

As you can see above, you can listen to [Lifecycle Events](./view.lifecycle.md)
on `Backbone.View` and Marionette will fire the events for you.

## Showing a Template

You can show a template or a string directly into a region. Additionally you can pass an object
literal containing a template and any other view options. Under the hood a `Marionette.View` is
instantiated using the template.

```javascript
const myView = new MyView();

myView.showChildView('main', {
  template: _.template('This is the <%- section %> page'),
  templateContext: { section: 'main' }
});

myView.showChildView('header', _.template('Welcome to the site'));

myView.getRegion('other').show('This text is in another region');
```

## Emptying a Region

You can remove a view from a region (effectively "unshowing" it) with
`region.empty()` on a region:

```javascript
const myView = new MyView();

myView.showChildView('main', new OtherView());
const mainRegion = myView.getRegion('main');
mainRegion.empty();
```

This will destroy the view, clean up any event handlers and remove it from
the DOM. When a region is emptied [empty events are triggered](./events.class.md#empty-and-beforeempty-events).

**NOTE** If the region does _not_ currently contain a View it will detach
any HTML inside the region when emptying. If the region _does_ contain a
View [any HTML that doesn't belong to the View will remain](./upgrade.md#changes-to-regionshow).

### Preserving Existing Views

If you replace the current view with a new view by calling `show`, it will
automatically destroy the previous view. You can prevent this behavior by
[detaching the view](#detaching-existing-views) before showing another one.

### Detaching Existing Views

If you want to detach an existing view from a region, use `detachView`.

```javascript
const myView = new MyView();

const myOtherView = new MyView();

const childView = new MyChildView();

// render and display the view
myView.showChildView('main', childView);

// ... somewhere down the line
myOtherView.showChildView('main', myView.getRegion('main').detachView());
```

**Note** When detaching a view you must pass it to a new region so Marionette
can handle its life cycle automatically or `destroy` it manually to prevent memory leaks.

## `reset` A Region

A region can be `reset` at any time. This destroys any existing view
being displayed, and deletes the cached `el`. The next time the
region shows a view, the region's `el` is queried from the DOM.

```javascript
const myView = new MyView();
myView.showChildView('main', new OtherView());
const myRegion = myView.getRegion('main');
myRegion.reset();
```

This can be useful in unit testing your views.

## `destroy` A Region

A region can be destroyed which will `reset` the region, remove it from any parent view,
and stop any internal region listeners. A destroyed region should not be reused.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  regions: {
    mainRegion: '#main'
  }
});

const myView = new MyView();

const myRegion = myView.getRegion('mainRegion');

myRegion.show(new ChildView());

myRegion.destroy();

myRegion.isDestroyed(); // true
myRegion.hasView(); // false
myView.hasRegion('mainRegion'); // false
```

## Check If View Is Being Swapped By Another

The `isSwappingView` method returns if a view is being swapped by another one. It's useful
inside region lifecycle events / methods.

The example will show an message when the region is empty:

```javascript
import { Region } from 'backbone.marionette';

const EmptyMsgRegion = Region.extend({
  onEmpty() {
    if (!this.isSwappingView()) {
      this.$el.append('Empty Region');
    }
  }
});
```
[Live example](https://jsfiddle.net/marionettejs/c1nacq0c/)

## Set How View's `el` Is Attached and Detached

Override the region's `attachHtml` method to change how the view is attached
to the DOM (when not using `replaceElement: true`. This method receives one
parameter - the view to show.

The default implementation of `attachHtml` is essentially:

```javascript
import { Region } from 'backbone.marionette';

Region.prototype.attachHtml = function(view){
  this.el.appendChild(view.el);
}
```

Similar to `attachHtml`, override `detachHtml` to determine how the region detaches
the contents from its `el`. This method receives no parameters.

For most cases you will want to use the [DOM API](./dom.api.md) to determine how
a region html is attached, but in some cases you may want to override a single Region
class for situations like animation where you want to control both attaching and
[view removal](#configure-how-to-remove-view).

This example will make a view slide down from the top of the screen instead of just
appearing in place:

```javascript
import { Region, View } from 'backbone.marionette';

const ModalRegion = Region.extend({
  attachHtml(view){
    // Some effect to show the view:
    this.$el.empty().append(view.el);
    this.$el.hide().slideDown('fast');
  }
});

const MyView = View.extend({
  regions: {
    mainRegion: '#main-region',
    modalRegion: {
      regionClass: ModalRegion,
      el: '#modal-region'
    }
  }
});
```

## Configure How To Remove View

Override the region's `removeView` method to change how and when the view is destroyed / removed
from the DOM. This method receives one parameter - the view to remove.

The default implementation of `removeView` is:

```javascript
import { Region } from 'backbone.marionette';

Region.prototype.removeView = function(view){
  this.destroyView(view);
}
```

> `destroyView` method destroys the view taking into consideration if is
> a Marionette.View descendant or vanilla Backbone view. It can be replaced
> by a `view.destroy()` call if is ensured that view descends from Marionette.View

This example will animate with a fade effect showing and hiding the view:

```javascript
import { Region, View } from 'backbone.marionette';

const AnimatedRegion = Region.extend({
  attachHtml(view) {
    view.$el
      .css({display: 'none'})
      .appendTo(this.$el);
    if (!this.isSwappingView()) view.$el.fadeIn('slow');
  },

  removeView(view) {
    view.$el.fadeOut('slow', () => {
      this.destroyView(view);
      if (this.currentView) this.currentView.$el.fadeIn('slow');
    });
  }
});

const MyView = View.extend({
  regions: {
    animatedRegion: {
      regionClass: AnimatedRegion,
      el: '#animated-region'
    }
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/qtvjLu70/)

Using a similar approach is possible to create a region animated with CSS:

[Live example](https://jsfiddle.net/marionettejs/8uoabg7c/)
