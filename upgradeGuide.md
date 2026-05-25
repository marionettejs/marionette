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

## Optional jQuery DomApi adapter

- v5 core remains jQuery-free. `View` and `CollectionView` instances no longer
  create `$el` with the native DomApi.
- Projects that still need jQuery-shaped DOM helpers can opt in with the
  `marionette/jquery-dom-api` subpath:

  ```js
  import { setDomApi } from 'marionette';
  import JQueryDomApi from 'marionette/jquery-dom-api';

  setDomApi(JQueryDomApi);
  ```

- The adapter imports `jquery`, so jQuery is an optional peer dependency only for
  consumers that opt into this subpath.
- DomApi configuration is snapshotted when a `View` or `CollectionView` is
  constructed. Calling `setDomApi` later affects future instances, not existing
  ones.
