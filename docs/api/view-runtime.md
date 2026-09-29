# Shared View runtime

[View](view.md) and [CollectionView](collection-view.md) share the contracts on this page. Their rendering/composition lifecycles remain class-specific. For common object methods, event subscriptions, and state ownership, see [common](common.md), [events](events.md), and [state](state.md).

## Templates and data

`template` is a value understood by the renderer. The default renderer calls a template function as `template(data)`; it does not compile template strings. `template: false` disables template rendering. The default DOM provider inserts renderer output as HTML; choose a renderer/DOM integration appropriate to the output. [Setup](../setup.md#configure-once) shows the Lit integration, whose ordinary interpolations render values as text.

| Method | Default contract and extension use |
| --- | --- |
| `getTemplate()` | Returns `this.template`. Override to choose a template for the current View. |
| `serializeData()` | Serializes `model` if present; otherwise returns `{ models: serializeCollection() }` for a collection, or `undefined`. Override to supply a different template data shape. |
| `serializeModel()` | Returns `this.Data.serialize(this.model)`. |
| `serializeCollection()` | Returns `this.Data.models(this.collection).map(model => this.Data.serialize(model))`. |
| `mixinTemplateContext(data)` | Resolves `templateContext`, then shallow-merges its own enumerable properties over data. Does not mutate either input. Returns either input directly when the other is falsy. |
| `attachElContent(output)` | Sends renderer output to `this.Dom.setContents(this.el, output)`. Override for a specialized insertion strategy that keeps the View's root. Returns no defined value. |

Rendering obtains the template, prepares serialized data plus template context, calls the configured renderer with the View as `this`, and passes its return value to `attachElContent`. Falsy final template data becomes `{}`. The default template function itself receives no View context; use `templateContext` or serialization for View-derived values.

This standalone example configures a subclass with Lit, renders plain supplied data, and cleans up:

```js
import { View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const Greeting = View.extend({
  template: ({ name }) => html`<p>Hello, ${name}</p>`,
});
Greeting.setDomApi(LitDomApi);

const greeting = new Greeting({ model: { name: 'Sam' } });
greeting.render();
greeting.destroy();
```

This uses the default DataApi, which serializes plain values unchanged. Observable Models/Collections need their [DataApi configuration](../setup.md#configure-once). Data changes do not automatically render a View; select the events and response explicitly.

## Root attributes

`renderAttributes()` reevaluates `attributes`, `id`, and `className`, applies them to `el`, and returns the View. It does not render a template, rebuild children, rebind UI, or emit render events. It does nothing while destroying or destroyed.

When creating a root, Marionette applies these declarations once. A supplied root is untouched until an explicit `renderAttributes()`. The native DomApi removes attributes whose value is `null`, leaves `undefined` and omitted keys unchanged, and stringifies other values. `id` and `className` override the corresponding entries in `attributes` when declared. Calling `render()` does not refresh these root declarations.

## UI bindings

Declare `ui` as `{ name: 'selector' }` or a function returning that map. After binding, `ui` contains query results; Marionette retains the selectors for rebinding. Use `@ui.name` in DOM event/trigger keys and View Region selectors to reuse them.

| Method | Contract |
| --- | --- |
| `$(selector)` | Queries descendants of `el`; the root itself is excluded by the native DomApi. Returns the provider's query type (native: static `NodeList`). |
| `getUI(name)` | Returns the bound query result or `undefined` for an unknown name. Throws if no UI map was declared or it has not been bound. Use `[0]` when the first native element is needed. |
| `bindUIElements()` → `this` | Resolves the UI map and queries the current DOM, including Behavior UI. Normally automatic after rendering or construction with existing contents. No-op while destroying/destroyed. |
| `unbindUIElements()` → `this` | Releases query bindings and restores the selector declarations, including Behavior UI. Destruction does this automatically. |
| `normalizeUIString(value, bindings?)` | Returns a string with `@ui.name` references replaced by selectors. |
| `normalizeUIKeys(map, bindings?)` | Returns a new map with normalized keys; nullish input returns `{}`. |
| `normalizeUIValues(map, property?, bindings?)` | Normalizes string values or a named property of object values **in place** and returns the same map. |

Normalization uses the View's original selector map unless an explicit map is provided. An empty or undeclared `@ui` name throws. Bound queries are snapshots; manually changed contents need rebinding before querying through `getUI` again.

## DOM events

`events` maps `'event selector'` to a callback or View method name. Omit the selector to listen on the root. Callbacks run with the View as `this` and receive the DOM event. With the native delegator, a selector matches the nearest matching descendant on the event path, exposed as `event.delegateTarget`; `focus` and `blur` use capture. The root is not a selector match.

`triggers` maps the same DOM keys to a View event name or `{ event, preventDefault, stopPropagation }`. A trigger calls `view.triggerMethod(eventName, view, domEvent, ...extraArguments)`. Both prevention flags default to `true`; set either to `false` to allow that browser behavior. `events` handlers do not receive these automatic prevention calls.

Both maps may be functions evaluated on the View. `@ui` selectors are resolved before delegation. A missing named handler is an error.

| Method | Contract |
| --- | --- |
| `delegateEvents(events?)` → `this` | Removes existing View/Behavior DOM handlers, refreshes child event maps, then binds the explicit event map or current `events`, plus current `triggers` and Behavior DOM handlers. Use after changing declarations. |
| `undelegateEvents()` → `this` | Releases View and Behavior DOM handlers. |

Both methods are no-ops while destroying/destroyed. Construction delegates automatically; destruction releases handlers automatically. Detaching a live View preserves its DOM bindings. Rendering does not reread changed event declarations.

## Data bindings

`modelEvents` and `collectionEvents` map source event names to callback functions or View method names; either map may be returned from a function. Bindings use the configured `Data.subscribe`, preserve source arguments, and invoke callbacks with the View as `this`. A plain object/array can supply template data, but the default DataApi requires an `on`/`off` source when an event map is present. Use the appropriate adapter for observable data.

`delegateEntityEvents()` binds current model/collection declarations, including Behaviors, and returns the View. `undelegateEntityEvents()` releases those subscriptions and returns the View. Construction binds them after `initialize`; destruction releases them. Before replacing a source or rebinding a map, call `undelegateEntityEvents()`, assign the new source/declarations, then call `delegateEntityEvents()`. Delegation alone does not release a previous subscription.

For a small View, `modelEvents: { change: 'render' }` rerenders when an observable model changes. On a layout View, that also resets its Regions and destroys their children; see [View rendering](view.md#rendering-and-status).

These bindings do not own or destroy the model/collection. State bindings have separate ownership and delivery rules: see [state](state.md).

## Child events

The owning View/CollectionView can handle events from its immediate managed children:

| Declaration | Behavior |
| --- | --- |
| `childViewEvents: { eventName: handler }` | Calls a parent method name or callback with the parent as `this` and the child's original event arguments. |
| `childViewTriggers: { eventName: parentEvent }` | Calls `parent.triggerMethod(parentEvent, ...originalArguments)`. |
| `childViewEventPrefix: 'child'` | Forwards every child event as `child:eventName` through `triggerMethod`. Defaults to `false`; set `false` to disable prefix forwarding. |

Each declaration may be a function evaluated on the parent. When all apply, the order is the mapped handler, mapped parent event, then prefixed event. No child argument is added: a DOM `triggers` event already supplies its View, while `child.trigger('selected', id)` supplies only `id`. Define explicit mappings at each level when forwarding through nested composition.

The maps are prepared during construction and refreshed by `delegateEvents()`. Region/CollectionView ownership establishes forwarding and releases it when the child leaves. See [subscription cleanup](events.md#cleanup) for native destruction and listener ownership.

## Behavior composition

`behaviors` accepts an array or named object containing Behavior constructors or `{ behaviorClass: BehaviorClass, ...options }` entries. A function can return either shape. Names organize the definitions; the View does not expose a public lookup-by-name API. Nested Behavior definitions are composed onto the same host.

Marionette constructs each Behavior with `(options, view)`. Behaviors share the host's fixed element and data sources; their DOM events, triggers, UI and entity bindings join the host's lifecycle. Host UI selectors override Behavior selectors with the same name. Behavior DOM triggers emit on the host. Host events are forwarded through each Behavior's `triggerMethod`, including an initialization notification after the host is initialized. Host destruction releases Behaviors and their owned state; it delivers the host's destroy notification to them.

This defines the View's accepted composition option. The [Behavior reference](behavior.md) covers its own APIs, forwarded hooks, and direct versus host destruction.

## Class configuration

Configure a subclass before creating its instances. Each setter returns that class and changes its prototype configuration. Descendants inherit configuration unless they override it; changing a subclass does not modify the parent class.

| Static method | Effect |
| --- | --- |
| `setRenderer(renderer)` | Replaces `_renderHtml` with a function `(template, data) → output`, invoked with the View as `this`. Pass a usable renderer; omitting it assigns `undefined` and does not restore the default. |
| `setDomApi(mixin)` | Shallow-merges methods over the class's existing `Dom` provider, preserving unspecified methods. Controls root creation, queries, attributes, content insertion, and DOM attachment operations. |
| `setDataApi(mixin)` | Shallow-merges methods over `Data`. A View uses `serialize`, `models`, and `subscribe`; CollectionView also uses collection identity/observation operations. |
| `setStateApi(mixin)` | Shallow-merges methods over `State`. See [state configuration](state.md). |
| `setEventDelegator(delegator)` | Replaces `EventDelegator`. Its `delegate({ eventName, selector, handler, rootEl })` must return the cleanup function used when undelegating/destroying. |

`Dom`, `Data`, `State`, `EventDelegator`, and `_renderHtml` are the instance-visible configuration slots. Prefer setters for class configuration; `Dom`, `Data`, `State`, `EventDelegator`, `_renderHtml`, and `monitorViewEvents` are not recognized constructor options. `_renderHtml` is the renderer extension slot despite its underscore; `attachElContent` is the insertion extension point.

The [setup recipe](../setup.md#configure-once) uses top-level setters to configure all relevant default classes together. See [runtime configuration](runtime.md) for isolated families and setter scope, [rendering/DOM providers](dom-providers.md) for authoring interfaces, and [data/state providers](data-providers.md) for observation and disposal.

## Types

Import these types from `marionette`:

- `DOMEvents`: event-key map to callbacks or method names. `DOMTriggers`: event-key map to `TriggerDefinition`; `TriggerOptions` describes object triggers.
- `UISelectors`: string selector map. `UIBindings`: that map or a function returning it. Query results follow `ViewInstance`'s `Query` type.
- `Bindings`: source event map used by model, collection, and state bindings.
- `BehaviorDefinition`, `BehaviorDefinitions`, `BehaviorOptionsDefinition`: the constructor/options entry, collection of entries, and object-entry shape.
- `Renderer<Receiver, Template, Data, Output>`: renderer signature. `DomApiContract`, `DataApiContract`, `StateApiContract`: provider interfaces; setters accept partial overlays for these three APIs.
- `EventDelegator`, `DelegateOptions`, `DelegatedEvent`: the DOM delegation provider, registration arguments, and native event with optional `delegateTarget`.

These types expose configuration and integration boundaries. The complete interfaces are in [rendering/DOM providers](dom-providers.md) and [data/state providers](data-providers.md).
