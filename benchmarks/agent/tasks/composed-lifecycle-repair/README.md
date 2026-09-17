# Composed lifecycle repair and handoff prototype

Follow-up to [#539](https://github.com/marionettejs/marionette/issues/539).
Development/test tooling only: no production imports, new framework APIs, or
TypeSafe runtime dependency. This is a headless review-session controller with
an editable draft, not a claim to have migrated a browser application.

## Existing coverage and the missing question

| Existing material | Reused behavioral evidence | Missing composition |
| --- | --- | --- |
| `async-panel` | Latest request, stale completion, load errors, teardown | Application preparation across two awaits and a newer run |
| `async-session` | Stale async acquisition and resource disposal | Resources preserved through rejected stop permission |
| `owned-workspace-state`, `borrowed-workspace-state` | Readiness, child ownership, state identity and survival | Working session repaired without converting shared state to owned state |
| `rank-projects`, Fieldnotes | Edited DOM/row identity; filtering, saves, overlays and browser focus | No Application load/validate/stop workflow in Fieldnotes |
| `docs/application-effects.md`, `docs/application-refresh.md` and installed fixtures | Cancellation, active scopes, rejected stop, timer cleanup, latest-request ownership | No independent repair attempt combining these behaviors |

Keep those tasks and browser checks. This task adds one working implementation
with three seeded defects: missing post-validation cancellation, disposal before
stop permission succeeds, and ownership of externally shared state. It passes
normal startup/edit/refresh behavior; repair must preserve that behavior. The
reference uses the existing public API and a local request controller, not a
proposed resource API. Acceptance requires effects and results, not that structure.

The twelve named acceptance cases cover repeated stop/start resource cycles,
non-cooperative loading/validation, old results after a newer start, obsolete
errors, refresh during pending/rejected stop, adopted stop during destruction,
start superseding pending stop, replacement load/validation failure and retry,
and borrowed-source survival. Providers and
registrations are controlled in memory. No timing sleeps, actual intervals,
network service, DOM or focus assumptions are part of this task. Each case has a
bounded timeout so broken submissions cannot hang evaluation indefinitely.

## Qualify before attempting

Use the commands in the [corpus README](../../README.md), with a fresh output
folder for each run and the same exact package manifest. Run these commands from
the repository root:

```sh
node scripts/agent-benchmark/run.mjs reference --task composed-lifecycle-repair \
  --manifest /absolute/candidate/release-evidence.json --output /tmp/composed-reference
node scripts/agent-benchmark/run.mjs fixtures --task composed-lifecycle-repair \
  --manifest /tmp/composed-reference/artifacts/artifact-input.json --output /tmp/composed-starter
node test/agent-benchmark/composed-lifecycle-controls.mjs \
  /tmp/composed-reference/composed-lifecycle-repair /tmp/composed-controls
```

The third command retains twelve independent installed-consumer records: the seeded
starter, two correct implementations (replacing or retaining registrations) and nine
single-defect controls. It verifies the exact named failures, including which preservation cases still pass. A fixture merely exiting nonzero is
insufficient qualification. All records have `scored: false`; known-solution success
is not evidence of agent usability. These controls are outside visible workspaces.

## Independent repair and later handoff

Use this task as a fresh-agent repair of supplied code. Do not supply the original
author's reasoning, reference, withheld tests, or control variants. An actual
fresh-agent attempt is still uncollected. A different task/thread alone does not
isolate the filesystem: the current local evaluator is not a sandbox.

For a later successive-change/handoff pilot:

1. Freeze the exact candidate tarballs, updated public docs, starter, prompt,
   acceptance and runner profile under the [evaluation plan](../../evaluation-plan.md).
   Authorize model/version, permissions, count, spend/time and assistance limits.
2. Give agent A only the declared prompt, installed workspace and public docs under
   enforced filesystem/network isolation. Stop its processes before acceptance.
   Retain its submission, trace, failures, commands, costs and interventions.
3. Independently evaluate all twelve cases. Preserve unsuccessful attempts; do not
   substitute the reference and call the outcome a successful agent handoff.
4. A separate fresh agent B may repair A's actual submission with the same contract
   and only the feedback declared in the frozen policy. Pin that submission's hash
   as B's starter, record how it was selected, and freeze the handoff before B runs.
   Retain A's failures in the report even when B succeeds. If A already passes,
   select a separately specified change task before collection; do not invent a
   defect after observing a score. This local CLI does not implement that handoff
   packaging or sandbox yet.

Report behavior per case and distinguish framework, documentation, harness and
agent errors with reproducible evidence. Failures of valid userland designs can
inform #136 only after independent implementation/repair attempts establish a
recurring problem. AI model judgments cannot override executable outcomes. Browser
editing/focus acceptance, migration evidence, paid runs, release policy and
stabilization remain separate work; this prototype does not close the release gate.
