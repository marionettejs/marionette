# CollectionView

[API index](../api.md) · [View](view.md) · [Shared View runtime](shared/view-bindings.md)

CollectionView owns repeated child Views and their placement, order, and lifetime. Supply a collection for one child per model, or add View instances directly. Use a View with named Regions for a layout containing distinct pieces of UI.

## Render a collection

This standalone TypeScript example uses `@mnjs/data` for observable membership and Lit for text rendering. API access and persistence remain separate concerns; see [data setup](../integrations/setup.md#observable-data-and-api-access).

```ts
import { CollectionView, Region, View } from 'marionette';
import { Collection, DataApi } from '@mnjs/data';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const Item = View.extend({
  tagName: 'li',
  template: ({ label }: { label: string }) => html`${label}`,
  modelEvents: { change: 'render' },
}).setDataApi(DataApi).setDomApi(LitDomApi);

const Empty = View.extend({
  tagName: 'li',
  template: () => 'No items',
});

const List = CollectionView.extend({
  tagName: 'ul',
  childView: Item,
  emptyView: Empty,
  viewComparator: 'label',
}).setDataApi(DataApi);

const items = new Collection([
  { id: 'b', label: 'Blueberry', available: false },
]);
const list = new List({ collection: items });
const mount = document.createElement('section');
document.body.append(mount);
const region = new Region({ el: mount });
region.show(list);

items.add({ id: 'a', label: 'Apricot', available: true });
// Apricot sorts before Blueberry; the existing row keeps its View.
list.setFilter('available'); // Hides Blueberry; its child View stays alive.
list.removeFilter();        // Shows that same child again.
```

The Region owns the list; the list owns its rows and empty View. `region.destroy()` destroys that composition. It does not destroy `items` or its Models. Child model changes render through the child's `modelEvents`; they do not automatically rerun the list's comparator or filter. Call `list.sort()` or `list.filter()` when those criteria depend on changed attributes.

## Construction and options

`new CollectionView(options?)` establishes its fixed root, children storage, Behaviors, state access and event bindings. It calls `preinitialize(options)` before those resources, then `initialize(options)` after child storage and Behaviors exist. `getState()` is available inside `initialize`; state bindings, the empty Region, and entity bindings initialize afterward. Construction does not create rows or subscribe to collection membership; the first `render()` does.

CollectionView accepts View's root, template, data, UI/DOM, entity-event, state, Behavior and child-forwarding options. Their shared contracts are in [View runtime](shared/view-bindings.md), [state](shared/state.md), and [View construction](view.md#construction-and-options). It has no named-Region methods or `regions`/`regionClass` options. Custom options use [common option methods](shared/common.md#options-and-initialization).

| CollectionView option | Value and default |
| --- | --- |
| `collection` | Source understood by the configured DataApi. The default accepts a plain array; the native DataApi accepts a `Collection`. May be omitted for manually managed children. |
| `childView` | View/CollectionView class, or `function(model)` returning a class. Required when collection models need children; no default. |
| `childViewOptions` | Options object or `function(model)` returning one. Default construction uses `{ model, ...childViewOptions }`, so an explicit `model` option overrides the source model. Normally retain the supplied model. |
| `childViewContainer` | Descendant selector or function returning one; defaults to the root. Resolved after template rendering. A selector with no match throws `MN0013`. |
| `emptyView` | View/CollectionView class, or function returning a class, `null`, `undefined`, or `false`. Defaults to no empty View. |
| `emptyViewOptions` | Options object or function called without arguments. Falls back to `childViewOptions`, also called without a model. |
| `sortWithCollection` | Boolean, default `true`. Follows source reorder notifications and uses collection order when no custom comparator is selected. |
| `viewComparator` | Model attribute name, one-argument key function, or two-argument comparison function; default is collection order. `false` disables the comparator. See [sorting](#sorting). |
| `viewFilter` | Model attribute name, attribute-value object, or predicate; default no filter. See [filtering](#filtering). |

Resolver functions and comparator/filter callbacks run with the CollectionView as `this`. `childView` and `emptyView` constructors are instantiated, not called as resolvers. Use `CollectionView.extend(prototypeProperties?, staticProperties?)` to declare defaults and overrides.

`cid` is generated with the class's `cidPrefix` (`'mncv'` by default). `options` contains merged class and constructor options. `RegionClass` configures the empty Region on the prototype or in `initialize`; despite appearing in the configuration type, passing it as a constructor option does not set that hook in this prerelease.

## Rendering and collection updates

| Operation | Child identity and presentation |
| --- | --- |
| `render()` → `this` | Destroys all managed rows, creates children from the current collection, renders an optional template, resolves the container, then sorts, filters and presents children. Emits render lifecycle notifications. A destroyed list does nothing. |
| Observable addition/removal | Creates added rows and destroys removed rows; retains unaffected child instances. Reapplies sorting/filtering and presentation. |
| Source reorder | Sorts/presents existing rows when `sortWithCollection` is true. Does not recreate surviving rows. |
| Source reset | Destroys/rebuilds rows from the new snapshot, even if the same Models or keys occur again. Does not rerender the list's own template. |
| Adapter update of the same model object | Retains its child, marks it for rendering, then sorts/filters. A hidden child renders when next presented. |
| Adapter replacement with a different object under the same key | Creates a replacement child and destroys the previous child. Stable keys do not imply rebinding an existing View to a different model. |

A plain array is not observed. After changing it, `render()` rebuilds the list. Observable sources let additions and ordering changes preserve surviving Views and their DOM; do not call full `render()` merely to apply a filter or comparator. Use a new CollectionView when changing the collection source; assigning `collection` does not transfer an existing observer to that source.

The DataApi supplies models and stable, unique, non-null keys. The default uses each array value as its key; `@mnjs/data` uses Model `cid`, not `id`. Missing, duplicate or changing keys throw `MN0039`. Full adapter authoring is a separate reference area; normal consumers use a compatible [DataApi setup](../integrations/setup.md#configure-once).

`template` is optional. With no template or `template: false`, `render()` still manages rows and emits events; it only skips rendering the list's own template. A supplied root is adopted, but existing markup does not mark a CollectionView rendered or bind its UI automatically. With no template, call `bindUIElements()` when you need UI queries against that markup. Place children in a dedicated `childViewContainer` when the root also contains persistent markup.

## Sorting

Sorting changes View order without changing the source collection. Comparators operate on child Views:

- A string reads that attribute from each child's model through the DataApi.
- `function(view)` returns a sort key. Equal keys retain their current ordering; missing (`undefined`) keys sort last.
- `function(left, right)` returns a negative, zero, or positive number. Use two declared parameters: function arity distinguishes this form from a key function.

| Method | Contract |
| --- | --- |
| `getComparator()` | Returns the explicit truthy comparator, the source-order comparator, or `false`. Override for a computed comparator. |
| `sort()` → `this` | Sorts managed children, then filters and renders the resulting presentation. Already rendered survivors keep their elements. |
| `setComparator(value, options?)` → `this` | Stores the value and calls `sort()` if its identity changed, unless `preventRender` is true. |
| `removeComparator(options?)` → `this` | Clears the explicit comparator. With a collection and `sortWithCollection: true`, this restores the source-order comparator. |

`viewComparator: false` disables comparator sorting. To ignore source reorder notifications as well, use `sortWithCollection: false`. With `sortWithCollection: true`, source updates establish source order before custom comparison, so equal-key ties follow the source. The default source-order comparator places manual children without a source model before collection rows. Use an explicit comparator or indexed insertion when you need another order.

Configure initial options before rendering. The setters do not check readiness: their default behavior immediately runs a presentation pass. Use `{ preventRender: true }` to defer a changed setting. Apply a deferred comparator with `sort()`; a deferred filter with `filter()` or `sort()`. Full rendering applies both.

## Filtering

Filtering controls presentation; it does not remove models or destroy their children. Hidden children keep state and subscriptions and remain owned by the list. `children` exposes the presented set after a filter pass.

| Filter value | Meaning |
| --- | --- |
| `function(view, index, children)` | Keep the View for a truthy result. The index and array describe all managed children in current sorted order. |
| `'available'` | Keep Views whose model has a truthy `available` attribute according to the DataApi. |
| `{ available: true }` | Keep Views whose model has every listed attribute with the matching value, using strict equality. |
| Falsy value | No filter. |

| Method | Contract |
| --- | --- |
| `getFilter()` | Returns `viewFilter`; override for a computed filter. |
| `filter()` → `this` | Recomputes presentation and renders/attaches included children, without sorting first. Detaches excluded rows without destroying them. |
| `setFilter(value, options?)` → `this` | Stores the value and filters immediately when its identity changed, unless `preventRender` is true. |
| `removeFilter(options?)` → `this` | Clears the filter using the same setter rules. |

Changing values captured by a predicate does not change the predicate's identity. Call `filter()` explicitly to apply those changes. Hidden Views can be shown again as the same instances; they are still destroyed when removed from the source, on full render/reset, or when the list is destroyed.

## Empty presentation

`isEmpty()` reports whether `children` has no presented rows. All rows can be filtered out while the source still has models. The `emptyView` appears for this presentation state, through the Region returned by `getEmptyRegion()`.

The empty View is separate from `children`. It receives `emptyViewOptions`, or the `childViewOptions` fallback, with no automatic model. Give it a root suitable for the child container, such as `li` inside `ul`. Each empty presentation pass creates a new empty View and replaces the previous one; it is destroyed when rows appear or the list is destroyed. Its events use the same [child forwarding](shared/view-bindings.md#child-events) as rows.

`getEmptyRegion()` returns the list-owned Region for the current child container, with replacement disabled. It is created during construction and reused while live; its owner is this CollectionView. If explicitly destroyed while the list is live, the next call recreates it. After list destruction, the getter returns the destroyed Region. Use it to inspect `currentView`; configure empty presentation through `emptyView` and `emptyViewOptions`.

## Find and inspect children

`children` is an iterable child container for the current presentation. It excludes filtered-out rows and the empty View. Newly adopted manual children enter it immediately, including when rendering is deferred; the next filter pass establishes the presented subset. Query this container; change ownership through the CollectionView methods below.

| Member | Result |
| --- | --- |
| `length`, `isEmpty()` | Presented count and whether it is zero. |
| `findByModel(model)`, `findByKey(key)` | View indexed by `Data.key(model)` or an explicit key, or `undefined`. Model lookup is by provider key, not necessarily object identity. |
| `findByCid(cid)`, `findByIndex(index)` | View by its own `cid` or presentation index, or `undefined`. |
| `findIndexByView(view)` | Index, or `-1` if absent. |
| `hasView(view)`, `contains(view)` | Whether that exact instance is present. |
| `toArray()`, `[Symbol.iterator]()` | A copied array, or iteration over the presentation. |
| `each(callback, context?)` | Calls `(view, index)` for each child; returns the container. |
| `map(callback, context?)`, `pluck(property)` | Array of callback results or View property values. `pluck` reads the View, not its model. |
| `find`, `filter`, `reject`, `every`, `some`, `partition` | Accept `(view, index)` predicates and optional context. Return the first match, matching array, rejected array, boolean, boolean, or `[matching, rejected]`. |
| `reduce(callback, initialValue?, context?)` | Reduces using `(accumulator, view, index)`. Omitting the initial value uses the first View; an empty container then throws. |
| `first(count?)`, `last(count?)` | One View (or `undefined`) when count is omitted; an array when supplied. |
| `initial(count = 1)`, `rest(count = 1)` | Array excluding the last or first count Views. Counts must be nonnegative integers. |
| `without(...views)` | Copied array excluding those instances. |
| `invoke(methodName, ...args)` | Calls each child's named method with that child as `this`; returns its results. |

The container's `Data` is its lookup provider. Public query helpers do not change membership.

## Manage View instances directly

These operations do not change the source collection. For collection-backed rows, normally change the collection; direct removal does not remove the model and a later rebuild can recreate its View.

| Method | Ownership and return |
| --- | --- |
| `addChildView(view, index?, options?)` | Adopts and returns the supplied View, rendering the parent first if needed. A View must be unowned. Without a numeric index, sorts/filters; a numeric index inserts directly and skips those steps for this addition. Also accepts an options object as the second argument. |
| `detachChildView(view)` | Removes a managed View from storage and DOM, releases ownership/forwarding, and returns it alive. The caller must give it a new owner or destroy it. |
| `removeChildView(view)` | Destroys a managed View, removes its entry, and returns it. A missing/falsy or unmanaged View is returned unchanged. |
| `swapChildViews(first, second)` → `this` | Swaps two managed children without changing the collection. Both must belong to this list (`MN0015` otherwise). If only one is currently presented, reapplies filtering. A later sort can override the swap. |

For addition, `{ index, preventRender }` may be supplied as options; a non-null options index takes precedence over the positional index. `preventRender` defers child presentation, not adoption or the parent's initial render. Destroyed/falsy incoming Views and additions to a destroying/destroyed list return unchanged. Already owned incoming Views throw `MN0003`.

A child that destroys itself is removed from the list automatically. Full `render()` destroys manual children too and rebuilds only collection rows.

## Lifecycle and extension points

CollectionView has the shared View attach/detach, DOM and destruction notifications described in [View lifecycle](view.md#lifecycle-hooks-and-events). `isRendered()`, `isAttached()` and `isDestroyed()` report those states. `destroy(options?)` returns the list, removes its root, destroys all managed rows (including hidden rows) and its empty Region, and releases observation, bindings, Behaviors and owned state. Repeated destruction does nothing; it does not destroy the supplied model or collection.

Every event below dispatches its matching `on…` hook before subscribers. Child operations and observed changes can emit these events without a full list render.

| Event pair | Hooks | Arguments and boundary |
| --- | --- | --- |
| `before:render`, `render` | `onBeforeRender`, `onRender` | `(list)` around full rendering. The final event sees `isRendered() === true`. |
| `before:add:child`, `add:child` | `onBeforeAddChild`, `onAddChild` | `(list, child)` around adoption/indexing, before presentation by this list. |
| `before:remove:child`, `remove:child` | `onBeforeRemoveChild`, `onRemoveChild` | `(list, child)` around removal from child storage. These are not a universal before/after boundary for child destruction. |
| `before:sort`, `sort` | `onBeforeSort`, `onSort` | `(list)` around sorting when there are managed children and an active comparator. |
| `before:filter`, `filter` | `onBeforeFilter`, `onFilter` | Before: `(list)`. After: `(list, included, excluded)`. Only emitted with managed children and an active filter. |
| `before:render:children`, `render:children` | `onBeforeRenderChildren`, `onRenderChildren` | `(list, presentedChildren)` around child/empty presentation. The array contains row Views, not the empty View; it is live storage, so copy it if retaining a snapshot. |
| `before:destroy:children`, `destroy:children` | `onBeforeDestroyChildren`, `onDestroyChildren` | `(list)` around bulk managed-row destruction, when rows exist. Bulk destruction does not emit individual remove-child events. |

A full render runs: `before:render` → old-row destruction → new-row additions → template/container setup → sort → filter → child/empty presentation → `render`. A collection reset omits the outer render and template phases. Direct removal tears down the child before remove-child notifications; observable removal drops its entry, updates presentation, then destroys the removed child. [Region replacement](region.md#replacing-a-collectionview) explains the outer owner's teardown order. Callbacks are synchronous; a thrown callback can interrupt an operation.

| Extension point | Default behavior |
| --- | --- |
| `buildChildView(model, ChildClass, options?)` | Constructs `new ChildClass({ model, ...options })` and returns it. Does not itself adopt/render the child. |
| `attachHtml(elements, container)` | Appends the supplied Element/DocumentFragment to the child container; no defined return value. |
| `detachHtml(view)` | Detaches the child's element through the DOM provider; no defined return value. |
| `getComparator()`, `getFilter()`, `isEmpty()` | Can be overridden to compute ordering, filtering, or empty presentation. |

DOM extension points perform placement only; ownership and lifecycle remain the job of the enclosing operations. Keep the fixed root. Shared `getTemplate`, serialization, UI, delegation, attributes, Behavior composition, child events and their methods are defined in [View runtime](shared/view-bindings.md). Class setters `setRenderer`, `setDomApi`, `setDataApi`, `setStateApi`, and `setEventDelegator` use its [configuration contracts](shared/view-bindings.md#class-configuration). Inherited object APIs are in [common methods](shared/common.md), [events](shared/events.md), and [state](shared/state.md).

## TypeScript

Import `CollectionViewConfiguration`, `CollectionViewInstance`, `CollectionViewConstructor`, `CollectionChild`, and `ChildRenderOptions` from `marionette`. Configuration describes accepted options; `ChildRenderOptions` contains `index` and `preventRender`. `CollectionChild` describes a managed View with container identity. Instance generics describe child type, options, state, collection source and query type. Constructor inference carries supplied child/source types and subclass properties through `extend`; normal applications can use that inference as in the example.

The `children` container interface is reachable through the instance type; its constructor is not a top-level Marionette export.
