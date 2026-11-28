# Package architecture

`@mnjs/formkit` provides ES module and CommonJS entries for the main API and
component helpers. Each module format has its own TypeScript declarations.
Marionette is a peer dependency; the FormKit packages share a pinned Core
version because the pending-edit API depends on Core scheduling.

A `FormKitView` owns the form's Core node tree and renders it through the
configured Marionette DOM provider. Showing it in a Region lets Marionette
control attachment and destruction. Schema rendering, binding adaptation and
value observation are package-owned; the runtime does not require Vue or React.
Foreign component factories own their renderer and cleanup.

Rollup leaves the declared Marionette and FormKit imports external. Packed
consumer tests validate both formats and representative public type contracts.
The declarations are maintained separately from the runtime. See
[provenance](PROVENANCE.md) for the binding source and reproduction process.
