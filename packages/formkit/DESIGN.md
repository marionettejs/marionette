# Package architecture and released-peer integration

This private local package provides ESM/CJS main and components entries with
separate declaration scopes. All eight runtime FormKit dependencies are pinned
together to 2.9.0; Marionette is a ^5.2.0 peer. The isolated development and consumer
graph pins official Marionette, Radio and Utils to 5.2.0. Root release workspaces,
release scripts and Core source remain at release commit 1b694b54.

Production code is owned by packages/formkit/src: two public entry wrappers and
22 runtime modules. The retained d310f355 archive supplies exact source-map runtime
content and public declarations. The known older public draft supplies identified
development/build/test scaffolding, not current runtime behavior. The original
retained development tree and later browser wrapper-v3 patch were not recovered.
This is a fresh, explicitly described reconciliation; it is not restoration of an
unknown private Git revision.

The adapted bindings retain their historical React2.5 source attribution and the
retained candidate's reviewed 2.9 parity adjustments. No claim that they are an
unmodified React2.9 binding is made. A package-local extractor now uses the locked published React2.9 reference plus
recorded exact adaptation edits, with input/output hashes and no formatter or
bootstrap. React remains development-only. Runtime behavior is not downgraded.

Package build externals are the declared Marionette/FormKit imports. Rollup maps
preserve runtime source content. Public declarations remain hand-maintained;
positive/negative strict consumer checks give bounded evidence, not a complete
source-to-declaration proof. Framework-specific Vue/React hooks are not portable
component APIs and are not introduced here.

The npm private guard remains enabled. Packed contents exclude source/tests,
node_modules, TCM fixtures, Pro and credentials. Local pack/consumer verification
is permitted; no registry release, remote push or merge occurs. Browser timings,
physical focus/IME, actual TCM host/Pro/full Application and memory certification
remain separate. See RELEASED-520-INTEGRATION.md and PROVENANCE.md.
