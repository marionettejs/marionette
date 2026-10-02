# State

Application, View, CollectionView, Behavior, and MnObject can own state or borrow a supplied source. Region has no state API. State is separate from a View's `model` and `collection`; it is not automatically included in template data.

## Create or supply state

| Member | Contract |
| --- | --- |
| `createState(options)` | Override to create state owned by this instance. Receives the original constructor options. The default returns a new plain object. |
| `getState()` | Returns the same state source for the owner's lifetime. Calls `createState` lazily on first access when no state was supplied. |
| Constructor `state` | Supplies the exact borrowed source. A non-`undefined` supplied value takes precedence over a class's `state` property and `createState`. |
| Prototype/instance `state` | Supplies a borrowed source when no non-`undefined` constructor state is supplied. A function is treated as the source itself; use `createState` for a factory. |
| `stateEvents` | An event-to-handler map, or function returning one. Values are functions or instance method-name strings. Can be defined on the class or passed as a constructor option. |

Calling `getState()` in `initialize` is supported. Declaring `stateEvents` requests the state during construction, after `initialize`, so observable state is often created then. Rendering or restarting does not create new state.

```js
import { View } from 'marionette';
import { Model, StateApi } from '@mnjs/data';

const Disclosure = View.extend({
  template: false,
  createState() { return new Model({ expanded: false }); },
  stateEvents: { 'change:expanded': 'updateExpanded' },
  initialize() { this.updateExpanded(); },
  updateExpanded() {
    this.el.setAttribute('aria-expanded', String(this.getState().get('expanded')));
  }
});

Disclosure.setStateApi(StateApi);

const disclosure = new Disclosure({ tagName: 'button' });
disclosure.getState().set('expanded', true);
disclosure.destroy();
```

This uses native data only for observable state. API access and persistence remain separate concerns; see [data setup](../../integrations/setup.md#observable-data-and-api-access).

## Observe state

The configured StateApi subscribes to each literal event name and calls its handler with the owner as `this`. Callback arguments come from the state source unchanged. For `@mnjs/data` Model's `change:expanded`, those arguments are `(model, value, change)`, with mutation options plus `changed` and `previous` properties in `change`. Another state source can have a different event contract. The bindings are initialized once; assigning a new `state` or `stateEvents` property later does not replace them.

The default StateApi cannot observe the plain-object default state. Configure a compatible StateApi before constructing an owner with `stateEvents`; otherwise subscription throws `MN0037`. Changing a plain object's property does not synthesize an event.

| Owner | When `stateEvents` deliver |
| --- | --- |
| View, CollectionView, Behavior, MnObject | After their state bindings initialize, until destruction releases them. View delivery does not require render or DOM attachment; detaching a View keeps its state observation. |
| Application | Only while `isRunning()` is true, including `onStart` and preparation during an active restart. Delivery stops before root View teardown. Startup, stopped, and failed-start writes are not replayed when the Application later activates. |

Application's activity rule applies to configured `stateEvents`. An explicit `app.listenTo(state, ...)` subscription has the ordinary [Events lifetime](events.md#cleanup) and is not automatically gated by `isRunning()`.

## Ownership and disposal

State returned by `createState` belongs to its owner. Destruction first releases that owner's state subscriptions, then calls the configured `State.disposeOwned(source)` when provided. The native data StateApi calls the source's `destroy()` method if it has one. A borrowed source is never disposed by the borrower; multiple Views can share it and release their subscriptions independently.

Application stop/restart retains state. View rendering retains state. Destruction is the disposal boundary; it does not dispose arbitrary fields attached to the owner. If state has never been requested, destruction does not create it. A later first `getState()` on a destroyed owner creates and immediately disposes its owned state.

## Configure the StateApi

`OwnerClass.setStateApi(api)` shallowly overlays that class's `State` provider and returns the class. It applies to Application, View, CollectionView, Behavior, and MnObject. A class's overlay does not mutate its parent's or sibling's provider. Configure before constructing instances. A global `setStateApi(api)` or an isolated runtime's `setStateApi(api)` configures its state-capable classes together; see [setup](../../integrations/setup.md#configure-once) and [View runtime configuration](view-bindings.md).

The provider members used by an owner are `subscribe(source, name, callback, context)`, which returns an unsubscribe function, and optional `disposeOwned(source)`. The public `State` property is the configured provider, not the state source returned by `getState()`. The [provider reference](../providers/data.md#stateapi) covers authoring; alternative integrations have their own source/disposal policies.

[API index](../../api.md) · [View](../view.md) · [Shared utilities](common.md)
