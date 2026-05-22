## From backbone.marionette.js

Todo

## Peer dependency requirements

- Underscore must be `1.13.0` or later. Marionette v5 publishes named ESM imports
  from `underscore`, and Underscore versions before 1.13 are CJS-only with no
  package `exports` map, so modern Node and bundler ESM resolution cannot satisfy
  the named imports.
