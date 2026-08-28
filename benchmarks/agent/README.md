# Agent benchmark task contract

This directory defines the repository-owned contract for Marionette's public agent
benchmark tasks. It does not contain a corpus, benchmark profile, evaluator results,
or a Phase 0 baseline yet.

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

The initial contract deliberately does not select a model or harness, classify real
tasks, set run counts or budgets, define a fallback, or claim benchmark completeness.
Those decisions and the corpus, profile, evaluator, pilot, results, and rerun
instructions are separate follow-up evidence.
