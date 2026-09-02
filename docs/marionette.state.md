# State sources and StateApi

`Application`, `MnObject`, `View`, `CollectionView`, and `Behavior` can compose
one state source. Marionette owns the relationship and declarative observation;
the source owns its values and mutation API. `Region` does not compose state.

`getState()` always returns the exact source. Core never converts a plain object
into a model, record, Proxy, or observable object.

```javascript
const App = Application.extend({
  createState() {
    return { filter: '', selectedId: null };
  }
});

const app = new App();
app.getState().filter = 'active';
```

Without a supplied source or custom factory, the first `getState()` call lazily
creates an empty plain object. An owner that never supplies, declares, or asks
for state has no state-source property, subscription, or cleanup registration.

## Borrowed and owned sources

There are two explicit composition forms:

- `state` is an already-created, borrowed source. Several owners may borrow the
  same source. Destroying one owner releases only its subscriptions and never
  disposes the source.
- `createState(options)` is a factory called with the owner as `this` and the
  constructor options as its argument. Its result is owned. Owner destruction
  releases subscriptions and then calls the selected StateApi's optional
  `disposeOwned(source)` hook.

A supplied function is a source, not a factory. Use `createState()` when a
function must be invoked to create a source.

State persists across View and CollectionView render. Application state
persists across stop and restart. Behavior state lasts until that Behavior is
destroyed, and MnObject state lasts until the object is destroyed.

## Plain-object state

Plain objects are the dependency-free default and are intentionally
non-observable. Mutate them with ordinary JavaScript and explicitly render or
call an application method when the UI must update.

<!-- executable-example: view-local-state -->
```javascript
import { View } from 'marionette';

export const label = new View({
  el: document.querySelector('#label'),
  model: { name: 'Account' },
  template: model => model.name
}).render();

const Disclosure = View.extend({
  el() { return document.querySelector('#disclosure'); },
  template: () => '<button class="toggle">Toggle</button>',
  events: { 'click .toggle': 'toggle' },
  createState() { return { open: false }; },
  toggle() {
    const state = this.getState();
    state.open = !state.open;
    this.render();
  },
  onRender() { this.el.dataset.open = String(this.getState().open); }
});

export const disclosure = new Disclosure().render();
```

## StateApi

The public adapter contract is deliberately small:

```javascript
StateApi.subscribe(source, eventName, callback, context);
// returns a cleanup function

StateApi.disposeOwned?.(source);
```

`subscribe` receives each `stateEvents` name unchanged and must call the
provided callback with the source's native payload. Every call must return a
cleanup function. Marionette makes that cleanup idempotent, retains it outside
the owner's public event registry, and invokes it exactly once. Therefore
calling `owner.off()` cannot disable state-source cleanup.

`disposeOwned` is called only for a `createState()` result, after subscriptions
are released. It is never called for a supplied or declared `state` source.
Constructor rollback follows the same ordering.

The default StateApi does not pretend a plain object is observable. Declaring
`stateEvents` for a source it cannot observe throws `MN0037`. A missing cleanup
function throws `MN0038`.

Configure StateApi globally before construction:

```javascript
import { setStateApi } from 'marionette';

setStateApi({
  subscribe(source, eventName, callback, context) {
    return source.subscribe(eventName, (...args) => callback.apply(context, args));
  },
  disposeOwned(source) {
    source.dispose();
  }
});
```

`Application.setStateApi()`, `MnObject.setStateApi()`, `View.setStateApi()`,
`CollectionView.setStateApi()`, and `Behavior.setStateApi()` configure a class
or subclass independently. Repeated configuration overlays only that receiving
class; it does not mutate its parent or sibling classes. StateApi selection is
independent of DataApi selection, though one object may implement both.

## stateEvents

`stateEvents` retains Marionette's declarative event-map shape. Handler names
are resolved on the owner, while event vocabulary and callback arguments belong
to the selected adapter.

```javascript
const ActorView = View.extend({
  stateEvents: {
    'actor.transition': 'onTransition'
  },
  onTransition(snapshot) {
    this.el.dataset.phase = snapshot.value;
  }
});
```

Changing from one state provider to another may require changing event names.
Marionette does not add universal `get`, `set`, `reset`, `dispatch`, or `send`
methods to state owners.

## Application lifetime

<!-- executable-example: application-local-state -->
```javascript
import { Application } from 'marionette';

const Session = Application.extend({
  createState() { return { phase: 'stopped' }; },
  onStart() { this.getState().phase = 'ready'; },
  onStop() { this.getState().phase = 'stopped'; }
});

export const session = new Session();
export const sessionState = session.getState();
export const started = await session.start();
export const stopped = await session.stop();
export const restarted = await session.restart();
```

Application readiness remains the only asynchronous lifecycle boundary. Code
that mutates a state source after awaited work must still check the readiness
`AbortSignal` before committing stale results.

## Behavior lifetime

<!-- executable-example: behavior-state-ownership -->
```javascript
import { Behavior, View } from 'marionette';

const Disclosure = Behavior.extend({
  events: { 'click .disclosure': 'toggleDisclosure' },
  createState() { return { open: false }; },
  toggleDisclosure() {
    const state = this.getState();
    state.open = !state.open;
    this.view.render();
  },
  onRender() {
    this.view.el.dataset.disclosureOpen = String(this.getState().open);
  }
});

const Settings = View.extend({
  el() { return document.querySelector('#settings'); },
  behaviors: [Disclosure],
  events: { 'click .selection': 'toggleSelection' },
  template: () => '<button class="disclosure">Disclosure</button><button class="selection">Selection</button>',
  createState() { return { selected: false }; },
  toggleSelection() {
    const state = this.getState();
    state.selected = !state.selected;
    this.render();
  },
  onRender() {
    this.el.dataset.selected = String(this.getState().selected);
  }
});

export const settings = new Settings().render();
```

A Behavior that receives its View's source through `state` borrows it. A
Behavior-private `createState()` result is owned only by that Behavior.

## Migration from the v5 alpha State

The experimental concrete `Marionette.State` export was removed from core. For
non-observable local values, return a plain object from `createState()` and use
property access. For reactive values, supply the provider's real source and a
matching StateApi. Do not alias the removed State to another model type.

```javascript
// Before
const state = owner.getState();
state.set('open', true);

// Plain-object source
const state = owner.getState();
state.open = true;
```
