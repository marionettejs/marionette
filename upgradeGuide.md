## From backbone.marionette.js

Todo

## Peer dependency requirements

- Underscore must be `1.13.0` or later. Marionette v5 publishes named ESM imports
  from `underscore`, and Underscore versions before 1.13 are CJS-only with no
  package `exports` map, so modern Node and bundler ESM resolution cannot satisfy
  the named imports.

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

- v5 core does not depend on jQuery and does not create `view.$el`.
- Apps that want Marionette DOM operations such as `view.$(selector)` to return
  jQuery collections can opt into the `marionette/jquery-dom-api` adapter:

  ```js
  import { setDomApi } from 'marionette';
  import JQueryDomApi from 'marionette/jquery-dom-api';

  setDomApi(JQueryDomApi);
  ```

- The adapter imports `jquery`, so jQuery is an optional peer dependency only for
  consumers that opt into this subpath.
- The adapter intentionally does not add `$el`. If legacy app code still expects
  `view.$el`, set it in your own view layer:

  ```js
  import $ from 'jquery';
  import { View } from 'marionette';

  const LegacyView = View.extend({
    initialize() {
      this.$el = $(this.el);
    }
  });
  ```

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

- The native default is also described in [docs/dom.api.md](docs/dom.api.md).
