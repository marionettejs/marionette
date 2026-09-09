# Performance measurements

Marionette v5 is still changing. Bundle sizes and hosted timings inform review;
they do not impose a release budget during alpha development. Adding an optional
adapter or reorganizing an export does not require a performance approval record.

## What we measure

`npm run size` builds the packages and reports Brotli-compressed artifacts,
production module graphs, representative consumer bundles, and deterministic
public instance-construction and retention observations. Core, data, and adapter packages are
measured separately. ESM, CommonJS, and UMD are alternative distributions, not
bytes every application downloads together.

The current consumer-bundle authority is fixture v2. It retains the v1 full-root
and optional-adapter entries unchanged and adds named-import applications for
`View` plus `Region`, native `CollectionView` data, and `Application` plus state.
Changing fixture versions makes the resulting report non-comparable with older
bundle evidence; the old fixture remains available for replay rather than being
silently rewritten.

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

Resource schema 2 counts consumer-observed View, Region, Behavior, and CollectionView
initializations, plus external subscriptions, DOM listeners, callbacks, DOM connectivity,
and public ownership after teardown. It does not inspect private instance fields,
internal indexes, or allocation shapes. These metrics are not directly comparable
with earlier private-representation counts; the report identifies that schema change.

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

That command remains the active CI-comparable jsdom and Backbone adapter-backed
series retained for matched historical comparisons. Its workload IDs, environment,
and results should be interpreted on those terms. It does not measure browser
layout or paint, native `@mnjs/data`, or Application/state composition.

The separate browser runner exercises representative v5 public APIs in a real
browser:

```sh
node scripts/performance/browser.mjs --profile validation
node scripts/performance/browser.mjs --profile baseline \
  --runner-note "exclusive quiet host; no other builds or tests"
```

The validation profile runs one warmup and two retained samples. It is a bounded
functional check and is always labeled ineligible as a baseline. The baseline
profile runs five warmups and 25 retained samples in headless Chromium. Its
defaults may be inspected or varied with `--browser chromium|firefox|webkit`,
`--headed`, `--samples <count>`, `--warmups <count>`, `--output <path>`, and
`--runner-note <text>`. Any baseline profile override is labeled ineligible for
the canonical baseline comparison. A matching command still requires the operator
to confirm an exclusive quiet-host window; the runner records that note but cannot
prove host isolation.

CI and `npm run verify -- --full` run the validation profile through
`npm run test:browser-performance`. Its public-behavior assertions are required;
timings remain report-only and do not fail a build for being slow.

The initial local desktop samples are retained in
`benchmarks/browser-performance/results/2026-09-09/`, including raw outcomes,
reproduction hashes and the recorded background-activity limitation. They are a
starting point for matched local measurements, not a cross-host performance claim.

The browser fixture covers three bounded workloads in a fixed order:

- Native-data list update, same-position replacement, and reorder with 250 rows.
  It also asserts that an unrelated survivor keeps its View, DOM node, focus,
  selection, and unsaved input value. A layout read and animation-frame boundary
  include browser rendering work in the sample.
- Application startup superseded by restart, followed by successful destruction,
  over 25 cycles. It asserts cancellation, absence of stale start events, and
  consumer-owned lifecycle resource release.
- Forty alternating borrowed/owned state mounts and destructions. A consumer-owned
  external source records subscription removal, owned disposal ordering, late
  callbacks, delegated DOM callbacks, and remaining managed DOM.

The JSON report retains every warmup duration, every raw sample and its observable
outcomes, median/p95/min/max summaries, workload configuration and order, source
commit and dirty state, fixture and built-artifact SHA-256 values, browser version
and mode, Node/npm/Playwright versions, host details, lifecycle monitoring, and
whether accessibility instrumentation was enabled. Source and artifact fingerprints
are captured before launch and verified again after all samples; input drift fails
the run instead of producing a mislabeled report. Each workload has a ten-second
deadline so a stalled browser operation still reaches browser/server cleanup.
The default report path is `test/tmp/performance/browser-report.json`.

These successful teardown observations establish the documented public cleanup
outcomes for the measured operations. They do not establish garbage collection or
heap reachability. No counter, listener set, lifecycle event, or DOM observation is
reported as GC evidence. The separate retention probe below supplies direct reachability observations; timing still has no pass/fail budget.

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

## Direct browser retention evidence

`npm run performance:retention` builds the local packages and runs the bounded
Chromium probe in `benchmarks/browser-performance/retention/workloads.js`.
It performs two warmup batches and six recorded batches, each with 50 cycles of
native CollectionView mutation/render/destruction, replacement Region detach/adopt,
Application cancellation/restart/child teardown, and shared/owned state disposal.
`--cycles` (1–100), `--batches` (1–10) and `--output` can narrow a reproduction;
retain those choices with its result. The default run has a 120-second deadline.

Only consumer-held public objects and roots are tracked with WeakRef. A positive
control must remain reachable while strongly held and disappear after release.
CDP forces collection in separate browser jobs. External data sources and borrowed
Regions remain strongly reachable while destroyed owners are checked; they are
then destroyed/released and checked too. This prevents an unreachable source/owner
cycle from hiding a leaked subscription. Any retained tracked owner, root or
released input fails this finite probe. No framework private member is inspected.

The report retains source/artifact hashes, dirty state, browser and host identity,
counts for each batch, CDP heap usage and DOM counters. Heap sizes are contextual
observations, not portable thresholds. This demonstrates collection for the tested
successful workflows, not universal absence of leaks or support for synchronous
recovery. The runner is maintainer tooling and never enters production imports.

The manual **Browser performance evidence** workflow fixes the runner to
`ubuntu-24.04`, builds once, then runs three sequential baseline blocks with no
concurrent build or test steps. It runs retention after timing and retains all
three raw reports plus the retention report for 90 days, including partial output
on failure. Compare the blocks' medians and p95 values to characterize variance;
do not select the fastest block. The source/artifact hashes must match across
blocks. A fresh hosted job controls our workload scheduling, not the underlying
shared hardware, so persistent variance needs a dedicated runner before setting
performance budgets. This workflow does not run paid agent benchmarks or publish.
