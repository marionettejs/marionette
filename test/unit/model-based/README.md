# Public operation models and mutation evidence

The models compare public library behavior against small consumer-owned state: ordered child IDs, ownership, visibility, destroyed state, and DOM identity. They never inspect framework private fields or call private methods. CollectionView commands cover append/indexed insert, remove, detach/reinsert, swap, filtering, and terminal destruction. Region commands cover two owners, adoption after detach, replacement placeholders, repeated show, conflicting ownership, empty, and View/Region destruction in attached and detached trees.

Application commands keep only the owner's and children's stable running state,
terminal destruction, and registration order. Each async command performs a
bounded interaction with an explicitly held consumer readiness Promise: compatible
repeated calls, superseded startup, adopted stop, current readiness rejection,
opposing child operations, or terminal teardown. Generated flags settle canceled
startup before or after its replacement and resolve or reject its obsolete
readiness. Assertions cover exact Promise identity/results, signal abort ordering,
original adopted stop options/context, no stale completion events, and ownership.
Registration and removal commands compose these interactions across a sequence.
Destruction is available after eight completed commands so terminal no-ops do not
dominate the generated cases. Each wait permits at most 100 microtask turns and
fails visibly if the bounded consumer workflow does not progress; no wall clock or
timer scheduling is used.

This is deliberately a model of bounded interactions, not an exhaustive operation
state machine or arbitrary scheduler. Direct child supersession targets the first
child; the explicit `application-child-lifecycle.spec.js` tests cover partially
completed sibling prefixes, completion-handler reentry, and canceled child-stop
suffixes. Existing `application-lifecycle.spec.js` tests cover failure/retry at the
other readiness phases. No synchronous rollback or attempt-all cleanup contract is
introduced.

`../provider-acceptance.spec.js` checks shared list/detail consumers for native
data, Backbone, and actors, plus explicit refresh for static sources. It preserves
provider distinctions: native `move`, Backbone `sort`, and actor selection changes
retain survivors; plain rendering and collection reset do not promise retained
children. Destroying one consumer leaves survivors usable and releases its own
notifications. The authoritative provider-to-test mapping belongs in
`config/api-contracts/semantics.json`, alongside the remaining public contracts.

Indexed insertion runs with filtering disabled because the documented numeric-index API bypasses filtering. The model does not invent a different contract. Ownership acquisition is weighted three times so generated sequences exercise live owners before terminal destruction. Generation uses `size: 'max'` within a fixed command cap; increasing the cap really exercises longer sequences. Command preconditions skip operations that do not apply to the current model.

## Bounded checks and replay

Run `npm run test:model` (or `npx vitest run test/unit/model-based`). The PR default is seed **20260908**, **75 cases per property**, and at most **40 generated commands per case**. There are four properties plus deterministic public regressions. No clocks, network calls, or random external data are involved. Each case destroys its owners and removes its DOM fixtures.

An optional longer local run:

```sh
MARIONETTE_MODEL_SEED=20260909 MARIONETTE_MODEL_RUNS=1000 MARIONETTE_MODEL_STEPS=100 npm run test:model
```

Fast-check reports the seed, path, shrunk command sequence, and a separate command replayPath. Preserve all three replay values and target the failing property. For example, the Region ownership defect discovered by this model (#469) shrank to five commands:

```sh
MARIONETTE_MODEL_SEED=20260908 \
MARIONETTE_MODEL_PATH='34:3:3:7:10:11' \
MARIONETTE_MODEL_REPLAY_PATH='ACEAETg:VB' \
npx vitest run test/unit/model-based/region.spec.js -t 'attached=false'
```

Replay uses the original run/step limits and generator version. Changing command order, weighting, or the fast-check version can change replay values. Keep a small explicit public regression after fixing a discovered defect. Environment inputs fail closed when invalid; runs are capped at 10,000 and commands at 1,000 for intentional local exploration. These caps are not the PR defaults.

## Bounded mutation pilot

Run `npm run test:mutation` (or `node scripts/testing/mutation.mjs`). The runner reads `config/mutation.json`: two workers, a ten-minute process-group budget including forced cleanup, targeted Region ownership/restoration/teardown methods, and successful subscription binding and release. Source method ranges are resolved from the TypeScript syntax tree and fail if a named method disappears or becomes ambiguous. They are mutation selection metadata, not private APIs called by tests.

Stryker executes the selected public contract suites and models. It does not mutate the entire library by default. Keep the PR models in normal unit validation; run the mutation pilot manually or in an optional dedicated CI lane. Do not replace the normal unit, browser, artifact, or release checks with this pilot.

Every invocation creates its own `coverage/mutation/<timestamp>-<pid>/` directory containing source/test/config/lock hashes, commit and dirty-worktree provenance, a run log, JSON mutation report, HTML report, and a machine-readable summary. Failed baselines and deadlines return a nonzero exit code and preserve partial evidence; a missing report is not a successful or zero-mutant result. Sandbox paths under `test/tmp/mutation/` are unique per invocation. Always upload `coverage/mutation/**` in the optional CI lane, including failed runs. Reports and generated sandboxes are ignored by Git.

The summary keeps Killed, Survived, NoCoverage, Timeout, CompileError, RuntimeError, Ignored, and Pending separate. A timeout counts as detected in Stryker's score, but remains visible for investigation. Compile errors, runtime errors or pending mutants make the run incomplete. No hard score threshold or score-driven mutation exclusions are configured. Investigate survivors against accepted public contracts, add regressions for meaningful gaps, and document equivalent or unreachable cases rather than asserting internals or inventing recovery behavior to improve a percentage. Follow the [synchronous failure boundary](../../../docs/view.lifecycle.md#synchronous-failures): mutation coverage does not authorize rollback, attempt-all cleanup, recovery bookkeeping, or guards for unsupported callback mutation.

The ownership model exposed #469: destroying a previously detached/adopted View
incorrectly restored its old Region over the new replacement. The retained fix
releases the former Region's restoration listener. The public detached/adoption
regressions remain part of the selected suite.

Earlier pilot reports included rollback and attempt-all cleanup code/tests rejected
by the PR #470 scope correction. Their scores and survivor classifications do not
describe the corrected source or test contract and must not be used as current
candidate evidence. Historical reports remain at their recorded paths, including
`coverage/mutation/2026-09-08T13-08-38-131Z-44336/`.

The corrected pilot at clean commit `38b68747` completed in 92.8 seconds:
65 killed, two survived and one NoCoverage out of 68 mutants (95.59%); no timeout,
compile error, runtime error or pending result. Exact evidence is retained in
`coverage/mutation/2026-09-08T15-06-52-525Z-78917/`, including the package and coverage
configuration hashes. This is bounded Region/subscription evidence, not full
release certification or a measured agent-development result.

- Region mutants 44 and 45 remove the absent-current-View restoration guard or
  its body. Ordinary ownership restores the placeholder before clearing the View;
  this is the same unreachable state documented in `config/coverage-exceptions.json`.
- Region mutant 47 replaces `before:destroy` with an empty event name in `off`.
  The public Events API treats that as all event names for the supplied callback
  and context. The restoration callback is registered only for `before:destroy`,
  so this mutation is equivalent for the supported workflow.

No private probes, recovery contracts, or mutation exclusions were added for
these cases. Rerun the pilot when its recorded source/test/config inputs change.

The current selection is Region ownership/restoration/destruction plus successful
subscription binding and release in `src/utils/subscribe-bindings.ts`. The removed
cleanup helper is not a mutation target. The per-mutant allowance remains ten
seconds plus Stryker's measured baseline allowance, within the ten-minute outer
budget. These bounds make the run repeatable; they do not establish mutation
resistance for the whole library.

References: [fast-check model and replay guidance](https://fast-check.dev/docs/advanced/model-based-testing/), [Stryker Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/), [Stryker configuration](https://stryker-mutator.io/docs/stryker-js/configuration/).
