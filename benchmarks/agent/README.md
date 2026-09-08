# Agent benchmark prototypes and reference application

This directory contains Fieldnotes, a runnable public reference application, thirteen
draft implementation tasks, hidden public-API acceptance cases, known reference
solutions, and a local evaluator. Eleven tasks are proposed as paired-comparable and
two as candidate-only. These classifications have not been verified against a chosen
Phase 0 revision. This is an unscored prototype, not a frozen benchmark or evidence of
agent effectiveness.

No model, permissions profile, paired revisions, counts, budgets, pilot, statistical
procedure, or scored series has been selected. `series-decisions.json` records these
inputs as uncollected. The stable-v5 gates below remain unchanged.

## Task isolation

Each task is metadata validated by `task.schema.json`. Paths are portable,
repository-root-relative paths:

- `promptPath` names the public instructions supplied to the agent.
- `workspacePath` names the original fixture copied into a fresh workspace for one
  attempt.
- `acceptance.hiddenTests` maps each hidden acceptance-test source to a target inside
  the fresh workspace. The harness withholds those sources until the agent has
  finished, then copies them to their targets without overwriting fixture files.
- `acceptance.command` is an argument array that the harness runs without a shell after
  installing the hidden tests, with the fresh workspace as its working directory.

If an acceptance target exists after the attempt, the harness treats the attempt as
incorrect instead of overwriting agent work.

The contract validator and its filesystem-isolation cases run in CI through
`npm run test:agent-benchmark-contract`.

Hidden tests are hidden from the agent during an attempt, not from repository users.
They must remain outside the agent-visible fixture tree in this repository. Every
workspace tree is symlink-free so it cannot expose withheld files indirectly. Every
hidden source must also be distinct from every corpus prompt and every file in every
visible workspace, including through symbolic-link and hard-link aliases. Every attempt
starts from a clean copy, and benchmark fixtures and tests may use only public Marionette
package entrypoints and APIs.

An evaluator may mark an attempt fully correct only when all acceptance checks pass.
An aborted attempt remains an attempted, incorrect run. Architecture violations use
codes from the shared diagnostic catalog and still count when discovered before an
abort.

## Capability coverage

`capabilities.json` is the canonical vocabulary derived from the capability areas in
ROADMAP.md and issue #128. A complete corpus contains at least ten paired-comparable
tasks and exercises every capability through at least two independently scored tasks
across the full candidate corpus. One task may exercise several capabilities, but no
single task certifies a capability. Candidate-only tasks do not count toward the
paired-comparable task floor.

## Evaluation strata

The frozen benchmark profile classifies every task before that task's pilot or scored
runs. The classification and predeclared run count are evaluation inputs; the current
task metadata schema does not infer either one from a prompt or fixture.

- A **paired-comparable** task uses byte-identical prompts, visible workspaces, hidden
  acceptance tests, commands, and evaluator rules against the Phase 0 revision and the
  release candidate. Only the installed Marionette revision differs, and both revisions
  can complete the objective using their public APIs.
- A **candidate-only** task is permitted only when its acceptance criteria necessarily
  exercise an accepted public contract absent from Phase 0. It is not a fallback for a
  weak baseline result. Its classification and run count are frozen after that public
  contract is accepted and before candidate results are collected.

Every task receives at least ten predeclared runs. The Phase 0 pilot powers counts for
the paired-comparable stratum; candidate-only counts are still fixed before collection
and included in the published run, spend, and elapsed-time envelope.

The absolute fully-correct Wilson gate and per-task floor apply to the full candidate
corpus, including both strata. Improvement, McNemar non-regression, and relative
architecture-violation claims use only paired-comparable runs. Candidate-only results
and violations are reported separately and never improve a comparative denominator.

Changes to the pinned model, harness, permissions, paired task artifacts, evaluator,
pairing, classification, or statistical procedure start a new series and require a new
Phase 0 and candidate comparison. Changing a frozen candidate-only task after candidate
collection invalidates the full-corpus candidate result and requires a fresh candidate
evaluation. Results from unlike series are not compared.

The local harness is implemented, but is not frozen for scored collection. Proposed
classifications are planning inputs only. A maintainer must verify both public API
profiles, collect the remaining decisions, and freeze the series before any pilot or
scored attempt. Passing known reference solutions is a tooling control and cannot
substitute for a pilot, baseline, or candidate score.

## Run the prototypes

Use the repository's Node/npm versions, run `npm ci --ignore-scripts`, and build once
with `npm run build`. The evaluator uses jsdom 30.0.1 and the checked-in transitive
lock at `support/dependency-lock.json`. Installation is offline and scripts are
suppressed; if that exact environment is not cached, populate the cache once with
`node scripts/agent-benchmark/cache-environment.mjs` before running the controls.
The packages under test always come from the supplied tarballs or one local pack of
already-built output. No provider or model API is called.

```sh
# Every known solution must pass, independently, in a fresh installed consumer.
node scripts/agent-benchmark/run.mjs reference --output /tmp/agent-reference

# Every unfinished fixture must fail an actual acceptance process.
node scripts/agent-benchmark/run.mjs fixtures --output /tmp/agent-fixtures

# Reuse exact immutable release tarballs; nothing is rebuilt or repacked.
node scripts/agent-benchmark/run.mjs reference \
  --manifest /absolute/candidate/release-evidence.json \
  --output /tmp/agent-candidate-reference

# Filesystem/schema/evaluator unit contracts (offline; no package installs).
node --test test/agent-benchmark/*.test.mjs

# Installed-consumer failure controls, after the reference command above.
node test/agent-benchmark/evaluator-controls.mjs /tmp/agent-reference/nested-workspace

# Runnable application and its three-engine UI check.
node scripts/agent-benchmark/serve.mjs
npm exec -- playwright test --config test/agent-benchmark/playwright.config.mjs
```

The server binds only to `127.0.0.1:4178`; `--port` and `--manifest` are supported.
See [Fieldnotes](app/README.md) for application behavior and ownership.
Use a new output directory for every control run. `artifact-input.json` records the
exact checked package hashes and may be reused with `--manifest`. It is an input
manifest, not a release approval. Each attempt retains its prompt, fixture, package
lock, installed consumer, sealed input hashes, submission hash, and acceptance output.
Reference and unfinished-fixture reports are explicitly `scored: false`.

For an ordinary local **unscored** attempt:

```sh
node scripts/agent-benchmark/run.mjs prepare --task async-panel --output /tmp/agent-attempt
# Work only inside the printed workspace, following PROMPT.md.
node scripts/agent-benchmark/run.mjs evaluate --attempt /tmp/agent-attempt/async-panel
# If the attempt was abandoned instead:
node scripts/agent-benchmark/run.mjs evaluate --attempt /tmp/agent-attempt/async-panel --aborted
```

The evaluator copies the completed submission into a fresh evaluation directory,
installs hidden acceptance files with exclusive creation, runs the frozen command
without a shell, captures output, and deletes that evaluation copy. The original
workspace never receives hidden tests. Occupied hidden targets, links, modified
pinned dependencies, changed task/evaluator inputs, timeout, zero-test exits, and
nonzero exits cannot pass. The successful named cases must exactly match
`evaluator.json`; a passing whole-file wrapper after early process exit is rejected. Evaluation is claimed once with an exclusive lock; results
are never overwritten. A signaled/timed-out or explicitly aborted attempt remains
attempted and incorrect. Catalog findings are deduplicated and retained even on abort.

`acceptancePassed` reports executable outcomes. `fullyCorrect` stays `null` for a
passing submission until an architecture review is supplied to the evaluator API;
failed/aborted attempts are `false`. Architecture review must assess the explicit
role requirements (including Behavior composition), code quality, and shared catalog
rules. No automatic tool here claims to detect every architecture violation.

**This local evaluator is not a security sandbox.** Use it only for trusted local
work and reference controls. Do not give an agent access to the repository root or
this output directory's parent: the public repository contains withheld tests and
solutions. Before scored collection, the selected runner must give each agent only
its isolated workspace and prompt, prevent network/host filesystem access according
to the frozen profile, stop all agent processes before evaluation, and run acceptance
in a separate constrained environment. A fresh directory and reduced child-process
environment alone do not enforce those permissions or resist malicious Node code.

## Corpus inventory

All tasks have a visible starter, explicit input/output requirements, a separate
reference solution, and withheld acceptance. Each is independently evaluated.

| Task | Required outcomes | Proposed stratum |
| --- | --- | --- |
| `nested-workspace` | Nested Region replacement, text safety, emptying, teardown | Paired |
| `nested-notice` | Independent navigation/notice ownership and callback cleanup | Paired |
| `filter-projects` | CollectionView filter/reveal identity and immutable domain data | Paired |
| `rank-projects` | Row/draft preservation, sorting, atomic invalid-input rejection | Paired |
| `save-shortcut` | Host-scoped Behavior shortcut, rerender and cleanup | Paired |
| `connection-status` | Behavior provider subscription and latest-state rerender | Paired |
| `overlay-switch` | Shared Region, valid live Views, external positioning/exclusivity | Paired |
| `overlay-dismiss` | Shared Region dismissal and document-listener cleanup | Paired |
| `async-panel` | Out-of-order completion, invalidation, errors, destroyed owner | Paired |
| `async-session` | Async resource acquisition, stale cleanup, plain-service role | Paired |
| `scoped-message-presenter` | Optional MnObject role, independent borrowed-source listeners | Paired |
| `owned-workspace-state` | Nested Applications and separately owned Application/View state | Candidate only |
| `borrowed-workspace-state` | Nested ownership rejection and borrowed state/domain survival | Candidate only |

The last two tasks necessarily ask for named nested-Application ownership and public
state-source composition. Their proposed candidate-only status must still be checked
against the selected Phase 0 public API. The other tasks specify outcomes achievable
through longstanding Views, Regions, Behaviors, collection ownership, and application
code. A poor baseline result never permits reclassification.

`loadCorpus` validates the task isolation contract, proposed paired floor, and at
least two independent tasks for every capability in `capabilities.json`. This proves
metadata coverage; the acceptance/control runs establish the actual case behavior.
None of these checks establishes sample size, statistical power, agent productivity,
or stable release readiness.
