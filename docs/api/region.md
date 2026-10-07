# Region

[API index](../api.md) · [View](view.md) · [Shared events](shared/events.md)

A Region owns the placement and lifetime of one View or CollectionView. Showing another View destroys the current one. Detaching releases it for reuse. A View can own named Regions for composition; an Application can use a Region to display its root View.

## Construction and options

`new Region(options?)` configures the Region and calls `initialize(options)`. It does not resolve a selector, render a View, or change the DOM. Supply `el` before showing content. Unlike View, Region has no `preinitialize` hook.

| Option / class property | Contract |
| --- | --- |
| `el` | A native `Element` or selector string. A selector is resolved when an operation needs the element, then the resulting element is cached. A detached element is valid. |
| `parentEl` | An `Element`, `Document`, or function returning either; scopes selector lookup to descendants of that node. Defaults to `document` when absent or the function returns no node. |
| `allowMissingEl` | Boolean or function returning a boolean; false by default. Allows a supplied selector to have no match. It does not allow an omitted `el`. |
| `replaceElement` | Boolean or function returning a boolean; false by default. Replaces the Region's placeholder with the shown View's root instead of inserting the root inside it. |

Functions run with the Region as `this`. Constructor options take precedence over class defaults. Use [common option methods](shared/common.md) for custom options.

This example moves a live View between two Regions without rendering it again:

```ts
import { Region, View, type RegionOptions } from 'marionette';

const options: RegionOptions = { el: document.createElement('section') };
const first = new Region(options);
const second = new Region({ el: document.createElement('aside') });
const content = document.createElement('p');
content.textContent = 'Account settings';
const view = new View({ el: content, template: false });

first.show(view);
const retained = first.detachView();
if (retained) second.show(retained);

first.destroy();
second.destroy(); // Destroys the View now owned by this Region.
```

See [View](view.md) for named Region definitions, including selector, constructor, instance, and options-object forms.

## Showing a View

### `show(view, options?)`

Accepts a View or CollectionView instance and returns the Region. It returns `undefined` when an unmatched selector is allowed by `allowMissingEl`. Both `allowMissingEl` and `replaceElement` can be overridden for this call with boolean values in `options`.

On a successful show, the Region:

1. Resolves its element and checks the incoming View.
2. Emits `before:show`, empties the outgoing View, and takes ownership of the incoming View.
3. Renders the incoming View if it is not already rendered.
4. Inserts its element, emitting attach notifications if the Region is in the document and monitoring is enabled.
5. Emits `show`.

Showing the current View again does not rerender it or repeat show events. A destroyed View cannot be shown. A View already owned by an Application, Region, or CollectionView must first be detached from that owner. A View adopting existing attached markup does not receive another attach notification just because a Region shows it.

An unmatched selector produces `MN0005` unless allowed; no configured element produces `MN0004`. A destroyed incoming View produces `MN0007`, and an already owned View produces `MN0003`. `allowMissingEl` skips that show attempt without taking ownership of the View. A later explicit operation retries an unresolved selector; the Region does not watch for DOM changes.

An unmatched lookup clears the cached `el` but retains the original selector. A later `show()` retries that selector and applies its missing-element options. With no current View, `empty()` also needs to resolve the element; `reset()` and `destroy()` use that emptying path. When a current View exists, cleanup releases it using the resolved element without another selector lookup. A skipped show leaves the Region usable for cleanup or a later explicit show.

Operations are synchronous. Lifecycle callbacks that throw interrupt the operation; Region does not roll back partially completed work.

## Empty, detach, reset, and destroy

| Method | Child and DOM behavior | Return |
| --- | --- | --- |
| `empty(options?)` | Destroys the current View and releases ownership. With no View, clears the Region element's contents. Keeps the Region usable and its resolved element cached. | Region |
| `detachView()` | Removes the current View from the DOM, releases ownership and parent event forwarding, and keeps the View alive. Emits the Region's empty events. | Detached View, or `undefined` |
| `reset(options?)` | Empties, then restores the original `el` reference. An initial selector is queried again on the next operation; an initial Element is reused. Requires emptying to succeed under the supplied missing-element options. | Region |
| `destroy(options?)` | Runs destroy notifications around reset/empty cleanup, unlinks a named View-owned Region, and releases its incoming and outgoing event subscriptions. | Region |

`empty()`, `reset()`, and `destroy()` use `ShowOptions` for element checking. `empty()` without options tolerates an unmatched selector when there is no child; supplying `allowMissingEl: false` makes that check strict. These options are not passed to the outgoing View's `destroy()`.

Keep a reference to a detached View and either give it a new owner or destroy it when finished. Detachment preserves the View's own listeners and state; its [View owner](view.md) stops forwarding its events. See [event cleanup](shared/events.md#cleanup) for native destruction and subscription ownership.

Repeated destruction is a no-op. Once destruction begins, `show()` does nothing and returns the Region; `detachView()` returns `undefined`. After destruction completes, `empty()` and `reset()` also do nothing and return the Region. Destruction leaves the Region's own element in place, with its owned View removed.

### Replacing the Region element

With `replaceElement: true`, the Region retains its original placeholder as `region.el` while the View's element occupies that position in the DOM. Emptying or detaching restores the placeholder. Replacement also works per call with `show(view, { replaceElement: true })`.

Use a placeholder that has a parent node: replacement exchanges nodes in that parent. `isReplaced()` reports whether the Region is currently using replacement mode. The placeholder is restored before the outgoing View is destroyed, which changes detach ordering as described below.

## Properties and queries

| Member | Result / purpose |
| --- | --- |
| `currentView` | The owned View or CollectionView, or `undefined`. Read this property; use lifecycle methods to change ownership. |
| `hasView()` | Boolean indicating whether `currentView` exists. Does not render or inspect the DOM. |
| `getOwner()` | The owning View, including a CollectionView for its empty-view Region, or `undefined`. This reports View registration; an Application's root Region does not report the Application here. |
| `getName()` | Name registered on the owning View, or `undefined` for standalone and unnamed Regions. |
| `isSwappingView()` | True during replacement, including `before:show`, empty, and `show` callbacks. False after a successful show finishes. |
| `isReplaced()` | Whether the placeholder is currently replaced by the View's root. |
| `isDestroyed()` | False before destruction completes; true before `destroy` notifications run. |
| `el` | Initial selector/Element, resolved Element after lookup, or `undefined` after an unmatched lookup. A successful `reset()` restores the initial reference. An unresolved selector is retried on the next element-dependent operation. |
| `options` | Merged constructor options. See [common options](shared/common.md). |
| `cid`, `cidPrefix` | Unique instance identifier and its class-level prefix (`'mnr'` by default). |
| `Dom` | DOM provider used for lookup, insertion, detachment, and replacement. Configure through `setDomApi`. |

## Lifecycle events and hooks

Each event uses `triggerMethod`: its matching hook runs first, then registered event listeners receive the same arguments. See [shared events](shared/events.md). Hook methods are supplied on a subclass, for example `onBeforeShow(region, view, options)`.

| Region event | Hook | Arguments |
| --- | --- | --- |
| `before:show` | `onBeforeShow` | `(region, incomingView, options)` |
| `show` | `onShow` | `(region, incomingView, options)` |
| `before:empty` | `onBeforeEmpty` | `(region, outgoingView)` |
| `empty` | `onEmpty` | `(region, outgoingView)` |
| `before:destroy` | `onBeforeDestroy` | `(region, options)` |
| `destroy` | `onDestroy` | `(region, options)` |

`options` is the object passed to `show()` or `destroy()`, or `undefined`. Empty events have no options argument. The current View is still present at `before:empty` and released by `empty`. Emptying a Region that has no View clears content without emitting empty events. When a child destroys itself, the Region releases it and emits empty events too.

For an occupied Region, `destroy()` runs: Region `before:destroy` → Region `before:empty` → child teardown → Region `empty` → Region `destroy`. The last notification observes `isDestroyed() === true` and cleared View-owner/name references.

### Replacing a CollectionView

Replacement follows the same Region sequence: `before:show` → `before:empty` → outgoing child teardown → `empty` → incoming render/attach → `show`. The outgoing CollectionView destroys its managed children during its teardown; its `before:destroy:children` and `destroy:children` notifications belong to the CollectionView.

Normally the outgoing View receives `before:destroy` before detach. With `replaceElement`, restoring the placeholder detaches it before `before:destroy`. An already rendered incoming View skips rendering. Descendant notifications follow the [View lifecycle](view.md#lifecycle-hooks-and-events); monitoring and attachment state determine which detach/attach notifications occur.

## Customization and inherited methods

Use `Region.extend(prototypeProperties?, staticProperties?)` or subclass Region. `initialize(options)` is the constructor hook; the default does nothing. For custom constructors and `Region.call` / `Region.apply`, see [class construction](shared/common.md).

| Extension point | Default contract |
| --- | --- |
| `getEl(selector)` | Returns the first matching native Element under `parentEl` or `document`, or `undefined`. Does not include the parent node itself in selector matching. |
| `attachHtml(view)` | Appends `view.el` inside `region.el`. Used for ordinary insertion; replacement uses the DOM provider's `replaceEl` instead. Returns `undefined`. |
| `detachHtml()` | Removes the contents of `region.el`. Returns `undefined`. Used for ordinary detachment and clearing unmanaged HTML. |
| `removeView(view)` | Calls `destroyView(view)` when emptying a live owned View. Returns `undefined`. Override only when intentionally replacing the default teardown policy. |
| `destroyView(view)` | Destroys a View unless it is already destroyed, respecting the owner's detach-monitoring policy. Returns that View. |

These methods are called by lifecycle operations. Calling DOM hooks directly does not perform the ownership bookkeeping of `show`, `empty`, or `detachView`. If overriding a lifecycle method, delegate to `Region.prototype` to retain the standard cleanup and event contract.

`Region.setDomApi(partialApi)` merges DOM methods into that class's provider and returns the class. Call it on a Region subclass to scope the override to that subclass. See [runtime configuration](runtime.md#choose-a-configuration-scope) for setter scope and [DomApi](providers/dom.md#domapi) for the provider-authoring contract.

Region inherits [common utilities](shared/common.md): `getOption`, `mergeOptions`, `normalizeMethods`, `bindEvents`, `unbindEvents`, `bindRequests`, and `unbindRequests`. It also inherits [event methods](shared/events.md): `on`, `once`, `off`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, and `stopListening`. Region has no state, model, collection, renderer, or Radio-channel initialization of its own.

## TypeScript types

All of these types are exported from `marionette`:

| Type | Use |
| --- | --- |
| `RegionOptions` | Constructor options from the first table. |
| `ShowOptions` | Per-operation boolean options and extra application-defined keys. |
| `RegionInstance<Options>` | Region instance contract, with its constructor-options type. |
| `RegionConstructor<Props, Args, Statics>` | Constructor, subclass properties, constructor arguments, and static members. `extend` carries these into derived classes. |
| `RegionDefinition`, `RegionClass` | Accepted named Region definition forms and the constructor type used by View/Application configuration. |
| `RegionOwner` | Structural type returned by `getOwner()`. Actual owners are Views; internal forwarding members on this type support the framework's ownership contract. |
| `SupportedView`, `ViewLifecycle` | Contracts used by Region and other composition owners. Native View and CollectionView satisfy them, including lifecycle state and child traversal. `SupportedView` adds `render()` and `destroy()`. |

`show()` is typed as the Region or `undefined`; `detachView()` returns `SupportedView | undefined`. `empty()`, `reset()`, and `destroy()` preserve the derived instance type for chaining. Private lifecycle fields in `ViewLifecycle` are framework integration details, not fields to mutate in application code.
