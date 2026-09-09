## From backbone.marionette.js

See the [v4-to-v5 compatibility ledger](docs/migration-from-v4.md) for the
current public behavior boundary. Final migration documentation is tracked in
[issue #147](https://github.com/marionettejs/marionette/issues/147).

## Migrate one application at a time

1. Save the working lockfile and a tested application revision. Replace
   `backbone.marionette` with `marionette` and install matching versions of the
   `@mnjs/*` packages you use. Use the selected runtime’s Radio: import `Radio`
   from `marionette` for the default runtime, or use `runtime.Radio` with
   `createMarionette()`. Upgrade these packages together; a source checkout can contain changes absent from beta.1.
2. Choose the [data, state and DOM integrations](docs/choosing-integrations.md).
   Configure them before constructing consumers, using an isolated runtime if
   multiple configurations share a page. Backbone and jQuery are explicit choices.
3. Migrate managed children to Marionette View instances and fixed constructor
   roots. Replace `setElement`, implicit View construction and removed child
   helper aliases using the [compatibility ledger](docs/migration-from-v4.md).
   Keep the existing application's routing and domain model unless it needs a change.
4. Await Application `start`, `stop`, `restart` and `destroy` results at the
   application boundary. Make asynchronous readiness respect cancellation before
   committing side effects. Distinguish borrowed state/Regions from owned factories.
5. Use the shipped public declarations and run the application's type/build
   checks. Test startup, navigation cancellation, child replacement, editable
   focus/drafts, repeated mounts and teardown through public behavior in a browser.
6. Deploy the tested application revision and its lockfile together. If its
   behavior fails, restore that pair and diagnose the public reproduction before
   retrying. Do not retain parallel old/new framework initialization paths.

The sections below explain the specific API changes. The library's fixtures
validate supported integration patterns; they do not establish that an untested
consumer application has migrated successfully.

## Use the included TypeScript declarations

The `marionette` package includes declarations for its public exports in ESM and
CommonJS. Core declarations support TypeScript 6 and 7 with NodeNext or bundler
resolution. Import instance and configuration types from `marionette`; a separate
core type package is not needed. Optional packages keep their own declarations
and compiler support.

Both `.extend()` and direct native subclasses remain available. A native class's
inherited `.extend()` needs an explicit constructor: default forwarding uses
`parent.apply`, which cannot call a native class. Some native overrides after
`.extend()` configuration, especially prototype `options` factories, encounter
TypeScript's distinction between methods and properties. Define those overrides
with `.extend()`, or start the native subclass from the public base.

Custom constructors can replace the instance. Their declared object return is
the constructed type; an unknown return stays unknown. See the
[constructor typing guidance](https://github.com/marionettejs/marionette/blob/master/docs/maintainers/types.md) for preserving
the receiver through further extensions and the limits of return annotations.

## Managed children use Marionette's lifecycle

Regions, CollectionView children, and empty Views use Marionette View or
CollectionView instances. Automatic Backbone View lifecycle adaptation is removed,
including `supportsRenderLifecycle`, `supportsDestroyLifecycle`, and the fallback
from `destroy()` to `remove()`.

Wrap an existing non-Marionette view in a Marionette View and own its rendering
and cleanup explicitly. See the [wrapper example](https://github.com/marionettejs/marionette/blob/master/docs/marionette.region.md#wrapping-a-non-marionette-view).
Behaviors also keep their initial host element; their internal `_syncElement()`
retargeting method is removed. Event redelegation still refreshes their handlers.

## Construct Views before showing them

`Region#show` and `View#showChildView` require a Marionette View instance in v5. They no
longer construct a hidden base View from a template function, string, or View-options
object. Make the allocation and ownership explicit:

```js
import { View } from 'marionette';

// v4
parent.showChildView('heading', 'Edit program');
parent.showChildView('content', {
  template,
  templateContext: { section: 'main' }
});

// v5
parent.showChildView('heading', new View({
  template: () => 'Edit program'
}));
parent.showChildView('content', new View({
  template,
  templateContext: { section: 'main' }
}));
```

## Configure model and collection data

- Marionette core no longer reads Backbone-specific `cid`, `attributes`, `get`,
  `models`, `indexOf`, or structural event payloads.
- Plain object models and array collections work through the default DataApi.
- `DataApi.models(collection)` replaces the pre-stable
  `DataApi.items(collection)` name without a compatibility alias.

  ```js
  // before
  const models = DataApi.items(collection);

  // v5
  const models = DataApi.models(collection);
  ```
- View templates with a collection and no model now receive the result of
  `serializeCollection()` on the `models` property. By default, that result is an
  array of serialized values. Replace the pre-stable `items` property without
  retaining both names.

  ```js
  // before
  template: ({ items }) => items.map(renderModel)

  // v5
  template: ({ models }) => models.map(renderModel)
  ```
- Applications whose Views use Backbone models or collections must select its
  DataApi before constructing those Views:

  ```sh
  npm install @mnjs/adapters backbone
  ```

  ```js
  import BackboneApi from '@mnjs/adapters/backbone';
  import { setDataApi } from 'marionette';

  setDataApi(BackboneApi);
  ```

  Configure `setStateApi(BackboneApi)` separately only when declarative
  `stateEvents` observe a Backbone state source. Using Backbone.Router alone
  requires neither adapter. See [Choosing integrations](docs/choosing-integrations.md).

- Other data sources can configure `setDataApi` with methods for identity,
  reads, serialization, ordered model snapshots, subscriptions, and collection
  observation. XState actors can use `@mnjs/adapters/xstate`.
  See [Data API](docs/data.api.md).
- State owners return the exact supplied source from `getState()`. Use
  `createState(options)` for an owned source, and configure `setStateApi` when
  declarative `stateEvents` need observation. The v5 alpha concrete `State`
  export is removed. See [State sources and StateApi](docs/marionette.state.md).
- `Application#getParentApp()` and `Application#getRootApp()` are removed. Pass
  required collaborators to child Applications explicitly when constructing
  them instead of traversing upward.
- Replace `children.findByModelCid(cid)` with `children.findByModel(model)`.

## Native data package

- Use `Model.toObject()` and `Collection.toArray()` for plain attribute data.
  `toJSON()` is removed from the native package; serialize those plain values
  explicitly with `JSON.stringify`. Template data comes from attributes and is
  independent of conversion overrides.
- `Collection.touch()`, `swap()`, and `replace()` are removed. Update an existing
  model with `model.set()` and bind child rendering with `modelEvents`. Use
  `remove`/`add` or `reset` when replacing membership intentionally.
- `Collection.move(modelOrId, index)` retains existing models and child Views for
  explicit list ordering. Listen to `sort`, which both `move` and `sort` emit;
  the native `reorder` event is removed.
- Native DataApi keys are model `cid` values, so application ids can change
  without changing child identity. Keep application ids unique for unambiguous
  collection lookup.
- Collection notifications now follow ordinary synchronous events. They do not
  combine nested mutations or recover missed notifications after a listener
  throws. Schedule structural mutations requested by collection or child
  lifecycle listeners after the current notification has returned.

## CollectionView child rendering

Collection changes, `sort()`, and `filter()` share the child-rendering path.
Existing visible children stay mounted, including with a custom comparator or
filter. `attachHtml` receives only elements that need attaching; it is no longer
called just to reorder mounted children. Reordering uses `Dom.moveEl`.
`Dom.swapEl` is removed; `swapChildViews()` exchanges the children using at most
two `Dom.moveEl` calls. Custom DomApi implementations only need `moveEl` for
these placement operations. The child-render pass restores focus and text
selection if a DOM move loses them; a direct swap only preserves them when the
browser supports state-preserving moves.

Only a numeric `addChildView` index bypasses sorting and filtering. Passing
`null` or options without an index now follows the same comparator/filter path
as omitting the index.

`before:render:children` and `render:children` receive all visible children,
regardless of which templates needed rendering. Do not treat that argument as
an added-children or updated-children list.

Overrides of `sort()` and `filter()` own their behavior. Call the parent method
when you want its sorting, filtering, and rendering steps. The early v5 fallback
that forced a render after an override has been removed.

## CollectionView source order and presentation sorting

- A normalized DataApi `reorder` or `update` keeps keyed children aligned with
  the collection source order while `sortWithCollection` is enabled.
- `viewComparator: false` disables the separate presentation comparator; it no
  longer freezes the current child order against structural source changes.
- Set `sortWithCollection: false` when a CollectionView must preserve manually
  managed child order instead of following the source.
- An immutable update that replaces a model with a different object at the same
  stable key recreates that child View. Do not retain references to the old
  child across such an update.

## Underscore is no longer a peer dependency

- Marionette v5 core does not import or declare Underscore as a peer dependency.
- Remove an explicit Underscore installation if it existed only for Marionette.
  Keep it as an application dependency when your own code uses it, such as an
  `_.template` supplied to a View.
- Applications using Backbone still receive Underscore through Backbone's own
  declared dependency; the Marionette integration does not import it.

## View roots are fixed at construction

`View#setElement()` and `CollectionView#setElement()` are removed. Choose the
root through `new View({ el })` or `new CollectionView({ el })`; both also accept
an `el` factory. Without an `el`, Marionette creates one from `tagName`.
The public instance `el` is readonly. Direct reassignment is unsupported.

Render into the existing root and use Regions to move or detach the View.
When another system replaces the root, destroy the old View and create a new
owner for the replacement element. Keep persistent state in the model or an
externally owned state source. Custom `setElement()` overrides are no longer
called during construction; move initialization to `initialize()` or an `el`
factory, as appropriate.

## View `el` is element-only

- `View` (and `CollectionView`) accept a DOM element for `el` in v5. Selector
  strings are no longer resolved, and jQuery collections must be unwrapped.
- v4 inherited string-`el` resolution from `Backbone.View._ensureElement`, which
  used jQuery to look up the selector. v5 drops `Backbone.View` inheritance and
  the default jQuery dependency, so the string-resolution path goes with them.
- v5 now throws a `ViewError` with a migration hint on construction when a string is passed, instead of silently storing the raw
  string as `view.el` and failing later in DOM code.
- Migration: resolve at the call site.

  ```js
  // v4
  new View({ el: '#root' });

  // v5
  new View({ el: document.querySelector('#root') });
  ```

- `Region` continues to accept selector strings. That API is Marionette-native
  (the Region abstraction has always been "where to mount"), not inherited from
  Backbone, so it is preserved. When the mount point is already resolved, pass
  its native element rather than a jQuery collection.

## Refresh View root attributes explicitly

Use `renderAttributes()` when `attributes`, `id`, or `className` changed but the
View's template content and owned children should remain in place:

```js
const RowView = View.extend({
  attributes() {
    return {
      'aria-selected': this.selected ? 'true' : 'false'
    };
  },

  className() {
    return this.selected ? 'selected' : null;
  }
});

row.selected = true;
row.renderAttributes();
```

This explicit refresh is separate from `render()` and emits no render lifecycle
events. With the default DomApi, only explicit `null` removes a named attribute;
`undefined` and omitted keys leave existing attributes untouched. Custom DomApi
adapters must implement the same `setAttributes` behavior.

Attribute maps use DOM attribute names (`class`, `for`), not property names
(`className`, `htmlFor`). The View-level `className` option still works. Earlier
v5 alphas also assigned matching element properties; v5 now applies attributes
only. Update live form values and custom element properties explicitly on `el`.
For boolean HTML attributes, use `disabled: isDisabled ? '' : null` instead of
`disabled: isDisabled`. Other values, including `false`, are converted to strings;
ARIA attributes such as `aria-selected: false` therefore retain `"false"`.

## jQuery DOM compatibility

v5 core does not depend on jQuery and does not create `$el`. Configure the optional
DOM adapter when the application needs jQuery queries and content operations:

```js
import $ from 'jquery';
import { View } from 'marionette';
import JQueryDomApi from '@mnjs/adapters/dom/jquery';

const JQueryView = View.extend({
  initialize() { this.$el = $(this.el); }
});
JQueryView.setDomApi(JQueryDomApi);
```

Install `@mnjs/adapters` and `jquery` for this integration. The fixed root
makes the application-owned wrapper valid for the View's lifetime. CollectionViews
and Behaviors can initialize `$el` in the same way. A subclass overriding
`initialize()` must also perform any setup it needs from its application base.

Core View, CollectionView, and Behavior types no longer take a `Wrapped` generic.
`ViewInstance<Options, State, Query, Wrapped>` becomes
`ViewInstance<Options, State, Query>`, and `DomApi<Query, Wrapped, Content>` becomes
`DomApi<Query, Content>`. Declare `$el: JQuery<Element>` on application subclasses
that provide it. Use a TypeScript `declare` field so it does not overwrite the
wrapper initialized by the base constructor.

This integration does not restore Backbone.View inheritance. Resolve selector
strings or unwrap jQuery collections before supplying a View `el`.

## Native delegation versus jQuery events

The default EventDelegator uses `addEventListener` on the View's root element.
During a delegated handler, the native `event.currentTarget` is therefore the
View's root `el`. Marionette sets `event.delegateTarget` to the closest matching
descendant between the original target and that root. If nested ancestors match
the same selector, only that closest match invokes the handler; Marionette does
not invoke it again for every matching ancestor.

This is a native DOM contract, not an emulation of jQuery's event system:

- `mouseenter` does not bubble, and Marionette does not provide jQuery's special
  delegated `mouseenter` handling. Use a bubbling event such as `mouseover`
  with an appropriate `relatedTarget` check, or bind `mouseenter` directly to
  the intended element.
- A name such as `click.menu` is a literal native event type, not a `click`
  event in a jQuery namespace. Marionette already tracks and removes a View's
  delegated listeners; application-owned native listeners should retain their
  own callbacks or abort signals for cleanup.
- Returning `false` from a handler does not prevent the default action or stop
  propagation. Call `event.preventDefault()` and/or `event.stopPropagation()`
  explicitly.
- Browser `dispatchEvent()` supplies only the event object to a handler; jQuery
  trigger arguments are not forwarded. Put application data in a
  `CustomEvent`'s `detail`, or use Marionette events when positional arguments
  are part of the application contract.
- Delegated `focus` and `blur` handlers run during capture, before listeners on
  the target element. A Marionette trigger stops propagation by default, so set
  `stopPropagation: false` on a focus or blur trigger when the target must also
  receive the event. Marionette does not translate these names to `focusin` or
  `focusout`.

The optional jQuery DomApi changes query and DOM-manipulation operations only;
it does not replace the native EventDelegator. Applications with a verified
need for different delegation semantics can provide an explicit adapter through
`setEventDelegator`.

### EventDelegator runtime adapter

An EventDelegator is a complete adapter with one method:
`delegate({ eventName, selector, handler, rootEl })`. It registers that handler
and returns an idempotent cleanup function for the exact registration, including
its original root and listener options. Marionette stores the cleanup and calls
it during redelegation or destruction. Registration and cleanup errors stop the
operation; failed construction is not rolled back. The adapter must not mutate
View internals. See the
EventDelegator Adapter section of the DOM interactions API documentation for
the complete timing, error, and cleanup contract.

## Atomic Radio migration

Marionette v5 owns the `Radio` singleton used by `channelName`, `radioEvents`,
and `radioRequests`. It is not the singleton exported by `backbone.radio`.
Replace every application import in one migration:

```js
// v4
import Radio from 'backbone.radio';

// v5
import { Radio } from 'marionette';
```

This includes publishers and requesters that do not instantiate a Marionette
class. Leaving either import in the application creates two channels with the
same name on disconnected buses, so messages and requests can disappear
without an exception. Do not bridge, mirror, or run both singletons as a
compatibility strategy.

Replace `Radio.DEBUG = true` with `Radio.setDebug()` and disable it with
`Radio.setDebug(false)`. Import the Requests mixin with
`import { Requests } from '@mnjs/radio'` and compose it into an object with
`Object.assign`. Import `Channel` from the same package for standalone channels,
or use `new runtime.Radio.Channel(name)` for runtime-specific logging. Standalone
channels are not registered; their owner calls `reset()` when finished.

`Radio.log` and `Radio.debugLog` remain replaceable hooks, scoped to each Radio
instance. `setDebug(false)` also suppresses custom warning hooks. Existing channels
use replacement hooks immediately, and hooks receive their Radio as `this`.

Request/reply methods are not mixed into `Application`, `Behavior`,
`CollectionView`, `MnObject`, `Region`, or `View` instances. Replace an
alpha-only instance call with an explicit channel:

```js
// before
view.reply('status:current', getStatus);

// v5
Radio.channel('status').reply('status:current', getStatus);
```

Use `radioRequests` on `Application` or `MnObject` for declarative replies on
their configured channel. Any owner can use `bindRequests(channel, bindings)`
when it receives the channel explicitly. Pair that registration with
`unbindRequests(channel)` in the owner's cleanup hook; imperative bindings to an
arbitrary channel are not automatically tracked for destruction. Unbinding this
way removes only that owner's replies.

## `detachContents` policy

- The default native DomApi `detachContents(el)` clears the element via
  `el.textContent = ''`. Children are removed from `el`; callers retaining a
  child reference still retain its listeners and data.
- v4 used jQuery's `$(el).contents().detach()`, which is jQuery's documented
  detach-for-reinsertion path. It removes children from `el` while preserving
  jQuery's internal handler/data bookkeeping on those elements.
- Native node removal does not call jQuery's cleanup machinery either.
  Referenced detached nodes retain native listeners, jQuery `.on()` handlers,
  and `.data()` values with both implementations. Detachment alone is not a
  reason to add jQuery. This differs from content replacement with jQuery's
  `.html()`, which cleans jQuery handlers and data from removed descendants.
- Applications needing jQuery query and content-operation semantics can select
  the optional jQuery DomApi adapter at app boot:

  ```js
  import { setDomApi } from 'marionette';
  import JQueryDomApi from '@mnjs/adapters/dom/jquery';

  setDomApi(JQueryDomApi);
  ```

  The adapter's `detachContents(el)` calls `$(el).contents().detach()`,
  matching the v4 behavior.

- The optional jQuery adapter is described in the
  [installation guide](docs/installation.md#jquery-dom-adapter-is-optional).

### DOM adapter setup

Morphdom and Lit now live under `@mnjs/adapters/dom/` and export DOM
operation objects rather than class installers. Update imports from the former
`render` directory; those package subpaths are removed.

```js
import MorphdomDomApi from '@mnjs/adapters/dom/morphdom';
import LitDomApi from '@mnjs/adapters/dom/lit-html';

MorphView.setDomApi(MorphdomDomApi);
LitView.setDomApi(LitDomApi);
```

Custom renderers must return their template result. `undefined` is passed to
`Dom.setContents` and clears contents with the supplied native, jQuery, Morphdom,
and Lit adapters; it no longer signals a renderer that performed its own DOM
update. Put direct DOM updates in `setContents` instead.

Lit uses element-only `notifyAttach` and `notifyDetach` hooks and no longer patches View
lifecycle methods. Detachment and destruction disconnect directives without
emptying their DOM. With attachment monitoring disabled, deliver these
notifications from application code. Lit event handlers use the element as their
receiver rather than the View; use a closure for View access.

## Shared utilities

Reusable helpers live in `@mnjs/utils`. Core and native data use the same
implementations; install the matching version directly when importing helpers
into your own components. Existing public Marionette helper exports still refer
to those functions. Source-file imports are not package entry points.

Core ESM and CommonJS builds import `@mnjs/utils` and `@mnjs/radio`.
Browser projects loading raw ES modules must map both packages in their import map, or use a
bundler. Standalone UMD builds remain self-contained.

### Native object copying

Use object spread or `Object.assign` instead of the removed `@mnjs/utils`
`assignOwn` and `assignIn` helpers. Configuration copies follow native own-property
semantics, including enumerable symbol keys; string sources expose character keys
instead of being silently ignored. There is no getter-ordering contract beyond
the chosen native operation. `extend` retains inherited enumerable parent statics
and defines subclass properties so they can shadow inherited getters. Dynamic
model and event keys such as `__proto__` remain ordinary data properties.

### Standalone Events, Radio, and data

`@mnjs/utils` owns the shared `Events` implementation. `@mnjs/radio`
exports the default `Radio` and the `createRadio()` factory. Core continues to
export the same Events, Error, and default Radio within each module format.
`createMarionette()` continues to create an isolated Radio for each runtime.

`@mnjs/data` now depends only on utils; core is no longer a peer dependency.
Standalone data and messaging consumers do not need to install Marionette core.
These packages keep the same version and release together with core and adapters.
