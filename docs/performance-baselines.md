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
with Brotli quality 11. The immutable Phase 0 total is 49,500 bytes. The initial
aggregate shipped-package ceiling is 51,975 bytes, exactly five percent above that
baseline. This aggregate is a distribution-footprint backstop across supported
delivery formats, not the payload loaded by one application. Package entrypoints and
every JavaScript file shipped from `dist/` must be classified by the contract, so a
new artifact cannot silently avoid the aggregate budget.

The roadmap also requires versioned root-only, opt-in-subpath-only, and
root-plus-subpath consumer scenarios. Each scenario must record its own Brotli-11
baseline and ceiling before adoption; those scenario limits and the aggregate package
backstop are independent hard gates. These fixtures are not implemented yet and remain
tracked by issue #127, so the current command enforces only the aggregate package
backstop and per-artifact comparison described below.

The Phase 0 baseline never changes. Before the initial package ceiling or a future
consumer-scenario ceiling can change, issue #127 must implement a versioned two-stage
amendment protocol: a governance change records exact prototype and scenario evidence,
then a later runtime implementation may consume that authorization. A runtime change
cannot raise its own ceiling.

The same command asks Rollup for the actual internal modules and external imports of
`.`, `./backbone`, and `./jquery-dom-api`. It records graph changes and fails if test,
documentation, benchmark, release, or diagnostic tooling enters a production graph.
Each graph output must be exported by that exact package subpath and have one unique
Rollup producer with the single declared input, so the measured graph is the shipped graph.
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
percent versus the pull request base and for every new production subpath. Existing
artifact growth now has a versioned, base-owned approval contract in
`pullRequestGrowthApproval`. The same exact-head record can bind a new production
subpath to every new runtime artifact and its full measured Brotli size.

An approval is one complete pull request timeline comment. The comment author comes
from GitHub rather than the JSON body, must appear in the exact-base allowlist, must
have GitHub's `OWNER`, `MEMBER`, or `COLLABORATOR` association, and must use this
canonical form:

````markdown
<!-- marionette-performance-growth-approval:v1 -->
```json
{
  "schemaVersion": 1,
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "issueUrl": "https://github.com/marionettejs/marionette/issues/127",
  "approvedPaths": [
    "dist/marionette.js"
  ],
  "evidenceUrls": [
    "https://github.com/marionettejs/marionette/issues/127#issuecomment-123456789"
  ]
}
```
````

A new-subpath-only record leaves `approvedPaths` empty and adds both new-production
fields:

````markdown
<!-- marionette-performance-growth-approval:v1 -->
```json
{
  "schemaVersion": 1,
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "issueUrl": "https://github.com/marionettejs/marionette/issues/127",
  "approvedPaths": [],
  "approvedNewSubpaths": [
    "./example"
  ],
  "approvedNewArtifacts": [
    {
      "path": "dist/example.js",
      "size": 456
    }
  ],
  "evidenceUrls": [
    "https://github.com/marionettejs/marionette/issues/127#issuecomment-123456789"
  ]
}
```
````

`approvedNewArtifacts` is empty when a new public subpath aliases an already tracked
runtime artifact. The new subpath still requires exact-head approval even though it
adds zero artifact bytes. Conversely, a new runtime artifact without a corresponding
new production subpath is invalid rather than independently approvable. Approval binds
the complete additive artifact set from the same exact head; conditional artifacts such
as CommonJS outputs need not each be the selected production-graph output, but every
artifact is named at full size and charged against the cumulative ceiling.

The full lowercase head SHA prevents an approval from surviving a code change. The
approved path list must exactly match all existing artifacts above the strict
greater-than-one-percent threshold. New subpaths and new artifact path/size pairs must
exactly match the additive candidate contract and measured report. A candidate may
only add runtime artifact and production graph entries: it cannot change the base
thresholds, allowlist, baseline, ceiling, toolchain, forbidden modules, resource
contract, timing contract, or any existing artifact or graph. New artifact Phase 0
baselines remain zero, so their full size counts against the original absolute ceiling;
after adoption, the exact merged artifact becomes the comparison base for later pull
requests. Unmeasured graphs, forbidden modules, removed or renamed base entries,
non-integer sizes, report-contract drift, and cumulative growth above the ceiling fail
closed.

Evidence is limited to durable issue-comment
permalinks in this repository; Actions artifacts and external mutable pages cannot
be the sole record. The evaluator binds each marked comment to the expected repository
and pull request from the API snapshot, and every evidence URL must resolve to a real
`OWNER`, `MEMBER`, or `COLLABORATOR` comment in the configured tracking issue snapshot.
Unauthorized, stale, and ordinary comments do not approve anything. Multiple
exact-head approvals, malformed trusted records without a valid replacement, missing
paths, extra paths, and noncanonical JSON fail the evaluator.

The required `Bundle size` job collects read-only snapshots of the pull request
timeline and issue #127 comments. It then invokes the approval evaluator from the
exact base checkout with the exact-base threshold and allowlist. The evaluator emits
one structured result that drives both the report and exit status, so candidate edits
cannot lower the threshold, add an approver, replace the parser, or make output disagree
with enforcement. GitHub comment bodies remain JSON data and are never evaluated or
interpolated by the shell.

Approval comment creation, editing, and deletion automatically queues a re-run of the
completed exact-head `Bundle size` job. Changes to evidence comments on issue #127 do
the same for every open pull request whose approval references the changed comment.
GitHub delivers comment events asynchronously, so do not merge until the `Performance
approval refresh` workflow and resulting `Bundle size` re-run finish. A code push
changes the head SHA and invalidates the previous approval automatically. If comment
collection is unavailable when approval is required, the job fails closed; a pull
request with no existing artifact above the threshold does not require comment
availability.

The refresh workflow selects only a CI run whose immutable run name records the
current pull request number, base SHA, and head SHA. If the base advances, it refuses
to replay an older comparison. The default-branch rules require strict up-to-date
status checks, so merge remains blocked until CI records the new exact base.

The exact-base bundle tool measures the current checkout against its candidate
performance contract, while the exact-base evaluator validates that contract as an
additive change to the authority contract. New-subpath results carry
`newProductionEnforced: true`; every new public subpath and its complete new artifact
cost therefore require an exact-head approval record. The threshold, approver policy,
parser, contract validator, and evaluator all come from the pull request's exact base,
so the first enforcement change cannot authorize itself with candidate-owned policy.

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

CODEOWNERS assigns the contract, growth-approval parser, resource probe, harness,
focused tests, and performance workflows to the project maintainer and core team.
Current live repository rules do not require a CODEOWNER approval, so ownership is
review routing rather than an automated merge gate. The exact-base authority contract
is the automated anti-relaxation guard. The controlled timing runner remains a
separate follow-up.
