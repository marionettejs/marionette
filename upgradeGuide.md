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

## jQuery `$el` compatibility

- v5 core does not create `view.$el`. If an app still has view code that expects
  a jQuery-wrapped element, set it in your own view layer instead of configuring
  Marionette globally.
- For example, a legacy app can define a local base view:

  ```js
  import $ from 'jquery';
  import { View } from 'marionette';

  const LegacyView = View.extend({
    initialize() {
      this.$el = $(this.el);
    }
  });
  ```

- If the same view calls `setElement`, update `$el` in that app-specific override
  as well. New v5 code should prefer `view.el`, `view.$(selector)`, and native DOM
  APIs.
