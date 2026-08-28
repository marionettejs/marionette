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
attempt starts from a clean copy, and benchmark fixtures and tests may use only public
Marionette package entrypoints and APIs.

An evaluator may mark an attempt fully correct only when all acceptance checks pass.
An aborted attempt remains an attempted, incorrect run. Architecture violations use
codes from the shared diagnostic catalog and still count when discovered before an
abort.

## Capability coverage

`capabilities.json` is the canonical vocabulary derived from the capability areas in
ROADMAP.md and issue #128. A complete corpus contains at least ten real tasks and
exercises every capability through at least two independently scored tasks. One task
may exercise several capabilities, but no single task certifies a capability.

The initial contract deliberately does not select a model or harness, set run counts
or budgets, define a fallback, or claim benchmark completeness. Those decisions and
the corpus, profile, evaluator, pilot, results, and rerun instructions are separate
follow-up evidence.
