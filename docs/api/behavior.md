# Behavior

[API index](../api.md) · [View](view.md) · [CollectionView](collection-view.md)

Behavior adds reusable local interaction to a View or CollectionView. It shares the host's element and lifetime. Use a View method for one-off interaction; extract a Behavior when multiple hosts need the same behavior. Feature requests, navigation and application composition belong with their owner, not in a DOM helper.

## Reuse a local interaction

This Behavior turns Escape into a host event. The owner of the host decides how to dismiss it.

```ts
import { Behavior, View } from 'marionette';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import { html } from 'lit-html';

const DismissOnEscape = Behavior.extend({
  events: { keydown: 'handleKeydown' },
  handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.view.triggerMethod('dismiss', this.view);
    }
  },
});

const SearchPanel = View.extend({
  behaviors: [DismissOnEscape],
  template: () => html`<input aria-label="Search">`,
}).setDomApi(LitDomApi);

const panel = new SearchPanel();
panel.render();
```

The host owns the Behavior. Destroying the host removes the Behavior's DOM and data subscriptions too. Rendering the host again retains the Behavior instance.

## Declare and construct

Declare Behaviors through the host's `behaviors` option: an array or named map of Behavior constructors or `{ behaviorClass: SomeBehavior, ...options }` definitions. A function can return that array/map. See [composition](shared/view-bindings.md#behavior-composition). The host constructs and manages these instances; declaration names are not a public lookup API.

`new Behavior(options, host)` requires a host. Prefer host declarations for automatic composition and teardown; constructing an instance directly does not register it in the host's managed Behavior list. A class entry receives an empty options object; an object definition, including `behaviorClass`, is passed to its constructor as options. Behavior options do not inherit the host's options.

Construction establishes `view`, `el`, options, `cid`, and state access before `initialize(options, host)`. UI selectors are resolved before this hook; state and DOM bindings initialize afterward. The host's `initialize` runs after its Behaviors are constructed. Behavior has no `preinitialize` hook.

| Option | Contract |
| --- | --- |
| `events`, `triggers` | DOM event maps or functions returning maps; selectors may use `@ui.name`. See [DOM interaction](#dom-interaction-and-ui). |
| `ui` | Named selector map or function returning one. Merged with host UI; host entries win on matching names. |
| `modelEvents`, `collectionEvents` | Event-to-handler maps or functions returning maps. Observe the host's model/collection through its DataApi. |
| `state`, `stateEvents` | Borrowed state and declarative observation, independent of the host's state. See [state](shared/state.md). |

Maps use functions or Behavior method-name strings for handlers, except `triggers`, whose values name host events. Custom options remain in `options` and are read with `getOption`. Recognized maps replace inherited maps, with the special host UI merge described above.

`Behavior.extend(prototypeProperties?, staticProperties?)` creates a subclass. `cidPrefix` defaults to `'mnb'`. `view` is the host; `el` is its fixed root element. There is no separate Behavior element, template, render method, or Region. Common extension and option methods are in [class utilities](shared/common.md).

## DOM interaction and UI

`events` callbacks run with the Behavior as `this` and receive the DOM event. `triggers` call the **host's** `triggerMethod`, passing `(host, DOMEvent, ...extraArgs)`. A string trigger prevents default and stops propagation; use `{ event, preventDefault: false, stopPropagation: false }` to opt out. See the shared [DOM event contract](shared/view-bindings.md#dom-events).

| Method | Contract |
| --- | --- |
| `$(selector)` | Forwards to the host's scoped query method. Returns the host's query collection. |
| `getUI(name)` | Returns the bound query collection, or `undefined` for an unknown name. Throws `MN0023` before UI binding. Read it after UI binding, usually in `onRender`. |
| `bindUIElements()` | Resolves the Behavior's selectors against the host; returns this Behavior. |
| `unbindUIElements()` | Releases bound UI references; returns this Behavior. |
| `normalizeUIString(value, bindings?)` | Expands `@ui.name` tokens in a selector string. |
| `normalizeUIKeys(map, bindings?)` | Returns a map with UI tokens expanded in its keys. |
| `normalizeUIValues(map, property?, bindings?)` | Mutates and returns the map, expanding tokens in string values or the named property of object values. See [UI helpers](shared/view-bindings.md#ui-bindings). |

The host coordinates UI rebinding during rendering. A saved query still points at its previous elements after a rerender; call `getUI` again. Do not assume Behavior UI is bound in `initialize`. A template-less CollectionView does not automatically bind Behavior UI; call the host's `bindUIElements()` when using existing elements. The Behavior shares the host's [fixed root](view.md#existing-elements).

`Behavior.setEventDelegator(provider)` replaces that class's DOM event provider and returns the class. `EventDelegator` is the provider slot. It is configured on the Behavior class independently from a host-specific override; runtime-wide configuration can configure both. There is no Behavior `setRenderer`, `setDomApi`, or `setDataApi`.

## Host events and data

Host events are forwarded to each Behavior's `triggerMethod` with their original arguments. A host `save` event invokes Behavior `onSave` and its `save` subscribers. The host's hook runs first when the host uses `triggerMethod`. Calling a Behavior's own `triggerMethod` only notifies that Behavior; use `this.view.triggerMethod(...)` to emit host intent as above. That host event is forwarded back to the sending Behavior too; an `onDismiss` hook must not re-emit the same host event recursively.

`initialize(options, host)` initializes the Behavior itself. The separate `onInitialize(host, options)` notification runs after the host's initialization. View lifecycle hooks such as `onRender`, `onAttach`, `onDetach`, `onBeforeDestroy`, and `onDestroy` receive the **host** and its event arguments. See the host's [View lifecycle](view.md#lifecycle-hooks-and-events) or [CollectionView lifecycle](collection-view.md#lifecycle-and-extension-points) for event-specific contracts.

`modelEvents` and `collectionEvents` bind after host initialization. Handlers use the Behavior as context and preserve the source's arguments. Access sources as `this.view.model` and `this.view.collection`. `delegateEntityEvents()` binds the current declarations to those sources; `undelegateEntityEvents()` removes those bindings. Both return the Behavior. Before explicitly rebinding, undelegate the old bindings. Reassigning a model or declaration does not automatically rebind it.

`createState(options)`, `getState()`, `stateEvents`, `State`, and `Behavior.setStateApi(api)` follow the shared [state contract](shared/state.md). The Behavior's StateApi is independent of its host's provider. State observation does not require rendering or attachment. A host's state is not automatically the Behavior's state; pass a borrowed source deliberately when sharing it.

## Destruction and nested Behaviors

Host destruction invokes `destroy()` on its managed Behaviors. Behavior cleanup removes DOM handlers, state observation/owned state, host subscriptions, and host model/collection subscriptions. Direct destruction releases its own event subscriptions immediately. During host teardown, these subscriptions remain until the host forwards its final destroy notification, then are released. Behavior cleanup does not destroy the host or borrowed sources.

Direct `behavior.destroy()` returns the Behavior and removes it from the host's managed list. It emits **no independent `before:destroy` or `destroy` notification** and has no public `isDestroyed()` method. `onBeforeDestroy`/`onDestroy` are forwarded host notifications: a removed Behavior no longer receives them. When the host destroys a managed Behavior, its final `onDestroy(host, options)` notification arrives after Behavior resource cleanup. If a Behavior must release an extra resource on both direct and host teardown, override `destroy` and delegate to `Behavior.prototype.destroy.call(this)` as part of that cleanup. Make the extra cleanup safe to repeat, since direct Behavior destruction has no once-only guard; do not rely only on `onDestroy`.

A Behavior subclass may declare nested `behaviors` using the same definitions as a host. Those instances share the original host and are owned by it. Destroying the declaring Behavior alone leaves its nested Behaviors alive. Use nesting to group host interactions, not to model a child lifetime.

## TypeScript

Import `BehaviorOptions`, `BehaviorHost`, `BehaviorInstance`, and `BehaviorConstructor` from `marionette`. `BehaviorInstance<Options, Host, State, Query>` describes custom options, host, state source and query collection. `BehaviorHost` is a structural host contract; View and CollectionView satisfy it. `BehaviorDefinition`, `BehaviorDefinitions`, and `BehaviorOptionsDefinition` describe host declarations. `DOMEvents`, `DOMTriggers`, `UISelectors`, and `UIBindings` describe shared maps.

Use [common methods](shared/common.md), [events](shared/events.md) and [state](shared/state.md) for inherited contracts.
