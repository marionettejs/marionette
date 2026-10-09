# Latest navigation wins

Use the installed Marionette skill and documentation to implement `solution.mjs`.
This existing application renders plain records with the default native DOM and
function templates. Its router already calls a navigation function. Keep those
choices; do not introduce another router or a data/state provider.

Export `createNavigation({ el, loadRecord })`. It returns an object with:

- `navigate(id)`: load through `loadRecord(id, { signal })`, then display the
  record's `title` in an `h1` using a Marionette View and Region. The title is
  untrusted text. Resolve `true` when displayed and `false` when superseded or
  disposed. Reject a current load failure while keeping the displayed page.
- `dispose()`: permanently stop navigation, cancel pending work, and remove the
  displayed View through its Marionette owner.

A loader may ignore cancellation. A late success or failure must not affect the
current page, even when the user navigates to the same id twice. Replacement must
clean up the previous View. Keep the supplied mount element in the document.

Write a small public smoke test if useful. In `REPORT.md`, record the docs and
skill operations you used, integration choices, commands run, and uncertainty.
Do not read acceptance tests or alter installed dependencies. Do not implement a
complete application, server, or build system.
