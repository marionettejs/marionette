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

## Installation limit

Fresh full `npm ci --offline --ignore-scripts --no-audit --no-fund` fails because
`whatwg-url@17.1.1` is not in the local cache. Registry networking was previously
denied; no bypass was attempted. Current exact-version development tools remain
linked to an existing installation. Passing tests and lockfile checks are not
represented as a successful clean full dependency install.

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
