# Performance measurements

Marionette v5 is still changing. Bundle sizes and hosted timings inform review;
they do not impose a release budget during alpha development. Adding an optional
adapter or reorganizing an export does not require a performance approval record.

## What we measure

`npm run size` builds the packages and reports Brotli-compressed artifacts,
production module graphs, representative consumer bundles, and deterministic
allocation and retention observations. Core, data, and adapter packages are
measured separately. ESM, CommonJS, and UMD are alternative distributions, not
bytes every application downloads together.

CI compares the exact PR base with the candidate. Each checkout uses its own measurement
script, configuration, package exports, and built files.
The report labels new and removed paths explicitly; a renamed adapter appears as
one removed path and one new path. It does not claim those paths are comparable.
The report and underlying JSON measurements are attached to the CI run.
When consumer fixtures or their tooling change, their sizes are labeled
non-comparable rather than presented as a regression.

The historical Phase 0 values remain available as context. They are not ceilings.
Past budget-amendment evidence is retained under `evidence/` for provenance, but
its approval process is retired.

## What still fails

Reporting-only size does not mean accepting broken packages. Checks still reject:

- Missing built artifacts or exported entry points omitted from the measurement inventory.
- Production graphs that cannot be measured or include forbidden development files or dependencies.
- Consumer fixtures that unexpectedly import optional adapters or their peers.
- Invalid measurement fixtures or a mismatched measurement toolchain.

Normal runtime, browser, type, and package tests remain required. Resource changes
are review observations; an extra property or allocation is not automatically a
bug. Lifecycle tests establish the supported cleanup behavior.

## Adding an adapter

Add its public exports, build outputs, and measurement entries alongside its
implementation and tests. `config/performance.json` lists the runtime artifacts
and production graphs; `scripts/performance/adapters-package-size.mjs` checks the
adapter's external dependencies and measures its published formats. No frozen
baseline, relocation ledger, special approval comment, or ceiling increase is
needed.

Optional adapters must stay out of consumers that do not import them. The
consumer-bundle fixtures in `benchmarks/consumer-bundles/` exercise selected
public imports and report each application's resulting bundle. Extend those
fixtures when a new consumer scenario is useful; installing the adapters package
is not itself evidence that all adapters ship to the browser.

## Timing and reproducibility

`npm run performance:timing` records hosted timing samples. CI reports median and
p95 changes and identifies changed workloads as non-comparable. Hosted timings
are noisy: investigate meaningful changes with matched builds and repeated,
alternating runs before attributing them to a code change. Do not replace a full
benchmark result with an unlabeled targeted retry.

The release profile pins the build toolchain. Reports retain the measured
artifact inventory and timing workload metadata so comparisons can be assessed.
A measurement failure remains a failure; it must not appear as a zero-size
artifact or a passing benchmark.

## Revisit budgets after v5 stabilizes

Once the API and package boundaries settle, choose representative consumer
bundles and record a stable baseline. Any future budget should protect a useful
user outcome, account for optional dependencies, and distinguish intentional
features from unexplained regressions. Do not automatically reactivate the old
Phase 0 ceiling or per-PR approval threshold at release time.
