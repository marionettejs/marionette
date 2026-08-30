## From backbone.marionette.js

See the [v4-to-v5 compatibility ledger](docs/migration-from-v4.md) for the
current public behavior boundary. Final migration documentation is tracked in
[issue #147](https://github.com/marionettejs/marionette/issues/147).

## Underscore is no longer a peer dependency

- Marionette v5 core does not import or declare Underscore as a peer dependency.
- Remove an explicit Underscore installation if it existed only for Marionette.
  Keep it as an application dependency when your own code uses it, such as an
  `_.template` supplied to a View.
- The optional Backbone shim relies on Backbone's own declared Underscore
  dependency.

## View `el` is element-only

- `View` (and `CollectionView`) accept a DOM element for `el` in v5. Selector
  strings are no longer resolved.
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
  Backbone, so it is preserved.

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
