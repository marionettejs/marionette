# Working on @mnjs/html

This is an unpublished, private prototype. Preserve upstream source headers and the complete BSD-3-Clause and MIT notices. Compare implementation changes against vendor/lit-html-3.3.3 and document intentional compatibility changes.

Use authored TypeScript source. Run npm run check after changes. For DOM movement, lifecycle or security changes, run npm run test:browser against the built output. Tests import public package entrypoints and assert observable DOM identity, events, ownership and externally tracked cleanup; do not probe private Part or Marionette internals.

Preserve the renderer's bounded range and Marionette's synchronous failure contract. Do not add recovery/rollback, replace AsyncDirective reconnection, or broaden the public subset without a concrete requirement. Keep unused adapter functionality out of the core import graph.

Do not publish, create a remote repository, push, or deploy without authorization. Report exact revision, commands, results and remaining verification gaps. Size is not runtime performance.
