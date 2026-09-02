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
root-plus-subpath consumer scenarios. The public `v1` fixture under
`benchmarks/consumer-bundles/` now measures root-only, `backbone`-only,
`jquery-dom-api`-only, root-plus-`backbone`, root-plus-`jquery-dom-api`, and the
representative root-plus-both-adapters import used by full Backbone/jQuery consumers.
Each entry pins its source digest, public imports, exercised exports, expected module
graph, and external imports. The adjacent reporting contract pins the fixture digest,
current peer set, toolchain, and Brotli quality 11 against the global performance
contract. Rollup tree-shakes each entry and the pinned Terser toolchain
minifies equivalent ESM, CommonJS, and UMD outputs before all 18 results are compressed.
Declared runtime peers remain external. The root-only graph must remain isolated from
both opt-in adapters and their peers.
The current optional Backbone and jQuery peer set is part of fixture `v1`; changing
that set requires an explicit fixture and contract revision rather than retaining
obsolete peers.

A separate three-format regression test bundles only `View`, `CollectionView`, and
`MnObject` from the root entry and verifies that unused Application code is removed.
It protects named-export tree shaking without changing the reporting-only `v1`
scenario inventory before issue #127 adopts consumer-scenario governance.

This first slice is reporting-only. It records exact-base deltas but deliberately has
no consumer-scenario baseline or ceiling, so it cannot approve growth or compensate
for the aggregate package backstop. A later governance change must adopt an explicit
baseline and ceiling for each scenario and format before these measurements become a
hard gate. Removing the fixture, changing its versioned metadata, omitting an output,
bundling a peer, or changing the root-only graph fails closed independently of size.

The Phase 0 baseline never changes. Aggregate package ceiling changes use the
versioned, two-stage amendment protocol described below. Consumer-scenario targets
remain unsupported until issue #127 separately adopts their initial baselines and
ceilings.

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

## Budget amendments

[`config/release/performance-budget-amendments.json`](https://github.com/marionettejs/marionette/blob/master/config/release/performance-budget-amendments.json)
is an append-only governance ledger outside the production package. The ledger
began empty. Its entries are either authorizations with sequential `BA0001`
identifiers or revocations with sequential `BR0001` identifiers. There is no mutable
status field. The active ceiling and entry order derive whether the latest
authorization is pending, consumed, or revoked.

An authorization records only the `aggregate-shipped-package` target, its previous
and proposed ceilings, exact prototype base and head commits, an implementation issue,
the complete positive-delta artifact and new-subpath scope, and exactly one base and
one prototype report. Each evidence file is an immutable wrapper containing
`schemaVersion: 1`, its exact measured `revision`, and the ordinary JSON bundle-size
`report`; the ledger binds that file with its canonical path and SHA-256. The single
approval URL must resolve to a canonical exact-head pull-request comment from a
base-allowed maintainer. Evidence URLs remain durable issue #127 comments from trusted
repository participants. The record also preserves its rationale and rollback
condition.

BA0001 authorized an aggregate-ceiling increase from 51,975 to 52,369
bytes for the exact-base lifecycle-retry and CollectionView `emptyView`
diagnostic prototype tracked by [#226](https://github.com/marionettejs/marionette/issues/226).
The proposal equaled the measured combined prototype total without padding and
added no production subpath. [#224](https://github.com/marionettejs/marionette/pull/224)
consumed that authorization.

BA0002 authorized an aggregate-ceiling increase from 52,369 to 52,565
bytes for readable local validation of malformed CollectionView `emptyView`
classes found during exact-head review of
[#254](https://github.com/marionettejs/marionette/pull/254). The proposal equaled
the reviewed prototype total without padding, adds no production subpath, and
does not include allowance for later Underscore work. #254 consumed that
authorization.

BA0003 authorized an increase from 52,565 to 75,000 bytes as a deliberate
development envelope for the remaining v5 alpha runtime work. Its exact-base
[#134](https://github.com/marionettejs/marionette/issues/134) stack-fallback and
unbound-`getUI` diagnostic prototype proves that the previous ceiling is exhausted
and grows all four main delivery formats, but the proposal
intentionally includes development headroom. The aggregate sums duplicated delivery
formats, so this envelope is a coarse runaway-distribution backstop, not a design
target, feature allocation, or substitute for consumer-bundle evidence. Clean,
maintainable contracts take priority over byte-golfing within it. Exact-base artifact
and graph reports, exact-head growth approval, resource checks, and adopted consumer
scenario budgets remain independent gates. Before beta promotion, the envelope must
be reviewed against the completed core and canonical dependency-inclusive consumer
scenarios; unused headroom does not establish release readiness.
[PR #257](https://github.com/marionettejs/marionette/pull/257) consumed that
authorization.

BA0004 authorized an exact-prototype increase from 75,000 to 75,799
bytes for the remaining production-runtime Application work tracked by
[#190](https://github.com/marionettejs/marionette/issues/190) and
[#191](https://github.com/marionettejs/marionette/issues/191). The measured
prototype completes root View and constructed-versus-borrowed Region ownership
together with lazy Application State composition. It grows only the four existing
main delivery artifacts, adds no production graph edge, external import, package
subpath, stateless allocation proxy, or speculative headroom, and leaves the 18
consumer scenario/format combinations reporting-only.
[PR #352](https://github.com/marionettejs/marionette/pull/352) consumed that
authorization with independent exact-head growth approval.

BA0005 authorizes a pending exact-prototype increase from 75,799 to 78,665
bytes for the DataApi seam tracked by
[#104](https://github.com/marionettejs/marionette/issues/104). The measured
prototype centralizes data lookup, identity, observation, and collection updates
behind a native default and a Backbone adapter. It grows six existing main and
Backbone artifacts, adds no package subpath or external import, leaves the jQuery
adapter artifacts unchanged, and includes no speculative headroom. The later
runtime pull request must consume the authorization from its merged exact base and
obtain independent exact-head artifact-growth and timing-harness approvals.

The approval must come from a different base-allowed maintainer whenever the exact-base
allowlist contains an eligible alternative. If the pull-request author is the sole
allowlisted maintainer, that maintainer may provide the canonical exact-head
attestation so the two-stage protocol remains usable. Adding another allowlisted
maintainer automatically makes distinct approval mandatory.

The approval comment contains only the
`marionette-performance-budget-amendment:v1` marker and canonical JSON. It binds the
action (`authorize` or `revoke`), full pull-request head SHA, entry identifier,
SHA-256 of the canonical complete entry, and its evidence URLs. Missing, stale,
malformed, unrelated, or multiple allowed-maintainer records fail closed. Creating,
editing, or deleting this marked pull-request comment queues the same exact-head
`Bundle size` refresh used by ordinary growth approvals. Editing or deleting a
referenced issue #127 evidence comment routes through the approval's bound
`evidenceUrls` and also refreshes the affected open pull request.

Authorization is the first stage. It may append one record while leaving the active
ceiling unchanged. The exact-base validator derives the committed change set directly
from the separate base and head Git trees. Only
`config/release/performance-budget-amendments.json`, the new record's regular evidence files
under `evidence/performance-budget-amendments/<id>/`, and
`docs/performance-baselines.md` may change. Evidence symlinks, missing or edited report
files, hash or revision mismatches, scope mismatches, unrelated source or workflow
changes, and adding and consuming a record together fail closed. The prototype's
measured aggregate must exceed the previous ceiling without exceeding the proposal.
A proposal may deliberately include documented development headroom; it need not
equal the prototype total. That headroom is shared framework capacity, not reserved
for the prototype issue or evidence that later growth is desirable.
A new runtime artifact also requires a measured new production subpath, matching the
later new-production adoption contract. Every later pull request rechecks each
historical evidence blob against its immutable ledger hash.

Consumption is a later implementation based on the merged authorization. It leaves
the ledger byte-for-byte unchanged and may change the active ceiling only from that
pending record's previous value to its proposed value. Exact-base and current reports
must show the same complete positive-delta artifact and new-subpath scope, with a
current aggregate above the previous ceiling and no greater than the proposal. The
ordinary exact-head growth approval remains independently required for every positive
artifact delta, including changes at or below the usual one-percent threshold.

If a pending implementation is abandoned, a governance-only revocation appends a
record naming that exact authorization. A revocation cannot change the ceiling and may
change only the ledger and this document. Consumed authorizations and revocations stay
in history; neither the Phase 0 record nor earlier entries may be edited, deleted, or
reordered.

The required workflow already invokes the exact-base growth evaluator with both
contracts and reports. That evaluator automatically loads both ledgers and compares
the two committed Git trees, so amendment enforcement does not depend on candidate
workflow arguments. The one-time empty-ledger activation is pinned to base
`154a8bb43f81a1836fcd70c014f4301e750bcb77`: that base cannot validate the new
external ledger, but this activation contains no authorization and changes no ceiling.
Every descendant uses the merged exact-base parser and ledger. This is authority
within the repository's required-workflow trust model, not a claim of cryptographic
protection from repository-administrator rule changes.

The ledger, parser, reports, tests, and documentation are absent from package exports
and the measured production graphs remain byte-for-byte free of them. They add no
production artifact, module, allocation, subscription, or runtime work.

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
checks. The separate consumer-bundle reporting contract pins `@rollup/plugin-terser`
1.0.0 and Terser 5.48.0. It names jQuery as an externalized runtime peer whose
4.0.0 version is pinned by the package manifest and lockfile. CI posts artifact,
cumulative-size, production-graph, and reporting-only consumer-bundle changes through
the repository's read-only workflow plus the separate comment workflow.

Marionette 3.5.1 and 4.1.3 declared Backbone and Underscore as peers; the 4.1.3
Rollup build also externalized Backbone, Underscore, and Backbone.Radio. That history
supports measuring framework cost separately from consumer-owned peers, but does not
dictate the current dependency set. The `v1` fixture externalizes only the package's
current runtime peers, Backbone and jQuery. It resolves Marionette's own public root
and adapter imports to the shipped ESM files so the adapter scenarios still include
their actual package-owned code.

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

A timing-harness-only record also leaves `approvedPaths` empty and binds the
candidate contract to the SHA-256 of the committed harness file:

````markdown
<!-- marionette-performance-growth-approval:v1 -->
```json
{
  "schemaVersion": 1,
  "headSha": "0123456789abcdef0123456789abcdef01234567",
  "issueUrl": "https://github.com/marionettejs/marionette/issues/127",
  "approvedPaths": [],
  "approvedTimingHarnessRevision": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
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
only add runtime artifact and production graph entries. It may also introduce a
well-formed `forbiddenExternalImports` list or add entries to an existing list, but it
cannot remove or replace an existing forbidden import. This is a tightening-only
transition: Phase 0 `baselineExternalImports` remain immutable historical observations,
not current allowlists. A candidate cannot change the base thresholds, allowlist,
baseline, ceiling, forbidden modules, resource contract, or timing workloads. It may
replace only `timing.harnessRevision` when that value is a lowercase SHA-256 matching
the non-executable regular file committed at `scripts/performance/timing.mjs`. That transition always
requires an exact-head approval whose `approvedTimingHarnessRevision` exactly matches;
missing, stale, extra, or mismatched timing revisions fail closed. No caller-selected
path or candidate-owned validator determines the digest. CI loads the evaluator and
allowed-maintainer policy from the exact pull request base, reads the harness blob from
the exact candidate `HEAD`, and obtains the approval record from the pull request's
GitHub comment snapshot rather than a candidate-owned file. A candidate cannot change any
existing artifact or graph. The only permitted toolchain transition is a valid SHA-256
revision at `toolchain.releaseProfile.sha256`; every other toolchain field remains
exact-base, and the candidate report must prove that digest matches the actual
candidate release-profile file. New artifact Phase 0 baselines remain zero, so
their full size counts against the original absolute ceiling; after adoption, the exact
merged artifact becomes the comparison base for later pull requests. Unmeasured graphs,
forbidden modules, removed or renamed base entries, non-integer sizes, report-contract
drift, and cumulative growth above the ceiling fail closed.

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
The bundle tool keeps `forbiddenExternalImports` optional so exact-base contracts from
before this tightening remain valid. When a candidate introduces the field, the
exact-base tool requires a sorted, unique, non-empty string list and
fails every measured production graph that statically or dynamically imports a
listed package or any rooted subpath of it. Similarly prefixed packages are not
matched.

Repository-only performance executables live under `scripts/performance/`; `config/`
contains declarative contracts and schemas. The `scripts/` production-module prefix
keeps every repository-only executable outside shipped production graphs, while
`config/diagnostics/` and `config/release/` cover their declarative support trees.

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
