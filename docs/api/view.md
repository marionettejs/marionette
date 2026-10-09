# View

[API index](../api.md) · [Region](region.md) · [Shared View runtime](shared/view-bindings.md)

A View owns one fixed DOM element, renders supplied data, and can compose child Views through named [Regions](region.md). Use it for an individual control or a layout. [CollectionView](collection-view.md) manages a set of children instead.

Import `View` from `marionette`. Shared rendering, DOM, UI, data bindings, and child forwarding are defined in [View runtime](shared/view-bindings.md). Inherited [common methods](shared/common.md), [events](shared/events.md), and [state](shared/state.md) are part of this API.

## Local interaction and feature coordination

A View can own local input state and save an edit to its model when the data layer supplies that operation. Calling `this.model.save(...)` from an input handler can be appropriate. With `@mnjs/data`, a local edit can instead call the application's API layer and update the model with `set`; the package supplies no persistence method. Having other Views observe the same model does not make that handler responsible for their presentation; each consumer handles its own updates.

Use an [Application](application.md) to coordinate feature readiness and shared workflow decisions. For these actions, the View emits intent; the Application decides what work to start and where its result belongs. Starting a feature's initial load in `onRender` ties readiness to rendering and can repeat the request on rerender. Put that readiness in [Application preparation](application.md#prepare-before-showing-ui).

For shared records or selection that change over time, receive an observable source and use [model/collection bindings](shared/view-bindings.md#data-bindings) or [state bindings](shared/state.md). A replacement View reads current data and subscribes for later changes. Its owner can then replace it without coordinating each presentation update.

## Construction and options

`new View(options?)` creates the element, delegates DOM events, prepares state access and Behaviors, registers Regions, and calls `initialize(options)`. It does not evaluate the template. `View.extend(prototypeProperties?, staticProperties?)` returns a subclass; see [class extension](shared/common.md).

Options below can be declared on the class or supplied at construction. The table identifies which declarations accept resolver functions; those resolvers run with the View as `this`. The renderer controls template invocation. Model, collection, and borrowed state values are used as sources, not invoked as resolvers.

| Option | Accepted value and default |
| --- | --- |
| `el` | An `Element` or function returning one. Otherwise Marionette creates a root from `tagName`. Pass an actual element, not a selector string. |
| `tagName` | String or function returning one; default `'div'`. Used only when creating a root. |
| `id`, `className` | String, `null`, or function returning a string, `null`, or `undefined`. Applied when creating a root; see [attributes](shared/view-bindings.md#root-attributes). |
| `attributes` | Attribute map or function returning one. `id` and `className`, when declared, take precedence over its `id` and `class` entries. |
| `template` | A template understood by the configured renderer, or `false` to preserve existing contents. The default renderer expects a function. No default template is supplied. |
| `templateContext` | Object or function returning an object, merged over serialized data on each render. |
| `model`, `collection` | Sources understood by the configured DataApi. A View serializes the model when both are present. Supplying either does not enable automatic rendering on change. |
| `ui` | Map of names to selectors, or function returning that map. See [UI bindings](shared/view-bindings.md#ui-bindings). |
| `events`, `triggers` | DOM event maps or functions returning them. See [DOM events](shared/view-bindings.md#dom-events). |
| `modelEvents`, `collectionEvents` | Source event maps or functions returning them. See [data bindings](shared/view-bindings.md#data-bindings). |
| `state`, `stateEvents` | Borrowed state and its event bindings. `createState(options)` can supply owned state instead. See [state](shared/state.md). |
| `regions` | Map of names to Region definitions, or function returning that map; default empty. Definitions are described below. |
| `regionClass` | Default Region constructor for this View's definitions; default `Region` from its Marionette runtime. Individual definitions may override it. |
| `childViewEvents`, `childViewTriggers`, `childViewEventPrefix` | Parent handlers, event remapping, and optional prefix; see [child forwarding](shared/view-bindings.md#child-events). Prefix forwarding defaults to `false`. |
| `behaviors` | Array or object of Behavior definitions, or function returning either. See [Behavior composition](shared/view-bindings.md#behavior-composition). |

`preinitialize(options)` runs before the element, Behaviors, and Regions are initialized; `cid`, `options`, and recognized constructor declarations are already available. `initialize(options)` runs after those resources exist and before state/entity event bindings become active. Both hooks are no-ops by default. Constructor values for root-element configuration, model, collection, and DOM events take precedence over assignments made in `preinitialize`.

`options` contains merged class and constructor options. Custom options remain accessible through `getOption(name)`; they are not automatically assigned as instance properties. Declare `cidPrefix` on the class to change the default `'mnv'`; `cid` is the generated instance identifier.

## Existing elements

Construction adopts the supplied element without replacing its contents or applying root attributes. An element with child nodes starts with `isRendered() === true`; an element already inside its document starts attached. Construction does not emit render or attach lifecycle events. UI bindings are available immediately when existing contents are detected.

Use `template: false` to preserve existing HTML. `render()` then returns the View without rendering, resetting Regions, or emitting render events. Destroying the View still removes its element and destroys managed children. The root stays fixed for the View's lifetime; construct a new View to use a different root.

This standalone TypeScript example adopts markup and adds a child without rendering the parent:

```ts
import { View, type ViewConfiguration } from 'marionette';

const el = document.createElement('section');
el.innerHTML = '<h2>Preview</h2><div class="content"></div>';
document.body.append(el);

const options: ViewConfiguration = {
  el,
  template: false,
  regions: { content: '.content' },
};
const page = new View(options);
const message = document.createElement('p');
message.textContent = 'Ready';
const child = new View({ el: message, template: false });

page.showChildView('content', child);
page.destroy(); // Removes the adopted section and destroys the child.
```

## Rendering and status

| Method or property | Contract |
| --- | --- |
| `el` | The resolved, fixed root `Element`. |
| `render()` → `this` | Resolves `getTemplate()`, emits `before:render`, resets existing Regions when already rendered, renders into the root, binds UI, sets rendered state, and emits `render`. Reset destroys current children but keeps Region registrations. Destroyed Views and `template: false` do not render. |
| `isRendered()` → boolean | Whether rendered contents have been established or were present at construction. Becomes false on destruction. |
| `isAttached()` → boolean | Attachment state maintained by Marionette's lifecycle. Direct DOM moves do not update it automatically. |
| `isDestroyed()` → boolean | Whether destruction has reached its terminal state. |
| `destroy(options?)` → `this` | Removes the root, destroys Regions and their current children, releases bindings/Behaviors/owned state, emits destruction notifications, and releases incoming and outgoing event subscriptions. Repeated calls do nothing. Model and collection sources are not destroyed by the View. |

For template selection, serialization, `renderAttributes`, and renderer customization, see [rendering contracts](shared/view-bindings.md#templates-and-data). `render()` does not refresh root attributes or automatically redelegate changed DOM event maps.

## Named Regions

A `regions` map accepts a selector string, Region constructor, Region instance, or options object such as `{ el: '.content', replaceElement: true }`. An options object can include `regionClass`. Supply options as own enumerable properties; inherited and non-enumerable option properties are not copied. Use a Region subclass for prototype defaults. String selectors resolve inside the View's root by default; `@ui.name` is accepted in selectors and the `el` field. Full Region options are in [Region](region.md). Registration copies the definition map and options objects before resolving UI selectors, so shared declarations remain unchanged and each View uses its own UI map. Supplied Region instances and constructors retain their identity.

Regions are created before `initialize`; their elements can resolve later when content exists. A Region has one owner/name and must belong to the same Marionette runtime. Names must be nonempty strings. Re-registering the same instance under its existing name is harmless; a different definition under an occupied name throws. Remove the old Region before replacing its definition.

| Method | Result and effects |
| --- | --- |
| `addRegion(name, definition)` | Returns the registered Region. Does not render the parent. |
| `addRegions(definitions?)` | Returns a map of the added Regions, or `undefined` for no definitions. Does not render the parent. |
| `hasRegion(name)` | Returns whether that name is registered; no rendering. |
| `getRegion(name)` | Returns the Region or `undefined`; no rendering or element resolution. |
| `getRegions()` | Returns a new map containing current Region instances; no rendering. Changing this map does not change registrations. |
| `showChildView(name, view, options?)` | Renders the parent if needed, shows the child through the named Region, and returns the supplied child. Accepts Region `ShowOptions`. A skipped show with `allowMissingEl` still returns the child but leaves it unowned; the caller must show it elsewhere or destroy it. |
| `getChildView(name)` | Renders the parent if needed, then returns the Region's current child or `undefined`. |
| `detachChildView(name)` | Renders the parent if needed, detaches and releases the current child, and returns it or `undefined`. The child remains alive and becomes the caller's responsibility. |
| `emptyRegions()` | Renders the parent if needed, empties each Region, and returns a map of them. Keeps Region registrations. |
| `removeRegion(name)` | Destroys and unregisters the Region, including its current child; returns the destroyed Region. |
| `removeRegions()` | Destroys/unregisters every Region; returns a map of the destroyed Regions. |

The child operations and `removeRegion` throw for a missing Region. Region registration/removal emits no View `add:region` or `remove:region` events; observe the Region's lifecycle when needed. Rendering an existing layout resets Regions and destroys their children, so render a smaller child when the surrounding composition should remain alive. An allowed missing-element lookup leaves the Region usable for this reset and for parent destruction.

## Lifecycle hooks and events

Each event below uses `triggerMethod`: the corresponding hook runs first, then event subscribers receive the same arguments. The shared monitor can emit nested child/DOM notifications while an event is being delivered; the phases below describe lifecycle order rather than the ordering of every subscriber. See [event dispatch](shared/events.md).

| Event | Hook | Arguments and timing |
| --- | --- | --- |
| `before:render` | `onBeforeRender` | `(view)` before existing Regions reset or template output changes. |
| `render` | `onRender` | `(view)` after output, UI binding, and rendered state are ready. |
| `before:attach` | `onBeforeAttach` | `(view)` before an owning Region/CollectionView inserts the root into the document. |
| `attach` | `onAttach` | `(view)` after insertion and attached state update. |
| `dom:refresh` | `onDomRefresh` | `(view)` when an attached View renders or a rendered View attaches. |
| `before:detach` | `onBeforeDetach` | `(view)` before removal of an attached root. |
| `dom:remove` | `onDomRemove` | `(view)` during `before:detach` or `before:render` when currently attached and rendered. |
| `detach` | `onDetach` | `(view)` after removal and attached state update. |
| `before:destroy` | `onBeforeDestroy` | `(view, options)` while `isDestroyed()` is false, before root/child cleanup. |
| `destroy` | `onDestroy` | `(view, options)` after root/child cleanup and destroyed state update; event subscriptions are cleared afterward. |

For a newly constructed View with a rendering template shown in an attached Region, the usual successful path is:

```text
constructed → render → attach → dom:refresh
                         │
                         ├── render again → dom:refresh
                         └── detach → alive, reusable → attach → dom:refresh

live View → before:destroy → detach if attached → child cleanup → destroy
```

Existing markup can start rendered or attached without emitting those construction-time events. With `template: false`, `View.render()` is a no-op and emits no render events. For an initially empty View, `Region.show()` still marks it rendered, so attachment can emit `dom:refresh`. Detachment keeps the View alive; destruction is terminal.

Showing an initially unrendered detached View in an attached Region normally proceeds through render, then attach, then DOM refresh. A direct destroy normally proceeds through `before:destroy`, detach phases if attached, child destruction, and `destroy`. Managed children receive attach/detach propagation; during parent destruction they are destroyed after the parent root is detached. A CollectionView owner may detach a child before destroying it, so its child ordering differs; see [Region replacement](region.md#replacing-a-collectionview).

Lifecycle callbacks are synchronous. A thrown callback interrupts the operation; these phases describe successful completion, not rollback guarantees.

Set `monitorViewEvents: false` on the class to disable descendant attachment propagation and generated `dom:refresh`/`dom:remove` notifications. This is a class property, not a recognized constructor option. Ordinary application code should retain monitoring. `monitorViewEvents(view)` is the exported installer used by Marionette; it returns `undefined` and installs handlers only once, unless monitoring is disabled before installation. Native View and CollectionView construction installs it automatically. A custom integration must satisfy `ViewLifecycle`, including event methods, rendered/attached flags and immediate-child traversal. The installer propagates existing lifecycle events; it does not watch external DOM changes.

### Compose children after rendering

Use `onBeforeRender` or a `before:render` listener to prepare template inputs or inspect the existing UI. Avoid operations that render an unrendered parent: `showChildView()`, `getChildView()`, `detachChildView()`, and `emptyRegions()` each reenter the same notification. An unconditional callback recurses; a one-time callback can complete an inner render. If it shows a child, the outer render then resets the Region and destroys that child. Showing children here is also unsafe on later renders, because existing Region children are still reset after `before:render`. `getRegion()` itself is a pure lookup and does not render.

Compose children in `onRender` or a `render` listener, after the parent's template and Regions are ready:

```js
import { View } from 'marionette';

const Page = View.extend({
  template: () => '<section class="content"></section>',
  regions: { content: '.content' },
  onRender() {
    this.showChildView('content', new View({ template: () => 'Ready' }));
  },
});

const page = new Page().render();
```

Each full parent render destroys the previous child and composes a new one; parent destruction destroys the current child. Do not call the parent's `render()` again from that completion callback. For `template: false`, no render notification occurs: compose explicitly after establishing the existing markup, as in [existing elements](#existing-elements). CollectionView has a corresponding [manual-child boundary](collection-view.md#compose-manual-children-after-rendering).

## Configuration and inherited API

The class methods `setRenderer`, `setDomApi`, `setDataApi`, `setStateApi`, and `setEventDelegator` return the receiving class. Their [configuration contracts](shared/view-bindings.md#class-configuration) apply to subclasses as well. Configure before constructing Views.

The following methods are shared with other classes; their canonical definitions are linked rather than repeated:

- [Common](shared/common.md): `getOption`, `mergeOptions`, `normalizeMethods`, `bindEvents`, `unbindEvents`, `bindRequests`, `unbindRequests`, `extend` and constructor inheritance.
- [Events](shared/events.md): `on`, `once`, `off`, `trigger`, `triggerMethod`, `listenTo`, `listenToOnce`, `stopListening`.
- [State](shared/state.md): `createState`, `getState`, `state`, `stateEvents`, and the `State` provider.
- [View runtime](shared/view-bindings.md): `$`, `getUI`, UI normalization/binding, DOM/entity delegation, template serialization, `attachElContent`, root attributes, Behaviors, and child events.

## TypeScript

`ViewConfiguration` describes recognized options. `ViewInstance<Options, State, Query>` describes instances; `Query` defaults to `ArrayLike<Element>` and follows the DOM provider. `ViewConstructor<Props, Args, State, Statics, Query>` describes constructors and preserves properties, arguments, state, static members, and fluent returns through `extend`. Normal application code can use inferred subclasses instead of spelling out these generics.

Region definitions use exported `RegionDefinition` and `RegionClass`; child methods accept `SupportedView` and `ShowOptions`. These are structural contracts, not a promise that an arbitrary object with `render()` is a fully managed child. DOM maps, UI maps, and renderer types are listed in [View runtime](shared/view-bindings.md#types).
