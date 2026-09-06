# @marionette/adapters

First-party optional integrations for Marionette v5. The package intentionally
has no root export: import only the adapter and optional peer your application
uses. Installing this package does not install every provider. The adapters have
separate module graphs and no import-time installation; unused integrations stay
out of the application bundle. Source is grouped by data, DOM, and rendering,
while each integration remains an explicit package subpath.

## Backbone

```sh
npm install marionette @marionette/adapters backbone
```

```js
import BackboneApi from '@marionette/adapters/backbone';
import Backbone from 'backbone';
import { setDataApi, setStateApi } from 'marionette';

setDataApi(BackboneApi);
setStateApi(BackboneApi);
```

Configure the Backbone adapter before creating Marionette Views that consume
Backbone models or collections. Pass the same `BackboneApi` object to an
isolated runtime's `setDataApi()` and `setStateApi()` methods when that runtime
owns the integration. The adapter uses Backbone's native events and does not
modify Backbone objects or prototypes. Releasing an owned Backbone state source
removes only the adapter-managed owner subscriptions. The adapter leaves the
source and its caller-owned listeners intact; it does not call source-wide
`stopListening()`, `off()`, or persistence-capable `Model#destroy()` methods.

## Keyed snapshot stores

Marionette provides explicit adapters for Redux, Zustand vanilla stores, and
XState Store. Each adapter turns an ordered array selected from the store into
the `DataApi` collection protocol used by `CollectionView`.

| Store | Adapter | Supported version |
| --- | --- | --- |
| Redux Toolkit | `@marionette/adapters/redux` | `^2.12.0` |
| Zustand | `@marionette/adapters/zustand` | `^5.0.15` |
| XState Store | `@marionette/adapters/xstate-store` | `^4.2.3` |

```sh
npm install marionette @marionette/adapters @reduxjs/toolkit
# or
npm install marionette @marionette/adapters zustand
# or
npm install marionette @marionette/adapters @xstate/store
```

```js
import { configureStore } from '@reduxjs/toolkit';
import createReduxDataApi from '@marionette/adapters/redux';
import { CollectionView, View } from 'marionette';

const store = configureStore({
  reducer: (state = { todos: [{ id: 1, title: 'Learn Marionette' }] }) => state
});
const ReduxDataApi = createReduxDataApi({
  key: model => model.id,
  select: state => state.todos
});

const TodoView = View.extend({
  tagName: 'li',
  template: todo => todo.title
});
const TodoList = CollectionView.extend({ childView: TodoView });
TodoList.setDataApi(ReduxDataApi);

const view = new TodoList({ collection: store });
```

Use `createZustandDataApi` from `@marionette/adapters/zustand` and
`createXStateStoreDataApi` from `@marionette/adapters/xstate-store` with the
same `key` and `select` options.

The selector must return the ordered array of models rendered by the view. Keep
the same array reference for store notifications that do not affect that
selection, keep unchanged model references stable, and return a new array for
structural changes. The adapter makes one keyed pass over each relevant
snapshot. A new object with an existing key is an immutable replacement: the
old child View is destroyed and a new one is rendered for the replacement.

These adapters observe and reconcile snapshots only. They do not mutate the
store, stop it, or provide a generic snapshot-store abstraction. A consumer
error propagates through the store notification; the next source notification
emits a reset so Marionette can rebuild from the latest valid snapshot.

## XState actors

Use the XState actor adapter when a parent actor snapshot contains stable child
actor references. Actor-reference identity associates each child actor with its
View; stopping and respawning an actor creates a different model identity even
when the actors share an `id`. The adapter supports XState `^5.32.6`.

```sh
npm install marionette @marionette/adapters xstate
```

```js
import createXStateActorApi from '@marionette/adapters/xstate';
import { CollectionView, View } from 'marionette';

const XStateActorApi = createXStateActorApi({
  select: snapshot => snapshot.context.children,
  snapshotEvent: 'actor:snapshot'
});

const ActorView = View.extend({
  template: context => context.label,
  modelEvents: {
    'actor:snapshot': 'render',
    announced: 'onAnnounced'
  },
  onAnnounced(event) {
    console.log(event.label);
  }
});
const ActorList = CollectionView.extend({ childView: ActorView });
ActorView.setDataApi(XStateActorApi);
ActorList.setDataApi(XStateActorApi);

const view = new ActorList({ collection: parentActor }).render();
```

For a CollectionView, the required selector receives the parent actor's
synchronous snapshot and returns its ordered child actor references. Omit
`select` when configuring only actor models or state. Templates receive each child actor's current
`snapshot.context`. Configure `snapshotEvent` only when declarative
`modelEvents` or `stateEvents` should observe actor snapshots; the chosen name
is reserved by that adapter instance. Every other event-map name is passed to
`actor.on()` and therefore observes an explicitly emitted actor event, not an
event sent to the actor. Subscribing to an already-started actor does not replay
its current snapshot, so initial rendering reads `getSnapshot()` directly.

Supplied parent, child, and state actors are borrowed. Destroying a Marionette
owner releases its subscriptions and Views but does not stop those actors. An
actor returned by an owner's `createState()` factory is owned; after releasing
its subscriptions, Marionette calls this adapter's `disposeOwned()` and stops
that actor. The private keyed snapshot helper is shared implementation only;
there is no generic snapshot-source package export.

## jQuery DomApi

```sh
npm install marionette @marionette/adapters jquery
```

```js
import { View } from 'marionette';
import JQueryDomApi from '@marionette/adapters/dom/jquery';

const JQueryView = View.extend();
JQueryView.setDomApi(JQueryDomApi);
```

Importing an adapter subpath does not load any other adapter or optional peer.

## Rendering

The render adapters update a View's contents synchronously and keep its `el`
in place. Marionette still owns View events, attachment, destruction, and
Regions. A parent render still destroys its Region children before updating the
parent template; incremental rendering does not preserve those child Views.
Keep Region placeholders empty in your templates so the renderer and Region do
not both manage the same contents. For a CollectionView template, use a dedicated
`childViewContainer` so child operations do not clear the template's own DOM.

Each integration has one installer that configures the pieces it needs. Both
use `setDomApi` to replace `setContents`, retaining other DOM operations such
as jQuery queries and wrapping. Lit also supplies `disposeContents` for resource
cleanup. Neither installer replaces View methods or changes template evaluation.

### Morphdom

```sh
npm install marionette @marionette/adapters morphdom
```

```js
import { View } from 'marionette';
import setMorphdomRenderer from '@marionette/adapters/render/morphdom';

const MessageView = View.extend({
  template: () => '<p id="message">Hello again.</p>'
});
setMorphdomRenderer(MessageView);
```

The template returns an HTML string containing the View's contents. Morphdom
matches children using its normal rules, including element IDs. The adapter
installs HTML directly into an empty root and morphs existing contents using
`childrenOnly`, leaving the root's attributes under Marionette's control. Use
`renderAttributes()` to refresh those attributes.

### Lit HTML

```sh
npm install marionette @marionette/adapters lit-html
```

```js
import { View } from 'marionette';
import { html } from 'lit-html';
import setLitHtmlRenderer from '@marionette/adapters/render/lit-html';

const MessageView = View.extend({
  template: ({ message }) => html`<p>${message}</p>`,
  templateContext: { message: 'Hello again.' }
});
setLitHtmlRenderer(MessageView);
```

Install on a View subclass before creating its instances. The installer returns
the same class; repeated installation does not wrap methods or add listeners.
Further subclasses inherit it. An override of `setElement()` or
`destroy()` must call the parent method, as with other View lifecycle overrides.

Lit needs this installer because its async directives can own subscriptions and
other resources. The adapter connects and disconnects those directives with
Marionette's `attach` and `detach` events. Marionette calls its
`DomApi.disposeContents` operation to release resources and remove rendered
contents when the View changes roots or is destroyed. Keeping the same element preserves its
contents; a cancelled destruction leaves them active. Removing event listeners
with `off()` does not disable terminal cleanup, but removing all lifecycle
listeners also removes attachment notifications. Manage attachment through
Marionette Regions so the framework can report it. Keep `monitorViewEvents`
enabled on the View and its ancestors; disabling those notifications also
disables directive connection tracking. A failed constructor releases directives
created during initialization through Marionette's construction rollback.

The first explicit render replaces any preexisting contents; this is not a
hydration adapter. Lit then updates its own marked range inside `view.el`, with
the View as the event-handler host. Call `view.render()` before showing a View
whose existing element already has contents if you want to replace those
contents immediately. Do not independently replace a Lit View's contents or
switch its renderer after rendering: Lit owns the nodes and markers until the
adapter releases them.
