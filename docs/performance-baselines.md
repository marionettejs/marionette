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

That single-checkout command validates the current artifacts, lifecycle scenarios,
and absolute budgets, but it cannot reproduce a base-relative resource regression by
itself. Use the pull request report or the exact base/current sequence in
`.github/workflows/ci.yml` when debugging a monotonic-comparison failure.

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

The same command measures the built runtime's own-property and reference shapes for
unused View, Region, Behavior, and CollectionView instances. It records eager arrays,
plain objects, ChildViewContainers, Regions, event registrations, and listening
ledgers without pretending those allocations are already pay-for-play. Repeated
lifecycle scenarios prove public behavior while recording Region detach cleanup and
1,000 CollectionView and Behavior mount/destroy cycles. A destroyed Behavior and its
destroyed host currently retain each other inside the otherwise released graph; the
baseline records that collectible internal cycle instead of falsely claiming those
two objects are emptied. These measurements are structural ownership proxies. They
detect eager containers, listener ownership, managed DOM cleanup, and known internal
cycles deterministically; they are not heap-size, reachability, leak-detector, or
garbage-collector proof.

## Pull request comparison

The required `Bundle size` check builds the pull request and the exact
`github.event.pull_request.base.sha`. When that base contains
`config/performance.json`, CI uses that exact file as the authority for measuring
both builds, and it executes the exact base revision of the validator to enforce
the pull request's artifacts, cumulative ceiling,
production subpaths, and forbidden module roots. A pull request therefore cannot
weaken enforcement by editing its own contract. This first bootstrap change is the
only exception: because its base predates the contract, CI falls back to the current
contract. After the bootstrap merges, the fallback is unreachable for ordinary
descendant pull requests. Reports call out missing artifacts, untracked `.js`,
`.cjs`, or `.mjs` files, and new or unmeasurable subpaths explicitly.

Allocation and retention observations are compared monotonically with the exact pull
request base. New own properties, reference-backed storage, containers, registrations,
listener owners, managed DOM, or retained framework entries fail the existing required
`Bundle size` check. Removed storage and lower retention pass and remain visible as
improvements in the report. Missing metrics, unknown metrics, incompatible schemas,
and reduced lifecycle workloads fail closed. The validator also verifies the public
Region, CollectionView, and Behavior scenarios so a broken or vacuous all-zero probe
cannot appear to be an improvement.

This comparator has one explicit bootstrap exception: its immediate base contains the
recorded resource shapes but predates the comparator module. CI therefore uses the
reviewed pull request validator to measure both exact builds only when the pull request
base is the pinned resource-bootstrap commit `25f3739`. The earlier performance-
contract bootstrap is likewise pinned to its reviewed base `31151c9`; any other base
missing either authority fails closed. Every descendant uses the exact base revision
of both the validator and resource probe. The active strict required-status-check
policy prevents a stale pre-bootstrap branch from merging without updating to the
protected base.

The current contract is also validated independently so intentional contract and
toolchain edits remain internally coherent. Its pinned release profile records Node
24.19.0, npm 11.17.0, lockfile v3, Ubuntu 24.04 linux-x64, Rollup 4.63.0, jsdom
30.0.1, Backbone 1.4.0, and the commands that reproduce deterministic and hosted
checks. CI posts artifact, cumulative-size, and production-graph changes through
the repository's read-only workflow plus the separate comment workflow.

The roadmap also requires explicit issue approval and evidence for growth above one
percent versus the pull request base and for every new production subpath. The
resource comparator does not invent a weak convention that agents could satisfy
themselves. A separate follow-up must define an exact-head, maintainer-authored
approval record and make the check validate that record before these cases can merge.

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

Hosted results never decide merge or release eligibility. A separate follow-up must
name the controlled machine, pin its CPU, operating system and kernel, architecture,
power state, isolation policy, and harness revision, record the initial timing
baseline, and enforce the roadmap's independently repeated five-percent median and
ten-percent p95 release limits. Immutable release evidence must consume that
exact-source report; until then `controlledRunner.status` remains `pending-pr-b`.

## Runtime boundary

The package exports and `files` allowlist are unchanged. Performance configuration,
tests, and benchmarks live outside `dist/`, and the production-graph check makes that
zero-runtime-overhead boundary executable.

## Ownership and enforcement

CODEOWNERS assigns the contract, resource probe, harness, focused tests, and
performance workflows to the project maintainer and core team. Current live repository
rules do not require a CODEOWNER approval, so ownership is review routing rather than
an automated merge gate. The exact-base authority contract is the automated
anti-relaxation guard after this bootstrap; the greater-than-one-percent approval
protocol and controlled timing runner remain separate follow-ups.
