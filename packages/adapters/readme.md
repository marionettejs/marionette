# @mnjs/adapters

First-party optional integrations for Marionette v5. The package intentionally
has no root export: import only the adapter and optional peer your application
uses. Installing this package does not install every provider. The adapters have
separate module graphs and no import-time installation; unused integrations stay
out of the application bundle. Source is grouped into `data` and `dom`,
while each integration remains an explicit package subpath.

## Adapter conventions

- `SomethingApi` is an object implementing an existing runtime contract.
- `createSomethingApi(options)` returns that object when configuration is required.

Imports do not configure Marionette. Use the existing `setDomApi`, `setDataApi`,
and `setStateApi` methods before constructing instances. An integration may
satisfy more than one contract: Backbone uses the same adapter object for both
data and state. Setters overlay supplied methods; the last supplied version of
a method wins. Configure content rendering after general DOM operations.

Adapters use public APIs and document source ownership and cleanup below.

Template evaluation is a function configured with `View.setRenderer()`. Projects
can supply that function directly; it does not need a packaged adapter. Lit and
Morphdom belong to DomApi because they apply template results to the DOM.

## Backbone

```sh
npm install marionette@5.0.0-beta.1 @mnjs/adapters@5.0.0-beta.1 backbone
```

Configure DataApi before creating Views that consume Backbone models or
collections. The example below covers model-backed Views. For a CollectionView, configure
DataApi on both its parent CollectionView class and its child View class before
construction. For a feature-specific integration, configure its View subclass:

```js
import BackboneApi from '@mnjs/adapters/backbone';
import { View } from 'marionette';

const BackboneView = View.extend();
BackboneView.setDataApi(BackboneApi);
```

Use the top-level `setDataApi(BackboneApi)` when the whole application shares
that data provider. Configure StateApi separately, only for owners whose state
uses Backbone and needs subscriptions or owned-source cleanup:

```js
BackboneView.setStateApi(BackboneApi);
```

The same adapter object can configure other state-owning classes, or the
corresponding setters on an existing isolated runtime. Choosing Backbone data
does not require choosing Backbone state or creating an isolated runtime.

The adapter uses Backbone's native events and does not modify Backbone objects
or prototypes. Releasing an owned Backbone state source removes only the
adapter-managed owner subscriptions. The adapter leaves the source and its
caller-owned listeners intact; it does not call source-wide `stopListening()`,
`off()`, or persistence-capable `Model#destroy()` methods.

## XState actors

Use the XState actor adapter when a parent actor snapshot contains stable child
actor references. Actor-reference identity associates each child actor with its
View; stopping and respawning an actor creates a different model identity even
when the actors share an `id`. The adapter supports XState `^5.32.6`.

```sh
npm install marionette@5.0.0-beta.1 @mnjs/adapters@5.0.0-beta.1 xstate
```

This configuration fragment assumes an application-owned `parentActor` whose
`context.children` contains stable child actor references. Create and start the
actors in the application's XState setup.

```js
import createXStateActorApi from '@mnjs/adapters/xstate';
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

Replace the selected array when membership or order changes. Reusing an unchanged
array lets the adapter skip comparison; a newly allocated array requires a keyed
scan per observer, even if its contents are identical.

Supplied parent, child, and state actors are borrowed. Destroying a Marionette
owner releases its subscriptions and Views but does not stop those actors. An
actor returned by an owner's `createState()` factory is owned; after releasing
its subscriptions, Marionette calls this adapter's `disposeOwned()` and stops
that actor. The keyed snapshot helper is private implementation only;
there is no generic snapshot-source package export.

## jQuery DomApi

```sh
npm install marionette@5.0.0-beta.1 @mnjs/adapters@5.0.0-beta.1 jquery
```

```js
import { View } from 'marionette';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';

const JQueryView = View.extend();
JQueryView.setDomApi(JQueryDomApi);
```

If application code needs `$el`, initialize it once:

```js
import $ from 'jquery';
import { View } from 'marionette';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';

const JQueryView = View.extend({
  initialize() { this.$el = $(this.el); }
});
JQueryView.setDomApi(JQueryDomApi);
```

Views, CollectionViews, and Behaviors keep their initial root. The application
owns `$el`; no wrapper helper or extra package subpath is needed.

Importing an adapter subpath does not load any other adapter or optional peer.

## DOM contents

The Morphdom and Lit DOM adapters update a View's contents synchronously and keep its `el`
in place. Marionette still owns View events, attachment, destruction, and
Regions. A parent render still destroys its Region children before updating the
parent template; incremental rendering does not preserve those child Views.
Keep Region placeholders empty in your templates so the adapter and Region do
not both manage the same contents.

Configure these adapters through `ViewClass.setDomApi(adapter)` before creating
instances. The adapter overlays only its supplied methods, so unrelated DOM
operations remain in place. Configure jQuery first if you need its query and
attachment operations alongside Morphdom or Lit.

### Morphdom

```sh
npm install marionette@5.0.0-beta.1 @mnjs/adapters@5.0.0-beta.1 morphdom
```

```js
import { View } from 'marionette';
import MorphdomDomApi from '@mnjs/adapters/dom/morphdom';

const MessageView = View.extend({
  template: () => '<p id="message">Hello again.</p>'
});
MessageView.setDomApi(MorphdomDomApi);
```

The template returns an HTML string containing the View's contents. Morphdom
matches children using its normal rules, including element IDs. The adapter
installs HTML directly into an empty root and morphs existing contents using
`childrenOnly`, leaving the root's attributes under Marionette's control. Use
`renderAttributes()` to refresh those attributes.

### Lit HTML

```sh
npm install marionette@5.0.0-beta.1 @mnjs/adapters@5.0.0-beta.1 lit-html
```

```js
import { View } from 'marionette';
import { html } from 'lit-html';
import LitDomApi from '@mnjs/adapters/dom/lit-html';

const MessageView = View.extend({
  template: ({ message }) => html`<p>${message}</p>`,
  templateContext: { message: 'Hello again.' }
});
MessageView.setDomApi(LitDomApi);
```

Configure a View subclass before creating its instances. Further subclasses
inherit the adapter. Neither DOM adapter modifies View methods or needs
a View reference: template evaluation stays in the renderer and the returned
value goes to `Dom.setContents(el, value)`.

Lit async directives can own subscriptions and other resources. Marionette calls
`Dom.notifyAttach(el)` and `Dom.notifyDetach(el)` through its existing attachment
monitoring. Lit translates these notifications to its directive connection API.
Detaching and destroying a View disconnects its directives while preserving
the View root. A View keeps its initial element for its lifetime.
Destroying an already constructed View also disconnects resources created before
an explicit render failed. Failed construction does not roll back initialization.

Keep `monitorViewEvents` enabled on the View and its ancestors and manage
attachment through Regions. If you disable monitoring or remove its handlers
with `off()`, the application must call the adapter's attachment methods itself.
There is no separate hidden cleanup listener. Lifecycle overrides must call
parent methods, as with other Marionette lifecycle overrides.

The first explicit render replaces preexisting contents; this is not hydration.
Subsequent renders update Lit's marked range. A disconnected element can be
adopted by another View using the same adapter without erasing its contents.
Release the previous owner first; one element cannot have two active View owners.
Lit event handlers use Lit's normal element receiver; use closures when a
handler needs application or View state. Do not independently replace Lit's
contents or switch content adapters after rendering.
