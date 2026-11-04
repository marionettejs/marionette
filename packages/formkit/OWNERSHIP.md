# Master integration — 2026-11-03

Branch `codex/formkit-master-integration-20261103` starts from master
`c83a9f255692291eb62dc05a6d4073424afb7dfe`. It ports the scoped FormKit package and
verification inputs from `16aa74fe1160c15e0a3121839e4ab9e576d0c19d`, retaining
master's shared runtime, `@mnjs/test` 0.2.0, and pinned tooling. The repair branch
is preserved. The initial integration evidence records passing build/package
checks, 2,737 unit assertions plus one expected failure, 16 native Chromium cases,
and Pro 0.130.3 no-Vue imports/build with 14 core comparison checks. See the
[integration receipt](https://github.com/marionettejs/marionette/tree/codex/formkit-master-integration-20261103/packages/formkit/acceptance/master-integration-20261103)
for exact tested revisions, logs and limits.

The follow-up removes redundant nested composition refreshes and direct-token
compilation, with public behavior regressions. A complete covered run at
`0dee5f85bc91e647945721e5ff81eec080299ccd` passed 2,740 tests plus one expected
failure and all existing thresholds; all nine FormKit modules reached 100%.
Coverage now budgets two workers, preserving every assertion, cycle count,
timeout and threshold. The canonical rerun at `d623599a` passed every FormKit
case but timed out in the unchanged core jQuery-free bundling test. A subsequent
canonical run on clean `b557f86b` passed all 2,740 tests plus one expected failure
and every existing coverage threshold. The intermittent failures remain preserved.

Independent vault QA reported 107/107 functional Pro 0.130.3 assertions at
`db655482`. Extended positioning checks passed only 12/30 with the original
fixture, then 30/30 with a transient positioning rule. The permanent fixture now
imports the official base Genesis theme before the Pro extension. Independent
vault QA then reported 137/137 assertions on `b557f86b` with that permanent theme
setup: 107 functional plus 30 positioning/scrolling checks. Online license
validation and direct Destroy-button reachability under an open panel remain
unverified. The new Pro 0.130.4 fixture retains Core 2.1.2 and needs its own actual
control retest; see the [release receipt](https://github.com/marionettejs/marionette/tree/codex/formkit-master-integration-20261103/packages/formkit/acceptance/pro-01304).
Historical passes below must not be attributed to later source or styling.

The earlier versioned [independent Pro receipt](https://github.com/marionettejs/marionette/blob/16aa74fe1160c15e0a3121839e4ab9e576d0c19d/packages/formkit/acceptance/pro-repeater-20261103/README.md) applies to source
`1d8e1680f416ea182873c9120315ec24970225c9`: 107/107 local assertions, zero page
errors/timeouts, Core 2.1.2, Pro 0.130.2, Chromium 154.0.8037.57. Online license
validation remains unverified because of the recorded proxy failure. It is not
a complete parity, performance, release, or customer-application certificate.

# Canonical ownership checkpoint — 2026-10-12

This historical record describes execution in the canonical owner on October 12. The acceptance files
under `acceptance/` retain the old owner's measurements and scope; those results
are historical evidence, not measurements of later checkouts.

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
