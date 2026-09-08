# Marionette.Region

A `Region` gives a changing part of the screen a place to live. Show a view,
replace it with another, or empty the Region when that part of the interface
is no longer needed. By default, replacing or emptying a view destroys it;
the Region remains available for the next view.

`Region` includes:
- [Common Marionette Functionality](./common.md)
- [Class Events](./events.class.md#region-events)
- [The DOM API](./dom.api.md)

See the documentation for [laying out views](./marionette.view.md#laying-out-views---regions) for an introduction in
managing regions throughout your application.

Regions maintain the [View's lifecycle](./view.lifecycle.md) while showing or emptying a view.

## Documentation Index

* [Instantiating a Region](#instantiating-a-region)
* [Reading Region ownership](#reading-region-ownership)
* [Lifecycle transition contract](#lifecycle-transition-contract)
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
  * [Wrapping a non-Marionette view](#wrapping-a-non-marionette-view)
* [Emptying a Region](#emptying-a-region)
  * [Preserving Existing Views](#preserving-existing-views)
  * [Detaching Existing Views](#detaching-existing-views)
* [`reset` A Region](#reset-a-region)
* [`destroy` A Region](#destroy-a-region)
* [Check If View Is Being Swapped By Another](#check-if-view-is-being-swapped-by-another)
* [Set How View's `el` Is Attached and Detached](#set-how-views-el-is-attached-and-detached)
* [Configure How To Remove View](#configure-how-to-remove-view)

## Instantiating a Region

A `Region` accepts `el`, `parentEl`, `allowMissingEl`, and `replaceElement`.
`el` is a native element or a selector; selector resolution is deferred until an
operation needs the element. `parentEl` limits selector lookup and may be an
element, document, or function returning one. `allowMissingEl` and
`replaceElement` may also be functions; a boolean supplied to `show(view,
options)` overrides the corresponding Region setting for that call.

```javascript
import { Region } from 'marionette';

const myRegion = new Region({ el: '#content' });
```

While regions may be instantiated and useful on their own, their primary use case is through
the [`Application`](#defining-the-application-region) and [`View`](#defining-regions) classes.

## Reading Region ownership

A Region registered on a View exposes that existing relationship through pure,
read-only queries. `getOwner()` returns the owning View and `getName()` returns
the Region's name within that View. Neither query renders the View, resolves the
Region element, or changes ownership. A standalone Region returns `undefined`
from both methods. Removing a registered Region or completing its destruction
clears both values. A throwing lifecycle hook interrupts teardown without
rolling back ownership or retrying destruction.

A Region has one authoritative registration. Re-adding that same Region instance
under its current owner and name returns it without lifecycle events or ownership changes.
Registering it under a different owner or name, registering a Region whose
destruction has begun or completed, or replacing an occupied Region name through
`addRegion` throws [`MN0030`](/errors/MN0030/) before committing the conflicting
registration. A conflict found before `addRegions` starts rejects the whole batch.
Lifecycle hooks must not re-register the Region or occupy its registration name
while registration is in progress. Failed batch registration is not rolled back.
Remove an existing named Region before replacing it, and use a fresh Region instance
when another View needs a Region.

```javascript
const contentRegion = myView.getRegion('content');

contentRegion.getOwner() === myView; // true
contentRegion.getName(); // 'content'
```

## Lifecycle transition contract

A Region owns at most one current View. Its public lifecycle
state can be read without changing it:

| State | `hasView()` | `isDestroyed()` | `currentView` |
| --- | --- | --- | --- |
| Empty | `false` | `false` | `undefined` |
| Occupied | `true` | `false` | The View shown by the Region |
| Destroyed | `false` | `true` | `undefined` |

`isSwappingView()` is a temporary operation flag rather than a fourth stable state.
It is `true` while one occupied Region replaces its current View with another,
including the Region's `before:show`, `before:empty`, `empty`, and `show` callbacks.
It returns to `false` when `show` completes. `isReplaced()` independently reports
whether `replaceElement` has temporarily replaced the Region element; it does not
change which lifecycle operations are valid.

| Operation | Empty Region | Occupied Region | Destroyed Region |
| --- | --- | --- | --- |
| `show(view)` when the Region element resolves | Renders the View if needed, shows it, and enters occupied. | Showing the same View is a no-op. Showing a different View destroys the old View and swaps to the new one. | Returns the Region without inspecting or changing the caller-owned View or resolving the element. |
| `detachView()` | Returns `undefined`; state is unchanged. | Detaches and returns the live View, then enters empty. | Returns `undefined` without changing state or DOM or emitting lifecycle events. |
| `empty()` | Returns the Region and, when its element resolves, removes unmanaged contents from that element. | Destroys the current View, clears `currentView`, and enters empty. | Returns the Region without resolving the element or changing lifecycle state or DOM. |
| `reset()` | Empties the Region and resets its element reference. | Destroys the current View, enters empty, and resets the element reference. | Returns the Region without resolving the element or changing lifecycle state, DOM, or element caches. |
| Current View is destroyed externally | No effect. | Runs the Region's empty lifecycle once, clears `currentView`, and enters empty. | No effect. |
| `destroy()` | Runs the destroy lifecycle and enters destroyed. | Emits `before:destroy`, destroys and empties the current View, enters destroyed, then emits `destroy`. | Returns the Region without repeating cleanup or lifecycle events. |

Successful `show`, `empty`, and `destroy` calls return the Region when their
operation completes. With `allowMissingEl: true`, `show` instead returns `undefined`
and leaves the current View unchanged when its element does not resolve. A View returned
by `detachView()` remains the caller's responsibility until the same or another Region shows it
or it is destroyed. After destruction, `show()`, `empty()`, and `reset()` return
the Region without changing it, and `detachView()` returns `undefined`.
As soon as destruction begins, `show()`, `detachView()`, and recursive `destroy()`
calls are no-ops. `empty()` and `reset()` remain available during cleanup.
A View passed to `show()` during or after destruction remains caller-owned and
unchanged. A destroyed Region cannot be reused.

When its current View destroys itself, the Region clears that View's ownership
and releases the owning parent View's subscriptions to it. Later events on the
destroyed child are no longer forwarded to the parent.

The following example preserves a View by detaching it before showing it again.
Calling `empty()` afterward destroys the View and returns the Region to its empty state.

<!-- executable-example: region-lifecycle -->
```javascript
import { Region, View } from 'marionette';

export function runRegionLifecycle() {
  const region = new Region({ el: '#content' });
  const contentView = new View({
    template() {
      return '<p>Content</p>';
    }
  });

  region.show(contentView);
  const detachedView = region.detachView();
  region.show(detachedView);
  region.empty();

  return region;
}
```

## Defining the Application Region

The Application defines a single region `el` using the `region` attribute. This
can be accessed through `getRegion()` or have a view displayed directly with
`showView()`. Below is a short example:

```javascript
import { Application } from 'marionette';
import SomeView from './view';

const MyApp = Application.extend({
  region: '#main-content',

  onStart() {
    const mainRegion = this.getRegion();  // Has all the properties of a `Region`
    mainRegion.show(new SomeView());
  }
});
```


For more information, see the
[Application docs](./marionette.application.md#application-region).

## Defining Regions

In Marionette you can define a region with a string selector or an object literal
on your `Application` or `View`. This section will document the two types as applied
to `View`, although they will work for `Application` as well - just replace `regions`
with `region` in your definition.

Region declaration maps, including maps passed to `addRegions`, use own enumerable
string keys in standard JavaScript own-key order. Inherited, symbol, and
non-enumerable properties are ignored, and a numeric `length` property is an
ordinary Region name rather than an array-like signal. Arrays, sparse arrays, and
other array-like values are not supported as Region declaration maps.

Named View Region operations require a non-empty string name. `addRegion`,
`removeRegion`, `hasRegion`, `getRegion`, `showChildView`, `detachChildView`, and
`getChildView` throw [`MN0032`](/errors/MN0032/) for an empty name. The public
types require strings; unsupported shapes have no guaranteed diagnostic.
Ordinary collision names such as `constructor`,
`toString`, and `__proto__` remain valid when explicitly registered.

### String Selector

You can use a CSS selector string to define regions.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  regions: {
    mainRegion: '#main'
  }
});
```

`Region#getEl(selector)` resolves the selector within `parentEl`, or within the
document when no parent is defined, and returns the first matching native DOM
element. A custom `getEl` override must preserve that native-element return
contract; do not return a `NodeList` or jQuery collection. To customize selector
lookup through the DOM adapter, implement `findEl(context, selector)` instead.
The v4 `DomApi#getEl` method is not part of the v5 DOM API.

Selector lookup is deferred until a DOM operation such as `show()` needs it. During construction, `initialize` observes the configured
selector string in `this.el`; constructing a Region does not query the document
or dispatch through a `getEl` override.

### Additional Options

You can define regions with an object literal. Object literal definitions expect
an `el` property - the selector string to hook the region into. With this
format is possible to define whether showing the region overwrites the `el` or
just overwrites the content (the default behavior).

Region defaults and object-literal definitions contribute their own enumerable
properties, including symbols, through object spread. Inherited and
non-enumerable properties are ignored when Marionette builds the Region options.

To replace the Region's placeholder with the child View's root element, use
`replaceElement: true`:

<!-- executable-example: region-replace-element -->
```javascript
import { View } from 'marionette';

const ReplacementView = View.extend({
  className: 'new-class',
  template: () => '<p>Replacement content</p>'
});

const Layout = View.extend({
  template: () => '<div class="overwrite-me"></div>',
  regions: {
    main: {
      el: '.overwrite-me',
      replaceElement: true
    }
  }
});

export const view = new Layout().render();
export const placeholder = view.el.querySelector('.overwrite-me');
export const replacement = new ReplacementView();

// Rendering the parent creates the placeholder. Showing the child replaces it.
view.showChildView('main', replacement);

view.$('.overwrite-me').length; // 0
view.$('.new-class').length; // 1
```

`showChildView()` replaces `.overwrite-me` with the child's `el`; rendering the
parent alone does not. The `className` option takes a class name, without the
`.` used in CSS selectors. Emptying the Region destroys its current child and
restores the original placeholder. The parent View's own root remains unchanged.

This is useful when a container requires particular direct children, such as a
`table` body containing rows. Choose a child `tagName` valid for that container.


```js
import { View } from 'marionette';

const MyView = View.extend({
  regions: {
    regionDefinition: {
      el: '.bar',
      replaceElement: true
    }
  }
});
```

**Errors** An operation that needs the element throws `MN0004` when no `el`
is configured, or `MN0005` when a selector finds no element and
`allowMissingEl` is false. Construction alone does not resolve the selector.

### Specifying `regions` as a Function

On a `View` the `regions` attribute can also be a
[function returning an object](./basics.md#functions-returning-values):

```javascript
import { View } from 'marionette';

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
import { Application, Region, View } from 'marionette';

const MyRegion = Region.extend({
  onShow(){
    // Scroll to the middle
    const viewHeight = this.currentView.el.getBoundingClientRect().height;
    const regionHeight = this.el.getBoundingClientRect().height;
    this.el.scrollTop = viewHeight / 2 - regionHeight / 2;
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


### Referencing UI in `regions`

The UI attribute can be useful when setting region selectors - simply use
the `@ui.` prefix:

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  ui: {
    region: '#first-region'
  },
  regions: {
    firstRegion: '@ui.region'
  }
});
```


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


## Removing Regions

You can remove all of the regions from a view by calling `removeRegions` or you can remove a
region by name using `removeRegion`. When a region is removed the region will be destroyed.

```javascript
import { View } from 'marionette';

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

In addition to adding and removing regions there are a few methods to help
utilize regions. `hasRegion` and `getRegion` are pure own-registry queries, and
`getRegions` returns a pure snapshot; none renders. Child View operations and
`emptyRegions` first render a live, unrendered View before resolving or mutating
Regions.

- `getRegion(name)` - Request an own registered Region without rendering.
- `getRegions()` - Return a fresh own-key snapshot of registered Regions without rendering.
- `hasRegion(name)` - Check if a View has an own registered Region without rendering.
- `emptyRegions()` - Render when needed, then empty all Regions returned by `getRegions()`.

## Showing a View

Once a region is defined, you can call its `show` method to display the view:

```javascript
const myView = new MyView();
const childView = new MyChildView();
myView.render();
const mainRegion = myView.getRegion('main');

// render and display the child View
mainRegion.show(childView, { fooOption: 'bar' });
```

The parent View must already be rendered before calling a selector Region's
`show` directly. Use `showChildView('main', childView)` to render the parent when
needed before showing the child.

This is equivalent to a view's `showChildView` which can be used as:

```javascript
const myView = new MyView();
const childView = new MyChildView();

// render and display the view
myView.showChildView('main', childView, { fooOption: 'bar' });
```

Both forms require a Marionette View instance. Construct a `View` explicitly
when displaying a template or static content; Regions do not allocate hidden Views
from View classes, functions, strings, or option objects. The
[wrapper pattern](#wrapping-a-non-marionette-view) provides explicit ownership for legacy integrations.

```javascript
import { View } from 'marionette';

myView.showChildView('header', new View({
  template: () => 'Welcome to the site'
}));
```

The argument after the View instance in `Region#show(view, options)` and
`View#showChildView(name, view, options)` is a separate show-options object passed
to the [events fired during `show`](./events.class.md#show-and-beforeshow-events).

For more information on `showChildView` and `getChildView`, see the
[Documentation for Views](./marionette.view.md#managing-children)

**Errors**
- A destroyed View throws `MN0007`. Other input shapes are unsupported; core
  does not guarantee a Marionette diagnostic for an invalid value.
- An error will be thrown if the view is already managed by a Region or CollectionView,
  including a filtered or deferred CollectionView child. Detach it from that owner first.

### Checking whether a region is showing a view

If you wish to check whether a region has a view, you can use the `hasView`
function. This will return a boolean value depending whether or not the region
is showing a view.

```javascript
const myView = new MyView();
myView.render();
const mainRegion = myView.getRegion('main');

mainRegion.hasView() // false
mainRegion.show(new OtherView());
mainRegion.hasView() // true
```

If you show a view in a region with an existing view, Marionette will
[remove the existing View](#emptying-a-region) before showing the new one.

### Wrapping a non-Marionette view

Regions and CollectionViews manage Marionette Views. They do not synthesize
render or destroy events for Backbone Views or fall back to a `remove()` method.
Keep a legacy integration inside a Marionette owner:

```javascript
import { View } from 'marionette';
import LegacyView from './legacy-view.js';

const LegacyWrapper = View.extend({
  template: () => '<div class="legacy"></div>',
  onRender() {
    this.legacy?.remove();
    this.legacy = new LegacyView({ el: this.$('.legacy')[0] });
    this.legacy.render();
  },
  onDestroy() {
    this.legacy?.remove();
  }
});
```

Show `new LegacyWrapper()` in the Region. The wrapper owns the legacy instance
and translates its actual rendering and cleanup API. No global prototype mixin
or compatibility flags are needed.

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
Calling `empty()` after Region destruction completes returns the Region without
resolving its element, changing the DOM, or emitting empty lifecycle events.

**NOTE** If the region does _not_ currently contain a View it will detach
any HTML inside the region when emptying. If the region _does_ contain a
View, any HTML that doesn't belong to the View will remain.

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

**Note** Detaching transfers responsibility for the live View to the caller.
Show it again in the same emptied Region or another Region when needed, or call
`destroy()` when finished with it.

## `reset` A Region

Resetting a live Region destroys its current View and restores its original
`el` reference. An original selector is queried again by the next operation that
needs it; an original DOM element is reused without a selector query.

```javascript
const myView = new MyView();
myView.showChildView('main', new OtherView());
const myRegion = myView.getRegion('main');
myRegion.reset();
```

This can be useful in unit testing your views.
Calling `reset()` after Region destruction completes returns the Region without
changing its element reference or cache.

## `destroy` A Region

A region can be destroyed which will `reset` the region, destroy its current View,
remove it from any parent View's Region lookups, and stop any internal Region listeners.
Reentrant Region destruction from `before:destroy` or `destroy`, repeated calls,
and later destruction of the parent View do not repeat the child or Region teardown.
A throwing lifecycle hook stops destruction. Later `destroy()` calls do not
retry hooks or resume partial teardown. Discard the Region after a cleanup error;
its remaining state is not a reusable lifecycle state.
`isDestroyed()` becomes `true` after `reset()` finishes, before the `destroy`
event. It remains `false` in `before:destroy`, `before:empty`, and `empty` handlers
called during teardown.

`destroy()` calls the overridable `reset()` method, which calls `empty()`.
Overrides can use this ordinary synchronous chain while cleanup is in progress.
An override that does not delegate to the base method owns the corresponding
cleanup; for example, a custom `reset()` can call `this.empty()` and reset its own
element reference. Nested `empty()` or `reset()` calls from lifecycle handlers
are ordinary calls, so handlers must avoid recursive loops.

After destruction completes, `empty()` and `reset()` return the Region without
changing its element or DOM. `show()` and `detachView()` already stop accepting
Views or transferring ownership as soon as destruction begins.

```javascript
import { View } from 'marionette';

const MyView = View.extend({
  regions: {
    mainRegion: '#main'
  }
});

const myView = new MyView();
myView.render();

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
import { Region } from 'marionette';

const EmptyMsgRegion = Region.extend({
  onEmpty() {
    if (!this.isSwappingView()) {
      this.el.append('Empty Region');
    }
  }
});
```

## Set How View's `el` Is Attached and Detached

Override the region's `attachHtml` method to change how the view is attached
to the DOM (when not using `replaceElement: true`). This method receives one
parameter - the view to show.

The default implementation of `attachHtml` is essentially:

```javascript
import { Region } from 'marionette';

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
import $ from 'jquery';
import { Region, View } from 'marionette';

const ModalRegion = Region.extend({
  attachHtml(view){
    // Some effect to show the view:
    const $el = $(this.el);
    $el.empty().append(view.el);
    $el.hide().slideDown('fast');
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
import { Region } from 'marionette';

Region.prototype.removeView = function(view){
  this.destroyView(view);
}
```

`destroyView(view)` destroys a Marionette View and returns it. It forwards the
Region owner's lifecycle-monitoring policy; it does not adapt a Backbone View
or fall back to `remove()`. Keep this helper when overriding `removeView`.

Region operations are synchronous. A `removeView` override must complete cleanup
before returning if callers should observe the normal empty/destroy contract.
Returning a Promise does not delay Region lifecycle completion. For an exit
animation, finish the animation in the application before calling `empty()` or
showing the replacement, and let the Region perform its normal synchronous
teardown. The application owns cancellation when navigation or destruction
interrupts that animation.
