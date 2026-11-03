# Verified local consumer checkpoint

Executed 2026-10-12 in the canonical Marionette workspace. Node 24.19.0 and
npm 11.17.0; published runtime Marionette 5.0.0. The helper is unpublished
`@mnjs/test@0.1.0`, whose packed SHA-256 remains
`ae6c70a58ce6f1766fe9cdbd3ba8900111a928e2237d9e3c8fcdf72aa6889442`.

FormKit source snapshot: `baab5619fcf207eb2ec1139d367dcea09c67acd2`, production
runtime commit `a9a6e43becf89c6e4c3b13dd060c5f5e059b11df`. Its source-only archive,
manifest and import guide were received through bounded authenticated Drive
inline fetches and verified before extraction. All nine source hashes matched
the owner manifest before and after a scoped fresh runtime/declaration build.
The build uses canonical build helpers, exact FormKit 2.1.2 dependencies and
published stable Marionette declarations. The package retains its development
version 5.0.0-rc.2; no publication is claimed.

Fresh FormKit artifact SHA-256:
`4de9d7c7bf7757aee472dad82a738920d26d23f826d1d4b2181aa42ead684bb4`.
No FormKit production source was changed or stale distribution substituted.

The isolated runner passed artifact packing, installation, repeated locked
installation, exact versions, strict ESM/CJS declaration inference, 16 JSDOM
cases and nine Vitest Browser cases. Seven JSDOM cases come from the unchanged
independent FormKit suite; nine use the test helper. Runtime FormKit dogfooding
uses ESM; the CJS check establishes declarations, not runtime execution.
The generated lockfile is retained and repeated with `npm ci` within the run;
future fresh resolution can change transitive dependencies.

Browser: existing system Chromium 154.0.8037.57. These are supplemental checks,
not certification of the unavailable pinned browser. No browser installer or
Cypress retry was performed. Existing core/helper verification passed 2,144
tests, with both helper source files at 100% statement/branch/function/line
coverage and existing core exceptions unchanged. Build/types/lint and public
source/distribution checks passed.

Independent contract and execution reviews found no demonstrated helper runtime
defect. One borrowed-host assertion was strengthened to require the actual
surviving sibling and listener. No helper production fix or fail-before/pass-after
runtime claim is made. Terminal spies check public dispatch on retained objects;
these are bounded lifecycle checks, not a universal heap or plugin leak audit.

The verified FormKit regression supplement was replayed separately against
installed published Marionette 5.0.0 and @mnjs/data 5.0.0, with exact FormKit
2.1.2, Vitest/coverage-v8 5.0.3 and JSDOM 30.1.2. All 22 compiled public-package
suites passed: 326 tests. The private experiment suite was excluded from that
stage because it imports source rather than a package export.

A second focused source run aliases only the FormKit entry, preserving the
installed stable core/data graph. All 23 unchanged suites passed: 374 tests.
Coverage includes all nine production modules and the one unexported experiment;
each file passed 100% statements, branches, functions and lines, with no
exceptions. Aggregate counts were 1,887 statements, 1,429 branches, 408 functions
and 1,439 lines, all covered. Every production source hash still matches the
baab5619 manifest. No stable-v5 incompatibility appeared in these focused suites.
Neither this result nor the compiled replay certifies the historical entire
2,481-test/168-file checkout. Original whole-repository configs were retained as
provenance and did not replace canonical configuration. The prototype remains
unexported, and no ongoing nested-row source or runtime fix was imported.

The focused replay's config, lock, per-suite hashes, versions, logs and per-file
coverage are retained with the verified source in the private workspace at
`/workspace/scratch/mnjs-formkit-build-baab5619/focused-replay-report.json`.
Missing historical row-type fixtures do not block this measured runtime gate;
the artifact consumer separately verifies strict ESM/CJS value declarations.

Structured artifact, source, fixture, independent-suite, lock and browser evidence
is retained under `test/tmp/formkit-test-package-consumer/`. Original transferred
bytes and restored/scoped source are preserved in the private workspace backup.
No push, PR, merge, release, package publication or deployment occurred.
