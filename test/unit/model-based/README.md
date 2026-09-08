# Public operation models and mutation evidence

The models compare public library behavior against small consumer-owned state: ordered child IDs, ownership, visibility, destroyed state, and DOM identity. They never inspect framework private fields or call private methods. CollectionView commands cover append/indexed insert, remove, detach/reinsert, swap, filtering, and terminal destruction. Region commands cover two owners, adoption after detach, replacement placeholders, repeated show, conflicting ownership, empty, and View/Region destruction in attached and detached trees.

Indexed insertion runs with filtering disabled because the documented numeric-index API bypasses filtering. The model does not invent a different contract. Ownership acquisition is weighted three times so generated sequences exercise live owners before terminal destruction. Generation uses `size: 'max'` within a fixed command cap; increasing the cap really exercises longer sequences. Command preconditions skip operations that do not apply to the current model.

## Bounded checks and replay

Run `npm run test:model` (or `npx vitest run test/unit/model-based`). The PR default is seed **20260908**, **75 cases per property**, and at most **40 generated commands per case**. There are three properties plus deterministic public regressions. No clocks, network calls, random external data, or shared owners are involved. Each case destroys its owners and removes its DOM fixtures.

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

Run `npm run test:mutation` (or `node scripts/testing/mutation.mjs`). The runner reads `config/mutation.json`: two workers, a ten-minute process-group budget including forced cleanup, targeted Region ownership/restoration/teardown methods, subscription setup rollback, and exhaustive subscription cleanup. Source method ranges are resolved from the TypeScript syntax tree and fail if a named method disappears or becomes ambiguous. They are mutation selection metadata, not private APIs called by tests.

Stryker executes the selected public contract suites and models. It does not mutate the entire library by default. Keep the PR models in normal unit validation; run the mutation pilot manually or in an optional dedicated CI lane. Do not replace the normal unit, browser, artifact, or release checks with this pilot.

Every invocation creates its own `coverage/mutation/<timestamp>-<pid>/` directory containing source/test/config/lock hashes, commit and dirty-worktree provenance, a run log, JSON mutation report, HTML report, and a machine-readable summary. Failed baselines and deadlines return a nonzero exit code and preserve partial evidence; a missing report is not a successful or zero-mutant result. Sandbox paths under `test/tmp/mutation/` are unique per invocation. Always upload `coverage/mutation/**` in the optional CI lane, including failed runs. Reports and generated sandboxes are ignored by Git.

The summary keeps Killed, Survived, NoCoverage, Timeout, CompileError, RuntimeError, Ignored, and Pending separate. A timeout counts as detected in Stryker's score, but remains visible for investigation. Runtime errors or pending mutants make the run incomplete. No hard score threshold or score-driven mutation exclusions are configured. Investigate survivors against public contracts, add regressions for meaningful gaps, and document equivalent or unreachable cases rather than asserting internals to improve a percentage.

The initial pilot targeted Region.show/destroy and the two subscription helpers: **85 mutants, 72 killed, 6 survived, 7 uncovered (84.71%)**, completed in 94 seconds. Investigation found that the selected lane omitted existing rollback tests; adding `delegate-entity-events.spec.js` restored those contracts. New public regressions assert Region-owned listener teardown and useful conflicting-ownership diagnostics. The stronger model separately exposed #469: destroying a previously detached/adopted View incorrectly restored its old Region's new replacement. The final target list also includes restoration so that defect is measured. The initial and expanded scopes must not be compared as identical denominators.

The final measured pilot ran **196 public tests**, then **97 mutants: 94 killed, 2 survived, 1 uncovered, no timeouts or errors (96.91%)**, in 75 seconds. It also added a public regression preserving the first of multiple cleanup failures while attempting every registration exactly once. Both subscription helpers now have every selected mutant killed. The retained Region cases are the defensive missing-currentView restoration guard (one survivor and one uncovered mutation) and an apparently equivalent event-name mutation: removing the same callback/context across all names removes the same registration currently made only for `before:destroy`. Neither case is excluded or tested through private state. These are bounded findings, not a proof that the entire library resists mutation.

An intermediate run reported four timeouts under machine contention. The final per-mutant allowance is ten seconds plus Stryker's measured baseline allowance; the ten-minute outer budget remains fixed. All four mutations were then killed by assertions. The final local evidence directory was `coverage/mutation/2026-09-08T13-08-38-131Z-44336/`; reports are generated artifacts, not committed fixtures. Repeat the pilot on the integrated branch and retain that run's provenance rather than treating these historical results as current release evidence.

References: [fast-check model and replay guidance](https://fast-check.dev/docs/advanced/model-based-testing/), [Stryker Vitest runner](https://stryker-mutator.io/docs/stryker-js/vitest-runner/), [Stryker configuration](https://stryker-mutator.io/docs/stryker-js/configuration/).
