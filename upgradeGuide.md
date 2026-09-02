## From backbone.marionette.js

See the [v4-to-v5 compatibility ledger](docs/migration-from-v4.md) for the
current public behavior boundary. Final migration documentation is tracked in
[issue #147](https://github.com/marionettejs/marionette/issues/147).

## Configure model and collection data

- Marionette core no longer reads Backbone-specific `cid`, `attributes`, `get`,
  `models`, `indexOf`, or structural event payloads.
- Plain object models and array collections work through the default DataApi.
- Applications using Backbone must select its integration once at boot:

  ```js
  import 'marionette/backbone';
  import Backbone from 'backbone';
  ```

- Other data sources can configure `setDataApi` with identity, read,
  serialization, ordered-item, subscription, and collection-observation methods.
  See [Data API](docs/data.api.md).
- Replace `children.findByModelCid(cid)` with `children.findByModel(model)`.

## Underscore is no longer a peer dependency

- Marionette v5 core does not import or declare Underscore as a peer dependency.
- Remove an explicit Underscore installation if it existed only for Marionette.
  Keep it as an application dependency when your own code uses it, such as an
  `_.template` supplied to a View.
- The optional Backbone shim relies on Backbone's own declared Underscore
  dependency.

## View `el` is element-only

- `View` (and `CollectionView`) accept a DOM element for `el` in v5. Selector
  strings are no longer resolved, and jQuery collections must be unwrapped.
- v4 inherited string-`el` resolution from `Backbone.View._ensureElement`, which
  used jQuery to look up the selector. v5 drops `Backbone.View` inheritance and
  the default jQuery dependency, so the string-resolution path goes with them.
- v5 now throws a `ViewError` with a migration hint on construction (or
  `setElement`) when a string is passed, instead of silently storing the raw
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

## jQuery DOM compatibility

- v5 core does not depend on jQuery and the native DomApi does not create
  `view.$el`.
- Apps that need the v4 jQuery compatibility surface can opt into the
  `marionette/jquery-dom-api` adapter:

  ```js
  import { setDomApi } from 'marionette';
  import JQueryDomApi from 'marionette/jquery-dom-api';

  setDomApi(JQueryDomApi);
  ```

- The adapter imports `jquery`, so jQuery is an optional peer dependency only for
  consumers that opt into this subpath.
- With the adapter active before construction, `View` and `CollectionView`
  create and refresh `$el` through `setElement()`. Behaviors mirror their host
  View's `$el`. `view.$(selector)` also returns a jQuery collection.
- This does not restore Backbone.View inheritance or allow selector strings as a
  View `el`; resolve View elements explicitly. Region selector strings remain
  supported.

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
and returns a cleanup function for the exact registration, including
its original root and listener options. Marionette stores the cleanup and calls
it at most once during redelegation, `setElement()`, destruction, or failed construction.
The adapter must register atomically and must not mutate View internals. See the
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
`Radio.setDebug(false)`. The v4 `Radio.Requests` mixin is removed; use request
methods on `Radio.channel(name)` or on the top-level built-in `Radio` API.

## `detachContents` policy

- The default native DomApi `detachContents(el)` clears the element via
  `el.textContent = ''`. Children are removed from `el` and Marionette no
  longer holds references to them.
- v4 used jQuery's `$(el).contents().detach()`, which is jQuery's documented
  detach-for-reinsertion path. It removes children from `el` while preserving
  jQuery's internal handler/data bookkeeping on those elements.
- For most apps the user-visible difference is small — `Region.empty()`
  discards the detached content in both cases, and DOM event listeners
  attached via `addEventListener` remain on referenced child elements either
  way. The difference matters for apps that detach-then-reinsert children
  externally and rely on jQuery's `.on()` handlers, `.data()` cache, or other
  jQuery-internal element bookkeeping surviving that cycle.
- Legacy code that depends on the v4 jQuery semantics can opt into the
  optional jQuery DomApi adapter at app boot:

  ```js
  import { setDomApi } from 'marionette';
  import JQueryDomApi from 'marionette/jquery-dom-api';

  setDomApi(JQueryDomApi);
  ```

  The adapter's `detachContents(el)` calls `$(el).contents().detach()`,
  matching the v4 behavior.

- The optional jQuery adapter is described in the
  [installation guide](docs/installation.md#jquery-dom-adapter-is-optional).
