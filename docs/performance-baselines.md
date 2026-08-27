# Phase 0 performance baselines

Marionette records deterministic production-cost evidence without importing
benchmark or validation code from a production entrypoint. The machine-readable
contract is
[`config/performance.json`](https://github.com/marionettejs/marionette/blob/master/config/performance.json).

## Deterministic contract

Run the blocking local check with the pinned source profile:

```sh
npm run check:release-profile
npm ci
npm run size
```

The check builds the package and measures every shipped runtime JavaScript artifact
with Brotli quality 11. The Phase 0 total is 49,500 bytes and the fixed cumulative
ceiling is 51,975 bytes, exactly five percent above that baseline. Package entrypoints
and every JavaScript file shipped from `dist/` must be classified by the contract, so
a new artifact cannot silently avoid the cumulative budget.

The same command asks Rollup for the actual internal modules and external imports of
`.`, `./backbone`, and `./jquery-dom-api`. It records graph changes and fails if test,
documentation, benchmark, release, or diagnostic tooling enters a production graph.
The Phase 0 module lists remain fixed evidence; ordinary source-module refactors are
reported rather than prohibited when the resulting graph remains clean.

Unit tests record both the own-property shape and the current eager allocation
categories of unused View, Region, Behavior, and CollectionView instances. That
baseline includes the empty arrays, objects, ChildViewContainers, event maps, and
CollectionView empty Region that v5 currently creates; it records the current cost
without pretending those allocations are already pay-for-play. Repeated lifecycle
checks prove that Region registrations are removed after 100 detach cycles and that
long-lived DOM, model, and collection owners return to their original event counts
after every one of 1,000 mount/destroy cycles. A destroyed Behavior and its destroyed
host currently retain each other inside the otherwise released graph; the baseline
records that collectible internal cycle instead of falsely claiming those two
objects are emptied. These are deterministic ownership checks, not noisy heap-size
or garbage-collector measurements.

## Pull request comparison

The required `Bundle size` check builds the pull request and the exact
`github.event.pull_request.base.sha`. It posts artifact, cumulative-size, and
production-graph changes through the repository's read-only CI plus separate
comment workflow.

The roadmap also requires explicit issue approval and evidence for growth above one
percent versus the pull request base and for every new production subpath. This PR A
does not invent a weak convention that agents could satisfy themselves. PR B must
define an exact-head, maintainer-authored approval record and make the check validate
that record before these cases can merge.

## Hosted timing

Run the reporting harness with:

```sh
npm run performance:timing
```

The harness uses built `dist`, the locked jsdom and Backbone dependencies, fixed
warmup/sample counts, and batched `process.hrtime.bigint()` measurements. It covers
View construction/destruction, rendering/rerendering, delegation, Behavior-backed
delegation, Region show/empty, and ordinary CollectionView rendering and mutation.
CI runs the base and pull request on the same Ubuntu hosted worker and reports median
and p95 changes. A change above ten percent is a warning only because shared-runner
timing is noisy.

Hosted results never decide merge or release eligibility. PR B must name the
controlled machine, pin its CPU, operating system and kernel, architecture, power
state, isolation policy, and harness revision, record the initial timing baseline,
and enforce the roadmap's independently repeated five-percent median and ten-percent
p95 release limits. Immutable release evidence must consume that exact-source report;
until then `controlledRunner.status` remains `pending-pr-b`.

## Runtime boundary

The package exports and `files` allowlist are unchanged. Performance configuration,
tests, and benchmarks live outside `dist/`, and the production-graph check makes that
zero-runtime-overhead boundary executable.
