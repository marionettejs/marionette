# Testing Marionette

Tests protect public contracts. Source folders describe implementation; test
folders describe the behavior a consumer can rely on. New tests should use a
shallow contract-oriented suite and explicit imports, fixtures, and cleanup.
Do not move a regression merely to match an internal refactor.

## Choose the smallest useful check

| Contract | Location | Command |
| --- | --- | --- |
| Public runtime behavior | `unit/` | `npm test -- test/unit/region-lifecycle.spec.js` |
| Pure events, Radio, utilities and data | Vitest Node project | `npm test -- --project=node` |
| DOM and lifecycle behavior | Vitest DOM project | `npm test -- --project=dom` |
| Real focus, events, DOM adapters and package behavior | `browser/` | `npm run test:browser -- --project=chromium -g 'focus'` |
| ESM and CommonJS declaration consumers | `types/` | `npm run build && npm run test:types` |
| Installed ESM/CJS/Vite/TypeScript and executable docs | `fixtures/` | `npm run test:fixtures -- --fixture esm-node` |
| CLI, release, docs, performance and benchmark infrastructure | `tooling/`, `release/`, `docs/`, `performance/`, `agent-benchmark/` | `npm run test:tooling` |
| Static production import graph | `source/` | `npm run test:source` |
| Built ESM/CJS/UMD exports | `dist/` | `npm run test:dist` |

`npm ci` uses the pinned toolchain and builds packages through `prepare`. `npm test`
is deliberately fast: it runs unit tests without a hidden type/build pretest.
After source edits, rebuild before directly invoking consumer types, browser or
distribution checks. `npm run verify` rebuilds and checks lint/types/unit contracts;
`npm run verify -- --full` adds both coverage reports, source/distribution checks,
real browsers, documentation checks, and every installed fixture.
`--full` also warms the pinned agent environment and runs the reference app plus
positive/negative corpus controls. They can be invoked separately with
`agent:cache`, `test:agent-app`, `agent:reference`, and `agent:fixtures`. These
commands never invoke a model.

`npm run lint` never edits files. Use `npm run lint:fix` explicitly. Lint rejects
focused/disabled unit tests, missing assertions, unawaited async assertions, and
floating promises in tooling. `npm run check:public-tests` rejects private members,
private overrides and internal source imports in runtime tests and helpers; review
must still catch indirect private access that static syntax cannot identify.
`npm run check:workflows` rejects duplicate YAML keys and runs SHA-256-pinned
actionlint. Its first run downloads a verified archive into `test/tmp/tools/`;
subsequent runs reuse and verify that archive. ShellCheck and Pyflakes are not
implicitly discovered from a developer's PATH.

## Repeat and diagnose

Use `npm test -- <file> -t '<test name>'` for one contract, or `npm run test:watch`.
For order failures, record and replay the seed:

```sh
npm test -- --sequence.shuffle --sequence.seed=20260908
```

Unit CI emits `test/tmp/unit-results.xml`. Playwright emits JSON and JUnit results,
HTML reports, failure screenshots and traces under `test/tmp/browser/`; retries
are disabled so flakes remain visible. Run `npx playwright show-report
test/tmp/browser/report` or open an individual retained trace. Browser tests use
Chromium, Firefox and WebKit from the checked-in release profile.

## Coverage means observable execution

`npm run coverage` reports library coverage at `coverage/library/index.html`, with
LCOV and JSON summaries alongside it. Every authored production file is included,
including unexecuted files. Functions remain at 100%. Each file defaults to 100% for
all metrics; `config/coverage-exceptions.json` records the few private defensive
branches that valid public operations cannot reach. Limits are absolute uncovered
counts per file and globally, so adding code cannot dilute them. Ratchet a limit
down when public tests cover it; any increase needs an explicit reviewed reason.
Do not hide uncovered code with ignores or test manufactured private states.

`npm run coverage:tooling` separately reports every script/build module, including
zero-coverage files, at `coverage/tooling/index.html`. It captures subprocess CLI
execution as well as in-process tests. This report must not inflate the library
percentage. Review release failure/recovery tests together with the percentage;
a high count of mocked decisions alone does not prove the command works. The release
CLI subset has separate minimums of 90% lines/statements, 70% branches, and 100%
functions in `config/release-coverage.json`; all other tooling remains visible in
the report, including unexecuted files.

## Public operation models

`npm run test:model` replays deterministic consumer-owned lifecycle models; these
also run in the normal unit suite. `npm run test:mutation` measures a bounded
ownership/subscription subset with two workers and a ten-minute deadline. The
manual Mutation workflow retains complete and partial reports. See
[model replay and measured survivors](unit/model-based/README.md).

## Locked consumer fixtures

Each fixture commits its external dependency lock. The runner copies each consumer
into a unique OS temporary directory outside the checkout, overlays the five exact
candidate packages, verifies the external dependency graph is unchanged, and uses
`npm ci`. It strips inherited checkout tool paths and `NODE_PATH`. Concurrent
attempts own independent install/output/cleanup directories.

Without artifact inputs, the runner builds and packs once. To validate a candidate:

```sh
npm run test:fixtures -- --artifact-dir release --report test/tmp/fixtures.json
```

All five explicit tarball flags are also accepted together. Partial/mixed inputs
fail before installation. Reports include artifact and lock hashes, installed
graphs, output, stage, status and elapsed time for every attempted fixture.
To intentionally refresh one external graph, use `npm --prefix
test/fixtures/<name> update --package-lock-only --ignore-scripts`, review its
manifest and lock together, then run that fixture. Never delete locks during tests.

## Exact release candidates

From a clean committed checkout:

```sh
npm run release:artifact -- --output release
npm run release:validate -- --artifact-dir release
npm run release:verify -- --artifact-dir release --require-validation
```

Candidate validation runs required checks and tests browser/distribution/fixture
consumers against the original tarballs. Its separate validation record binds logs,
three-engine browser results, fixture results and lock hashes to the immutable
release evidence. Failed/incomplete/mismatched evidence cannot be promoted.
Publication remains disabled by `config/release-promotion.json`.

## Dependency maintenance

Update related test runner and coverage-provider pins together, with their lockfile
and actual suite validation. Root development dependencies never belong in a
published runtime graph. The narrow Stryker override of `typed-rest-client`'s `qs`
pin selects 6.16.0 to avoid its reported denial-of-service advisories; remove that
override when Stryker's dependency chain accepts a fixed version natively. Every
mutation/benchmark run remains development tooling with explicit scope and limits.

Dependabot proposes weekly root tooling and pinned GitHub Action updates, with
Vitest and Stryker packages grouped by tool. Monthly consumer-fixture updates
preserve review of their independent lockfiles. Local Marionette package versions
are excluded from these automated updates. The bot never merges changes; browser
profile pins and all affected consumer contracts must still pass review and CI.
Configuration follows GitHub's [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
