# Call-free expression compilation reuse

Production source: `48755e45d7f9c7f1620a3d16f1f3edb70ecc232b`.
Comparison baseline: `7b38043fa46d85ba62b93b6a6e31af28585a820d`.
Final verification revision: `bfac24ecb328a2f9db276eae48043b76000034aa`.

The schema renderer now reuses raw FormKit compiler programs for compound
expressions without `(`. Each invocation still creates fresh lazy token lookups.
No scope, resolved value, provided evaluator or result is cached. Each renderer
owns at most 128 entries and clears them on schema replacement and destruction.
Expressions containing `(` retain fresh compilation, including function calls,
grouping and quoted parentheses. This conservative boundary avoids the shared
provider and function-tail state found in pinned Core 2.1.2.

Two independent Astra reviews cleared the implementation and public test oracles.
Six new public tests passed on the baseline before the optimization and afterward;
they are preservation guards, not newly failing correctness regressions. They cover
live/repeated getters, short-circuiting, cross-renderer isolation, narrow nested
getter/coercion and function-tail evaluations, replaced receivers, row/slot scope,
eviction, schema replacement and terminal cleanup after a propagated error.
They establish neither general reentrancy/recovery nor garbage-collection behavior.
All 31 affected tests passed before broader verification.

## Controlled browser measurements

Same installed dependencies and Marionette runtime, one warmup per revision,
alternating before/after and after/before pairs. Readiness required settled values
and validation, expected blocking counts, exact named values, DOM counts and stable
public notifications. Bundles used authored source, not registry packages.

| Fields | Validation | Samples per revision | Before median | After median |
| --- | --- | --- | --- | --- |
| 50 | required | 4 | 1,104 ms | 825 ms |
| 100 | required | 4 | 4,019 ms | 3,007 ms |
| 200 | required | 2 | 20,318 ms | 14,874 ms |
| 100 | none | 4 | 300 ms | 367 ms |

All 32 measured journeys completed without errors. Four also checked synthetic
input/clear, retained identity and focus; these are not trusted typing-throughput
measurements. Required-field pairs all improved, with substantial variation:
100-field improvements ranged from 6% to 36%; the two 200-field pairs improved
26% and 28%. Large validated forms remain slow.

The original no-validation control was slower in three of four pairs, including
a 772 ms candidate outlier. A separate fresh-page-per-journey check retained the
same public oracle and completed 24/24 journeys without errors. Its eight
100-field no-validation pairs had medians 324 ms before and 319 ms after, with
overlapping ranges (316–361 ms and 283–375 ms). Its four required 50-field pairs
had medians 1,042 ms and 791 ms. These results are reported separately: the later
check did not reproduce a consistent regression and does not explain the original
slowdown. No universally unchanged no-validation performance is claimed.

Separate instrumentation, excluded from timing measurements, counted adapter
compound-expression evaluations and compiler entry calls for 100 required fields:

| Work | Before | After |
| --- | --- | --- |
| Compound evaluations | 178,704 | 178,704 |
| Adapter compiler invocations | 178,704 | 33,003 |
| Renderer update calls | 10,602 | 10,602 |
| Reconciliation calls | 63,204 | 63,204 |
| Public `form:state` notifications | 1,101 | 1,101 |

Compiler counts exclude Core's internal recursive compilation. Public events are
not render counts. This fixture disables default form actions, so these counts
must not be substituted for the separate vault QA fixture's earlier totals.
The optimization does not coalesce updates or suppress public notifications.

An independent measurement review verified the baseline snapshot and bundle hashes,
then checked that emitted differences contained only the intended cache changes
and source comments. The measured candidate differs from production source only
in a corrected comment typo. A separate profile was excluded from timings.

Toolchain: Node 24.19.0, npm 11.17.0, FormKit Core-family 2.1.2,
Playwright 1.64.1, Linux headless Chromium 154.0.8037.57. These are small-sample,
environment-specific observations, not a complexity proof, general ranking or
full parity claim. No Pro or Vue/React performance comparison ran here.

## Final gates and remaining boundary

On clean detached Git worktree `bfac24ec`, build, package ownership, all nine
packed-consumer stages, 19 Chromium tests, full lint, public-test boundaries and
API-inventory checks passed. Canonical coverage passed 2,777 tests plus one expected
failure across 186 files with unchanged thresholds; all nine FormKit source modules
had 100% statement, branch, function and line coverage. The worktree stayed clean.
The worktree used the installed dependency tree and independent build outputs.

The earlier persistent-checkout coverage timeouts remain recorded in the
[cleanup receipt](detached-subtree-20261105.md); this change does not establish
their cause. Initial lint found one test-string quote-style error, corrected before
final verification; that failure is retained locally. No assertion, timeout,
coverage threshold or worker setting was weakened.

Independent actual-Pro replay of cleanup source `3e49fc38` at published `7b38043f`
is separate. This compilation candidate needs its own exact-source QA replay.
Earlier rating, togglebuttons, touch and drag passes retain their original source
and version attribution. Online license validation remains unverified.
