# @mnjs/adapters

Optional integrations for existing data sources and DOM libraries. Import the subpath you use; the package has no root export. Imports do not configure Marionette or load other adapters. Install the matching Marionette candidate and only the peers needed by your integration; see [candidate installation](../quick-start.md#install-the-release-candidate).

| Subpath | Default export | Peer used by the application |
| --- | --- | --- |
| `@mnjs/adapters/backbone` | `BackboneApi` | Backbone `^1.3.1`; TypeScript also needs `@types/backbone` `^1.4.23`. |
| `@mnjs/adapters/xstate` | `createXStateActorApi` | XState v5 actors; the integration is tested with `5.33.2`. It uses structural actor interfaces and does not import XState. |
| `@mnjs/adapters/dom/jquery` | `JQueryDomApi` | jQuery `^4.0.0`; TypeScript also needs `@types/jquery` `^4.0.1`. |
| `@mnjs/adapters/dom/morphdom` | `MorphdomDomApi` | Morphdom `^2.7.8`. |
| `@mnjs/adapters/dom/lit-html` | `LitDomApi` | Lit HTML `^3.3.3`. |

Each subpath has ESM, CommonJS, and TypeScript entrypoints. These adapters implement the existing [data/state](../api/providers/data.md) or [DOM](../api/providers/dom.md) contracts. Configure them before constructing consumers. [Runtime configuration](../api/runtime.md) explains application-wide, subclass, and isolated scopes. The examples use subclasses to make the affected classes explicit.

Data and state configuration are independent. Choosing a data adapter does not require changing state, Radio, or DOM providers. See [observable data and API access](../integrations/setup.md#observable-data-and-api-access) when selecting a data solution.

## Backbone

`BackboneApi` implements both DataApi and StateApi without modifying Backbone sources or prototypes. Configure a CollectionView and its child View class when both consume Backbone data. Configure StateApi separately for owners whose state uses Backbone.

Backbone 1.3.1 is the runtime minimum: collection observation reads the added and removed model arrays from the `update` event's `options.changes` payload. Backbone 1.2.3 emits `update` without that payload and cannot supply this contract. The Backbone data adapter does not require jQuery; the jQuery DOM adapter has its own peer requirement.

```js
import Backbone from 'backbone';
import BackboneApi from '@mnjs/adapters/backbone';
import { View } from 'marionette';

const LabelView = View.extend({
  template: ({ label }) => label,
  modelEvents: { 'change:label': 'render' }
});
LabelView.setDataApi(BackboneApi);
const model = new Backbone.Model({ label: 'Inbox' });
const view = new LabelView({ model }).render();
model.set('label', 'Archive');
```

| Method | Contract |
| --- | --- |
| `key(model)` | Returns `model.cid`, preserving each model's identity independently of its server ID. |
| `get(model, name)` / `has(model, name)` | Read/check own attributes. `get` returns `undefined` when absent; `has` includes attributes whose value is `undefined`. |
| `serialize(model)` | Returns the current `model.attributes` object, without copying it. |
| `models(collection)` | Returns a shallow copy of the ordered `collection.models` array. |
| `subscribe(source, nameOrMap, callback?, context?)` | Uses native Backbone events and preserves their names, payload arguments, and callback context. Returns an idempotent function that removes only these registrations. |
| `observeCollection(collection, notify, context?)` | Translates native collection events into the structural changes below. Returns an idempotent disposer. |
| `disposeOwned(source)` | Does nothing to the source itself. Owner subscriptions have already been released by StateApi cleanup. |

For event maps, use Backbone's map form with the context as the following argument. Standalone subscriptions do not add framework ownership; call the returned disposer when finished.

A standalone `sort` reports `reorder`, retaining surviving child Views and DOM. `update` reports added/removed models; removals destroy those children. Merges retain the model and do not request a child rerender through collection observation—use the child's model events. `reset` reports `reset` and rebuilds children. The adapter treats sort events with truthy `add`, `remove`, or `merge` options as mutation-related and suppresses them. It relies on the `update` emitted by ordinary non-silent additions, removals and merges; reorder-only `set()` and explicit `sort()` do not provide that update.

**Reorder-only limitation:** `collection.set([second, first])` can reorder existing Model instances without adding, removing, or merging any models. Backbone then emits `sort` with its default mutation options but no `update`, so the adapter leaves the CollectionView in its previous order. This replacement occurs with `add` and `remove` enabled when comparator sorting is inactive: no comparator, `sort: false`, or a supplied `at` option. In particular, `at` does not prevent full order replacement under those conditions; it is not a reliable way to move an existing model to a position. Attribute objects normally count as merges and produce an `update`; with `merge: false`, they can also take the reorder-only path.

After a known reorder-only operation, use `collection.trigger('sort', collection, {})` to notify observing CollectionViews of the already-established order. For example, follow `collection.set([second, first])` with that notification when replacing the order of an unsorted collection. The notification does not sort or mutate the collection itself; with default CollectionView ordering (`sortWithCollection: true`), consumers reconcile the current order while retaining surviving child Views. Pass the explicit empty options object; do not reuse the `set()` mutation options. Do not add this notification after every `set()`, since ordinary additions, removals and merges already reconcile through `update`.

For an explicit comparator sort, call `collection.sort()` without forwarding truthy `add`, `remove`, or `merge` flags. Passing those flags suppresses that standalone sort notification too.

Multiple consumers can share a source. Destroying one consumer removes its subscriptions and children while survivors continue receiving updates. Even factory-owned Backbone state is not destroyed by this adapter: source-wide `off()`, `stopListening()`, and persistence-capable `Model.destroy()` are not called.

## XState actors

`createXStateActorApi(options?)` returns a DataApi/StateApi for actors with synchronous snapshots containing an object `context`.

| Option | Contract |
| --- | --- |
| `snapshotEvent` | Optional nonempty event name mapped to `actor.subscribe`. This name is reserved within that adapter. Other event names use `actor.on` and observe emitted events, not events sent to the actor. |
| `select(snapshot)` | Required for collection use; returns ordered, distinct, non-null child actor references from a parent snapshot. Omit for model/state-only use. |

```js
import { assign, createActor, createMachine } from 'xstate';
import createXStateActorApi from '@mnjs/adapters/xstate';
import { View } from 'marionette';

const actor = createActor(createMachine({
  context: { label: 'Inbox' },
  on: { rename: { actions: assign({ label: ({ event }) => event.label }) } }
})).start();
const ActorApi = createXStateActorApi({ snapshotEvent: 'actor:snapshot' });
const ActorView = View.extend({
  template: ({ label }) => label,
  modelEvents: { 'actor:snapshot': 'render' }
});
ActorView.setDataApi(ActorApi);
const view = new ActorView({ model: actor }).render();
actor.send({ type: 'rename', label: 'Archive' });
```

`key(actor)` returns the actor reference. `get` and `has` read own context properties; `serialize` returns the current context object without copying. An already-started actor does not replay its current snapshot when subscribed; initial rendering reads `getSnapshot()` directly. Missing synchronous snapshots or non-object contexts raise `TypeError`.

`subscribe(actor, eventName, callback, context?)` delivers the native snapshot or emitted-event payload, with the supplied callback context, and returns an idempotent unsubscribe function. Configure the reserved snapshot name when `modelEvents` or `stateEvents` should observe state changes.

With `select`, the returned adapter also supplies `models(parentActor)` and `observeCollection(parentActor, notify, context?)`. Replace the selected array when membership or order changes. Reusing its identity skips comparison; a fresh array requires a scan, but identical members/order produce no notification. Reorder retains child Views and DOM; removal destroys the removed child. Child context changes belong to child subscriptions. Respawning an actor with the same `id` creates a new model identity.

Observers are independent. Releasing one removes only its subscription. Supplied data and state actors are borrowed and remain active after consumer destruction. An actor returned by `createState()` is owned: subscriptions are released first, then `disposeOwned(actor)` calls `actor.stop()`. The application must stop borrowed actors when their own lifetime ends.

## DOM contents

Lit and Morphdom update contents synchronously and preserve the View's root element. They do not change template evaluation; [Renderer](../api/providers/dom.md#renderer) produces the value that `setContents` receives. Root attributes remain under View control; use `renderAttributes()` to refresh them.

Parent rendering still destroys its Region children before updating contents. Keep Region placeholders empty in templates so only the Region manages their children. Configure a content adapter before the first render, and do not switch content adapters or independently replace their managed contents afterward.

```js
import { View } from 'marionette';
import { html } from 'lit-html';
import LitDomApi from '@mnjs/adapters/dom/lit-html';
import MorphdomDomApi from '@mnjs/adapters/dom/morphdom';

const LitMessage = View.extend({
  template: ({ message }) => html`<p>${message}</p>`,
  templateContext() { return { message: this.message }; }
});
LitMessage.setDomApi(LitDomApi);
const MorphMessage = View.extend({
  template: () => '<p id="message">Hello</p>'
});
MorphMessage.setDomApi(MorphdomDomApi);
const lit = new LitMessage();
lit.message = 'Hello';
lit.render();
const morph = new MorphMessage().render();
```

### Morphdom

`MorphdomDomApi` supplies `setContents(el, html)` for an HTML string, `null`, or `undefined`; nullish values clear the contents. An empty root receives the HTML directly. Existing contents are reconciled with Morphdom's `childrenOnly` behavior and normal matching rules, including element IDs. Matching elements can survive repeated renders; the root always remains. Use trusted HTML or an application template system that handles untrusted values safely.

### Lit HTML

`LitDomApi` supplies `setContents(el, value)`, `notifyAttach(el)`, and `notifyDetach(el)`. Templates can return Lit values such as `html` results. The first explicit render replaces existing contents; it does not hydrate them. Subsequent renders update the same marked range.

The notification methods connect/disconnect Lit directives through the stored root part. Marionette's attachment monitoring calls them when managed through Regions; keep `monitorViewEvents` enabled on the View and its ancestors. If monitoring is disabled or its handlers are removed, the application must deliver these notifications itself. Overrides of lifecycle methods must preserve parent behavior.

Detach and destruction disconnect directive resources. Destruction can also release resources from a failed explicit render; failed construction does not roll back initialization. Release the previous View owner before adopting its element in another View. Lit event handlers use Lit's element receiver; use a closure when a handler needs View or application state.

## jQuery

`JQueryDomApi` overlays these DOM operations; it does not create `$el` or change View ownership. `getUI(name)` returns a jQuery collection under this adapter. If the application needs `$el`, initialize it with `$(this.el)`; the root is fixed for the View's lifetime.

| Method | Contract |
| --- | --- |
| `findEl(el, selector)` | Returns a jQuery collection of descendants. Supports `Element` or `Document` roots. |
| `detachEl(el)` | Detaches the element while retaining jQuery data and listeners. |
| `setContents(el, html)` | Uses jQuery `.html()`; a nullish value clears contents. |
| `appendContents(el, contents)` | Appends accepted jQuery HTML/node/collection content to an Element or DocumentFragment. |
| `detachContents(el)` | Detaches children while retaining their jQuery data and listeners; keeps the root. |

```js
import { View } from 'marionette';
import $ from 'jquery';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';

const Controls = View.extend({
  template: () => '<button>Open</button>',
  ui: { open: 'button' }
});
Controls.setDomApi(JQueryDomApi);
const view = new Controls().render();
const button = view.getUI('open');
button.attr('aria-label', 'Open details');
```

To combine jQuery query/attachment operations with Lit or Morphdom contents, call `setDomApi` with jQuery first and the content adapter second. Setters overlay supplied methods; the last supplied implementation wins. Other DOM operations retain their configured defaults.

## TypeScript

The default exports carry their provider method types. XState additionally exports `XStateActorEventOptions` and `XStateActorApiOptions<ParentSnapshot, Actor>`; adding a typed selector exposes the collection methods in the factory result. Actor/source lifetimes still require runtime ownership decisions.

```ts
import BackboneApi from '@mnjs/adapters/backbone';
import createXStateActorApi, { type XStateActorEventOptions } from '@mnjs/adapters/xstate';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';
import { View } from 'marionette';

const LabelView = View.extend();
LabelView.setDataApi(BackboneApi);
const options: XStateActorEventOptions = { snapshotEvent: 'actor:snapshot' };
const actorApi = createXStateActorApi(options);
const root = document.createElement('div');
root.innerHTML = '<button>Open</button>';
const buttons: JQuery<HTMLButtonElement> = JQueryDomApi.findEl<HTMLButtonElement>(root, 'button');
void actorApi;
```
