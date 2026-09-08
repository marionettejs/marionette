# Marionette.View

A `View` manages one part of a screen: its content, DOM interactions, and child
views. Give it a template and data, and it renders into a root element, `el`.
Plain objects and native DOM methods work by default.

Use named [Regions](./marionette.region.md) to give child views a place within
that element, and [Behaviors](./marionette.behavior.md) to share interaction
logic across views.

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
* [Method results and side effects](#method-results-and-side-effects)
* [Rendering a View](#rendering-a-view)
  * [Using a View Without a Template](#using-a-view-without-a-template)
  * [Refreshing Root Attributes](#refreshing-root-attributes)
* [View Lifecycle and Events](#view-lifecycle-and-events)
* [Entity Events](#entity-events)
* [DOM Interactions](#dom-interactions)
* [Behaviors](#behaviors)
* [Managing Children](#managing-children)
  * [Laying Out Views - Regions](#laying-out-views---regions)
  * [Showing a Child View](#showing-a-child-view)
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
`events`, `id`, `model`, `modelEvents`, `regionClass`, `regions`, `stateEvents`,
`tagName`, `template`, `templateContext`, `triggers`, `ui`

```javascript
import { View } from 'marionette';

const myView = new View({ template: () => '<p>Content</p>' });
```

These properties are defined by Marionette's standalone `View` constructor.
When Marionette creates the View's element, it copies own enumerable
`attributes` properties, including symbols. The default DomApi applies string
attribute names only; inherited and non-enumerable properties are not copied. When applied, `id` and `className` assignments occur
afterward and override the corresponding `attributes` keys. See the
[`DomApi.setAttributes` contract](./dom.api.md#setattributesel-attrs).

## Method results and side effects

These operations run synchronously. Use lifecycle hooks for additional work;
returning a Promise from a View hook does not delay rendering or destruction.

| Method | Result | Effect |
| --- | --- | --- |
| `render()` | This View | Evaluates the template, updates contents and UI bindings. Rendering again resets its Regions and destroys their current children. `template: false` and a destroyed View make this a no-op. |
| `renderAttributes()` | This View | Refreshes root attributes without rendering contents or recreating children. |
| `destroy(options)` | This View | Removes the root element, destroys owned Regions/children and Behaviors, releases subscriptions and owned State. Repeated destruction is a no-op. |
| `isRendered()`, `isAttached()`, `isDestroyed()` | Boolean | Read lifecycle state without rendering. Attachment is Marionette's tracked state; see [monitoring](./view.lifecycle.md). |
| `hasRegion(name)`, `getRegion(name)` | Boolean or Region/`undefined` | Read a named registration without rendering the parent. |
| `getRegions()` | New name-to-Region object | Read registrations; changing this object does not change ownership. |
| `showChildView(name, view, options)` | Supplied child View | Renders the parent if needed, then delegates to the named Region. The result alone does not establish adoption when `allowMissingEl` permits a missing mount. |
| `getChildView(name)` | Current child or `undefined` | Renders the parent if needed before reading the named Region. |
| `detachChildView(name)` | Detached child or `undefined` | Renders the parent if needed, then transfers a live child to the caller. |
| `addRegion(name, definition)` | Registered Region | Constructs or registers a Region without rendering the parent. |
| `addRegions(definitions)` | Map of added Regions, or `undefined` for no entries | Registers the batch; see [ownership constraints](./marionette.region.md#reading-region-ownership). |
| `removeRegion(name)` | Removed Region | Destroys that Region and its current child. |
| `removeRegions()` | Map of removed Regions | Destroys every registered Region and its current child. |
| `emptyRegions()` | Map of Regions | Renders the parent if needed, destroys current children, and keeps the Regions available. |

`getChildView`, `showChildView`, `detachChildView`, and `removeRegion` require a
registered name and throw [`MN0020`](diagnostic-catalog.md#look-up-a-code) when it is absent.
`getRegion` returns `undefined` for an absent valid name. Region names must be non-empty strings; an empty string throws
[`MN0032`](diagnostic-catalog.md#look-up-a-code).

A supplied `state` is borrowed rather than copied as a normal constructor
option. See [State ownership](./marionette.state.md#borrowed-and-owned-sources)
for `getState()`, `createState()`, subscriptions, and disposal.

## Rendering a View

The Marionette View implements a powerful render method which, given a
[`template`](./view.rendering.md#setting-a-view-template), will build your
HTML from that template, mixing in `model` or `collection` data and any
extra [template context](./view.rendering.md#adding-context-data).

Marionette `View` defines `render`, and this method should not be overridden.
To add functionality around rendering, use the
[`render` and `before:render` events](./events.class.md#render-and-beforerender-events).


For more detail on how to render templates, see
[View Template Rendering](./view.rendering.md).

### Using a View Without a Template

With [`template: false`](./view.rendering.md#using-a-view-without-a-template),
`render()` returns the View without changing its contents or running
`before:render` and `render`. Other View events and DOM interactions remain
available. Use this for [`prerendered content`](./dom.prerendered.md) that the
View should preserve.

### Refreshing Root Attributes

`renderAttributes()` reevaluates a View's declarative `attributes`, `className`,
and `id`, then applies those values to its existing root element. The method is
also available on `CollectionView`.

<!-- executable-example: view-render-attributes -->
```javascript
import { View } from 'marionette';

const SelectableRow = View.extend({
  tagName: 'tr',

  attributes() {
    return {
      'aria-selected': this.isSelected ? 'true' : 'false'
    };
  },

  className() {
    return this.isSelected ? 'danger' : null;
  },

  template: false,

  setSelected(isSelected) {
    this.isSelected = isSelected;
    return this.renderAttributes();
  }
});

const row = new SelectableRow();
const rootElement = row.el;

row.setSelected(true);

export { rootElement, row };
```

With the default DomApi, only an explicit `null` removes an attribute.
An `undefined` value or omitted key leaves the existing attribute untouched;
Marionette does not retain the names returned by an earlier call. Other values,
including `false`, `0`, and an empty string, use the browser's attribute string
conversion. For boolean HTML attributes, declare `disabled: isDisabled ? '' : null`;
`disabled: false` still creates a present attribute and disables the element.
`id` and `className` continue to override matching keys from `attributes` when
they are declared. Live form properties such as `input.value` and `input.checked`
should be updated explicitly, separately from their default-value attributes.

Use `className` as the View-level class declaration, as shown above. The
`attributes` map continues to use raw DOM attribute names for lower-level cases.
Marionette normalizes the View declaration to the `class` attribute before
calling the DomApi, including for a supplied SVG root.

`renderAttributes()` returns the View. It does not call the template, emit the
render lifecycle, replace the root element, rebind `ui` or DOM events, or reset
Regions. It is not called automatically by `render()`. Calls after destruction
begins are no-ops and do not resolve the attribute declarations.

When a View uses a supplied `el`, construction still leaves that element's
attributes unchanged. A later `renderAttributes()` call applies only the keys
in the current declaration, so unrelated host attributes remain caller-owned.

## View Lifecycle and Events

An instantiated `View` is aware of its lifecycle state and will throw events related to when that state changes.

The view states indicate whether the view is rendered, attached to the DOM, or destroyed.

Read More:
- [View Lifecycle](./view.lifecycle.md)
- [View DOM Change Events](./events.class.md#dom-change-events)
- [View Destroy Events](./events.class.md#destroy-events)

## Entity Events

A `View` subscribes to its `model` and `collection` through the configured
[DataApi](./data.api.md). Event names and callback arguments belong to that data
provider. Plain objects and arrays do not emit changes; declaring entity event
maps for unobservable values throws `MN0037`.

Read More:
- [Entity Events](./events.entity.md)

## DOM Interactions

`View` provides `events`, `triggers`, and `ui` for DOM interactions.

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

The `View` class lets us manage a hierarchy of views using `regions`.
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
import { View } from 'marionette';

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


When we show views in the region, the contents of `#first-region` and
`#second-region` will be replaced with the root element of the child View we show. The
string values in this example are CSS selectors scoped to the `View`'s `el`.

### Showing a Child View

To show a view inside a region, simply call `showChildView(regionName, view)`. This
will handle rendering the view's HTML and attaching it to the DOM for you:

<!-- executable-example: view-child-region -->
```javascript
import { View } from 'marionette';

const ChildView = View.extend({
  template() {
    return '<p class="content">Content</p>';
  }
});

const ParentView = View.extend({
  template() {
    return `
      <div class="first-region"></div>
      <div class="second-region"></div>
    `;
  },

  regions: {
    firstRegion: '.first-region',
    secondRegion: '.second-region'
  }
});

export function runViewChildRegionLifecycle() {
  const parentView = new ParentView();

  parentView.showChildView('firstRegion', new ChildView());
  const childView = parentView.getChildView('firstRegion');

  parentView.detachChildView('firstRegion');
  parentView.showChildView('secondRegion', childView);
  parentView.getRegion('secondRegion').empty();

  return parentView;
}
```

Note: If `view.showChildView(region, subView)` is invoked before the `view` has been rendered, it will automatically render the `view` so the Region's `el` exists within the parent root; the root may still be detached.

### Accessing a Child View

To access the child view of a `View` - use the `getChildView(regionName)` method.
This will return the view instance that is currently being displayed at that
region. The example gets the exact `ChildView` shown in `firstRegion` before
moving it.

If the named Region exists but has no current View, `getChildView` returns
`undefined`.

### Detaching a Child View

You can detach a child view from a Region through `detachChildView(regionName)`.
It returns the same live, rendered View so that it can be shown again without
rendering a second time. In the example, the parent detaches its child from
`firstRegion` before showing that same child in `secondRegion`. This is a proxy
for [Region `detachView()`](./marionette.region.md#detaching-existing-views).

### Destroying a Child View

To destroy and clear a child owned by a View, empty its owning Region. The
example calls `parentView.getRegion('secondRegion').empty()`, which destroys the
current child and leaves `secondRegion` empty and available for another View.

### Region Availability

Defined regions are registered during `View` construction. `hasRegion(name)`,
`getRegion(name)`, and `getRegions()` query the View's own Region registry
without rendering, including when the View is unrendered or destroyed.
`getRegions()` returns a fresh, safe own-key snapshot. Child View operations
such as `showChildView`, `detachChildView`, and `getChildView` still render a
live, unrendered View before dispatching through any `getRegion` override.
`emptyRegions()` likewise renders before calling the overridable `getRegions()`
and emptying its returned snapshot.

Calling `getRegion(name)` does not render the parent or resolve the Region
element. Calling the returned Region's `show(view)` resolves its element but does
not render the parent. Use `showChildView`, or
render the parent first, when showing a child into a declared selector Region.

`getRegion(name)` and `hasRegion(name)` support optional lookup: an unknown name
returns `undefined` or `false`, respectively. Operations that require a Region —
`showChildView`, `detachChildView`, `getChildView`, and `removeRegion` — throw a
`RegionError` with code [`MN0020`](diagnostic-catalog.md#look-up-a-code) when the named Region does not
exist. Region names must be non-empty strings. The public types require strings;
an empty name throws a `RegionError` with code [`MN0032`](diagnostic-catalog.md#look-up-a-code).
Child View operations reject empty names before rendering the parent.

## Efficient Nested View Structures

Show a parent's Region children in `onRender` when they should be recreated
with that parent's template. During initial display, this builds the nested
View tree before the owning Region attaches the parent. Keep independently
editable content in child Views and update those children without re-rendering
the parent when their state must survive.

```javascript
import { View } from 'marionette';

const ParentView = View.extend({
  // ...
  onRender() {
    this.showChildView('header', new HeaderView());
    this.showChildView('footer', new FooterView());
  }
});

myRegion.show(new ParentView());
```

Child Views can show their own Region children in `onRender` too. Marionette
coordinates the render and attachment lifecycles; browser layout and paint
counts depend on the DOM, styles, and application callbacks. Measure those costs
in the running application when they matter.

## Listening to Events on Children

Using regions lets you listen to the events that fire on child views - views
attached inside a region. This lets a parent view take action depending on what
events are triggered in views it directly owns.

Read More:
- [Child Event Bubbling](./events.md#event-bubbling)
