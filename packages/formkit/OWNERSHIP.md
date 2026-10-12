# Canonical ownership checkpoint — 2026-10-12

This record describes execution in the new canonical owner. The acceptance files
under `acceptance/` retain the old owner's measurements and scope; those results
are historical evidence, not measurements of this checkout.

## Accepted source and preservation

The supported Drive transfer supplied twelve checked chunks of the audited Git
bundle: **11,811,974 bytes**, SHA-256
`ff8dd68e33bd4f80c5c8cadef1424b2f240ac27a6ed18b54ffa86081edeba0d5`.
The imported history resolves to commit
`11a3f8305402b9cdda7fd9918daeb9a9ad9d1fc3`, tree
`68a388d0ef42342ab135e7ba0a4ea84f6d27bd9c`; full Git integrity checking passed.
All 34 manifest-listed commits are present and ancestors of that target.

Only the owned package, examples and verification inputs were selected from this
history. All nine production modules, all 24 original unit suites and the private
composition experiment retain their verified source bytes. Stable Marionette
5.0.0, the five stable package release targets, their production source and the
`@mnjs/test` checkpoints `07ddd1a8` and `f844492c` are preserved. FormKit remains
an unpublished development package at 5.0.0-rc.2; its runtime dependencies remain
exact FormKit 2.1.2 packages and its original Marionette peer range is retained.

## Ownership and normal commands

`config/package-ownership.json` separates seven owned packages from the five
stable release targets. `npm run check:packages` rejects missing package identity,
build, source coverage, runtime API inventory or required verification inputs.
Normal `npm run build` builds FormKit and its ESM/CJS declarations. Normal
`npm run verify` checks ownership and consumes packed FormKit artifacts. CI runs
the artifact consumer and retains its report; the browser lane runs the locked
native example and retains its results. `npm run verify -- --full` includes this
same browser command and installs its locked example dependencies first.

| Acceptance goal | New owner evidence |
| --- | --- |
| Original suites and coverage preserved | `npm run coverage`: 2,528 tests in 171 files passed. Each of the nine FormKit modules, the separate experiment and both helper modules has 100% statements, branches, functions and lines. Existing core coverage exceptions are unchanged. |
| Build, source, distribution and declarations | Normal build, source consumer, distribution consumer and zero-warning lint passed. Strict ESM/CJS consumers execute all four restored FormKit type fixtures. |
| Installed artifact consumption | `npm run test:formkit-package`: four local tarballs, isolated install, captured lock and repeat `npm ci`, exact versions, unchanged 26 ESM/CJS cycles, and strict declarations. The report binds artifacts, source, runner and lock hashes. |
| Actual public API/browser use | `npm run test:formkit-browser -- --project chromium`: all 11 original native browser cases passed, including two-level owned rows and independent form lifetimes. Five-page example production build passed. |
| Documentation delivery | `npm run docs:check`: 55 executable recipes, 20 type fixtures and 15 TypeScript examples passed. FormKit guides participate in the canonical documentation export and public API inventory. |
| Normal and tooling verification | `npm run verify` passed all gates, 2,528 unit tests and the nine artifact-consumer stages. `npm run coverage:tooling` passed all 440 tests; the unchanged release-tool coverage policy passed with 95.26% lines/statements, 79.62% branches and 100% functions. |
| Helper dogfooding | The isolated `test:helpers:formkit` fixture passed strict declarations, 16 DOM tests and nine browser tests against the newly owned tarball and stable Marionette 5.0.0. Its independent seven-case application suite is unchanged. |

The development package's two-level owned `RowView` ancestry is certified within
the recorded nested-row fixtures. Arbitrary depth, unowned schema arrays and
direct Core tree mutation do not gain a certification claim from this transfer.
See [rows](rows.md) and [compatibility](compatibility.md) for runtime boundaries.

## Remaining execution limits

The unchanged pinned actionlint gate passed for all eight workflows after the
exact official archive was provided through the supported transfer and verified
locally against `config/actionlint.json`. Direct GitHub DNS returned `EAI_AGAIN`
before that transfer. No gate was skipped or weakened; a fresh environment still
needs the official download or an archive matching the configured checksum.

Browser results used explicitly selected system Chromium **154.0.8037.57** and
Playwright **1.63.0**. The pinned Chromium **153.0.8010.12** (revision 1243)
download previously returned HTTP 403 in this environment. These results do not
certify the pinned browser, Firefox, WebKit or Cypress. No repeated browser
download, registry publication, release, remote push or deployment was attempted.

Broad tooling verification exposed a pre-existing portability defect: numeric
filesystem inode IDs lost precision above `Number.MAX_SAFE_INTEGER`, so separate
benchmark files appeared hard-linked. Only the guard's two identity-bearing
`stat` calls and its zero sentinel were changed to exact BigInt values. The three
original failures then passed, along with all 19 file-boundary tests and the full
440-test tooling lane. Hard-link and symlink rejection remain enabled. Product
features and runtime behavior were not extended by this checkpoint.
