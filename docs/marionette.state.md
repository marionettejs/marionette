# Marionette.State

`State` is a small synchronous object for local mutable state. It provides
attributes, change events, lifecycle-safe cleanup, and Marionette's class
extension conventions without requiring Backbone.

Use `State` for local UI or orchestration state. Shared domain data still
belongs in a model, collection, or another application data source. State does
not render, persist data, compute derived values, schedule work, or await
callbacks.

```javascript
import { State } from 'marionette';

const state = new State({ selected: false });

state.on('change:selected', (currentState, selected, change) => {
  console.log(selected, change.previous.selected);
});

state.set('selected', true);
```

## Defining State

`State` supports both native class inheritance and Marionette's `extend`
convention. Define `defaults` as an object or function. With native class
inheritance, define defaults as a prototype method or getter rather than an
instance field; JavaScript initializes instance fields only after `super()`
returns. Constructor attributes override defaults before `initialize` runs.

```javascript
const SelectionState = State.extend({
  defaults: {
    selected: false
  },

  select() {
    this.set('selected', true);
  }
});
```

## Owned State

`Application`, `MnObject`, `View`, `CollectionView`, and `Behavior` can own one
local State. Call `getState()` to create an empty State on first use. An owner
that never declares, supplies, or requests State has no State instance, State
property, subscription, or cleanup registration.

Declare initial attributes with the `state` property or constructor option.
Either may be a function; Marionette calls it once with the owner as `this`.
State is available before the owner's `initialize` method runs.

```javascript
import { View } from 'marionette';

const ToggleView = View.extend({
  state: {
    open: false
  },

  initialize() {
    this.getState().set('open', true);
  }
});
```

Owners expose only `getState()`. Read and change local values through the
returned State; owners do not duplicate `get`, `set`, `has`, `reset`, or
toggle methods. State remains distinct from the owner's `model`, `collection`,
`modelEvents`, and `collectionEvents`.

Use `stateEvents` to bind State events to owner methods. The map follows the
same handler-name and function rules as other Marionette entity event maps.
Supplying `stateEvents` activates an empty State when no attributes were
declared. Marionette resolves and binds the map after `initialize`, matching
other declarative entity event maps; State changes made during `initialize`
do not dispatch through `stateEvents`.

```javascript
const ToggleView = View.extend({
  stateEvents: {
    'change:open': 'onOpenChange'
  },

  onOpenChange(state, open) {
    this.el.hidden = !open;
  }
});
```

State on a View or CollectionView persists across render. Behavior State
persists across its owning View's render. Application State persists across
stop and restart. Owner destruction destroys State and releases `stateEvents`;
late `getState()` calls return a destroyed State whose writes are
lifecycle-safe no-ops.

### Supplying a State instance

Pass an existing live, unowned State when a custom State subclass or prepared
instance is required. Composition transfers ownership. The owner destroys the
State and releases ownership at teardown.

```javascript
const state = new SelectionState({ selected: true });
const view = new View({ state });

view.getState() === state; // true
```

One State cannot be composed into two owners. A destroyed or already-owned
State throws [`MN0035`](/errors/MN0035/) before the second composition. Shared
domain or cross-owner data belongs in a model, collection, or another explicit
data source rather than an owned State. A Behavior may hold an ordinary
reference to its View's State, but must not compose or destroy that reference.

## State keys

Use keys without whitespace. Marionette Events uses whitespace to separate
event names, so construction, `set`, `unset`, and `reset` reject whitespace in
a key with [`MN0034`](/errors/MN0034/) before changing state. Writes after
`destroy()` remain lifecycle-safe no-ops, including writes with invalid keys.

## Reading State

`get(key)` returns one value. `has(key)` reports whether the key is present,
including a present key whose value is `undefined`. `toJSON()` returns a
shallow snapshot; changing the returned object does not mutate State.

State does not expose its internal attribute object. Use `set`, `unset`, or
`reset` so changes remain observable.

## Changing State

`set(key, value, options)` changes one key. `set(attributes, options)` commits
multiple keys atomically before notifying observers. A write that does not
change any own value emits nothing. Values use `Object.is` identity semantics.

For each changed key, State emits `change:key` with
`(state, value, change)`. It then emits one aggregate `change` with
`(state, change)`. Key events follow the insertion order of the attributes
object. The `change` object shallow-copies caller options and adds `changed`
and `previous` maps. Those two canonical maps override options with the same
names.

```javascript
state.set({ selected: true, focused: false }, { source: 'keyboard' });
```

All State work is synchronous. A nested `set` inside a key handler completes
before the outer dispatch continues. Each `set` call emits its own aggregate
event. Passing `{ silent: true }` applies the write without events.

`unset(key, options)` removes one key through the same event contract.
`reset(attributes, options)` replaces current state with defaults plus the
provided attributes, removing other keys.

## Destroying State

`destroy()` removes direct and listening subscriptions and is idempotent.
`isDestroyed()` then returns `true`. Reads continue to return the last values;
`set`, `unset`, and `reset` become lifecycle-safe no-ops and emit nothing.

State is deliberately synchronous. Event handler return values are ignored,
including Promises.
