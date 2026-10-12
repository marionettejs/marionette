# Bounded application lifecycle contracts

`test/unit/formkit-application-lifecycle.spec.js` uses synthetic values, ordinary
Marionette ownership, public package imports, genuine FormKit nodes and native
controls. It does not embed customer source or implement an engine in the package.

The seven focused cases cover:

- Complete initialized and stored snapshots retaining application data through
  native control mounting, with silent partial projections producing no echo.
- An application-owned two-second debounce saving the latest committed snapshot.
- External errors persisting through edits, their accessible summary hiding when
  valid and returning when invalid, real validation messages on invalid submit,
  and clearing at the valid application submission callback.
- Derived update metadata bypassing one application manual-override effect while
  still notifying the owner and participating in draft persistence.
- Business list writes resolving stable IDs across reorder, retained control/focus,
  and an authoritative deletion superseding older pending native values.
- Discard through Region destruction and fresh construction, cancelling the
  application's pending draft timer, aborting submission, releasing node registry
  entries and row Views, and ignoring retained controls and late completion.

Run `npm test -- test/unit/formkit-application-lifecycle.spec.js`. These are adapter
integration contracts with explicit application wiring. They do not certify actual
host initialization, remote storage durability or debounce, iframe recreation,
clinical transformations, paid inputs, or a complete application migration.
No new reset baseline or error policy is introduced. The existing strict File
equality and Vue terminal-lifetime failures remain unchanged and recorded.
