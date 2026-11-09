# 0.1.0 package candidate verification

Local verification on November 9, 2026 used Node 24.19.0 and npm 11.17.0:

- `npm run check`: production 368 passing cases with 7 expected skips;
  development 370 passing cases with 5 expected skips; declarations and isolated
  packed-consumer checks passed. All 32 JavaScript exports and runtime smoke
  checks run from an extracted archive under both conditions. Both conditions run 375 cases. The packed file
  allowlist contains 204 files, including this reference, notices and sources.
- Upstream integrity checks and negative tests passed. Offline recovery verified
  the pinned archive SRI and reproduced all 28 removed reference implementations.
  All 192 authored-source/distribution file hashes remain unchanged from the
  preceding reviewed candidate; maintenance and packaging do not change runtime.
- All three executable package-reference examples passed (four documentation tests).
- `npm run test:packed:browser`: the full suite passed against extracted archive
  files in both default and development conditions, including all 32 JS exports.
  Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6
  passed lifecycle, DOM ownership, restored public API and applicable security
  checks. Comment-ending regressions preserve bindings, escaping and event rejection.
  New public regressions cover 12 escaped CSS property names, keyed cleanup,
  nested synchronous/async directive disposal, detach/reconnect, duplicate
  same-version Directive classes, repeat/cache ownership and attribute slots.
- Root build, lint and pinned actionlint passed. Documentation export, all 57
  executable core reference examples and 20 declaration fixtures passed; 86 site
  pages built and 1,167 internal links validated. Installed core-documentation
  checks passed using the existing offline npm cache.

The HTML package's clean offline install could not retrieve one uncached dependency.
Tests used the previously installed dependency tree, audited against this lockfile:
61 installed versions matched and 25 optional platform packages were omitted.
The repaired lock also passed offline Linux, macOS and Windows dry-run
resolution; this is not a fresh dependency-install certification. The subsequent independent CI workflow successfully performed a clean Linux
install and repeated package/browser checks; see Installation evidence below.

A separate, fixed 12-pair no-async sanity check compared only the lazy disposal
hook change, with identical source toolchain and production builds. On this Mac,
1,000-row synchronous mount medians were 3.60 ms in both arms; 20-update batches
were 10.10 ms before and 9.80 ms after. The paired mount ratio's bootstrap 95%
interval was 0.959–1.096. This small synthetic check found no material slowdown;
it does not establish zero overhead, paint speed or application performance.

The package remains unpublished. CI is separately identified below; neither local checks nor CI establish
registry contents or a deployed documentation website.

## Historical prototype evidence

> Historical prototype evidence follows. The package-only 0.1.0 addition keeps
> the runtime freeze as its base, with focused fixes and package metadata/documentation changes. These prior
> results are not a fresh verification claim for its archive; run the commands in
> [INTEGRATION.md](INTEGRATION.md) for the current checkout.

# Runtime-only validation: 2026-11-08

Private, unpublished prototype based on local main
`9dd5dccb9eb07208fc2fdbee819c9353cba990a6`, with uncommitted improvements.
This checkpoint extracts experimental compiler/Vite functionality and renames
the internal core to `src/renderer.ts`. Public runtime import paths remain.

## Passed

- Node 24.15.0: `npm run check` builds 32 production modules, runs 365 tests in
  each condition (358 passed/7 skipped production, 360 passed/5 skipped
  development), checks consumer types and the packed package's exports/notices.
  Skips are explicit development-only tests, upstream-disabled Symbol cases and
  the private-protocol styleMap case, not hidden failures.
- Expanded pristine upstream subset: 290 passed/4 skipped against both this
  renderer and Lit 3.3.3 in production and development. The 33 additions include
  the complete 23-test async-directive suite plus 10 synchronous/nested cases.
  Test bodies/assertions remain intact. Harness adaptations select suites,
  imports, runner/assertion plumbing and explicitly noncompiled execution.
- New public lifecycle cases verify cached subtree disconnect/reconnect with
  DOM/input identity and keyed subscription preservation/selective cleanup.
- Production browser suite: Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6.
  Covers Marionette ownership/lifecycle/events, restored opt-in APIs, native and
  forced-fallback movement, detached roots, focus/selection where supported,
  event-binding restrictions and Chromium Trusted Types policy enforcement.
- Actual metadata-honoring Rollup graphs retain runtime preparation while
  removing unused svg/mathml/render exports from the Marionette-only path.
  Package checks reject compiler/compiled-only files and exports.
- Fresh offline production-only installation succeeds with the sole declared
  type dependency, followed by an isolated packed-consumer type check.

## Installation evidence

The historical local fresh full `npm ci --offline --ignore-scripts --no-audit --no-fund` fails because
`whatwg-url@17.1.1` is not in the local cache. Registry networking was previously
denied; no bypass was attempted. Local checks used existing exact-version development tools. Separately, clean
Linux CI successfully ran `npm ci --ignore-scripts`, package checks and all three
browser engines at commit `6dc959622556ebfdbf0fe391015bd3b388cec423`: [HTML run
42575612610](https://github.com/marionettejs/marionette/actions/runs/42575612610).
This supersedes the package-wide install blocker, not the historical local-cache
limitation, and does not certify clean installation on every platform.

## Size, not runtime speed

Equivalent production exports, same Rollup/Terser finishing pipeline:

| Bundle | Lit 3.3.3 gzip | Runtime-only @mnjs/html gzip |
| --- | ---: | ---: |
| Core | 3,108 | 3,100 |
| Core + repeat | 3,902 | 3,895 |
| Complete matched Marionette benchmark app | 20,522 | 20,555 |

The complete application uses the same frozen app/dependencies and production
pipeline, gzip level 9. Its runtime-only output is 70,849 raw bytes versus Lit's
71,067. Compression is non-additive; these figures are not speed measurements.

Earlier CPU and memory studies are preserved with their exact compiler-enabled
runtime snapshots. Removing compiled handling changes the ordinary application
hash, so old timings are historical evidence, not proof of this artifact's
performance. No universal parity or leak-freedom claim is made. Review evidence
and source hashes are retained separately in the repository.
