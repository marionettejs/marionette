# Coverage and Genesis fixture follow-up — 2026-11-03

This receipt preserves failures as well as passes. It is not full release,
Pro parity, production performance or online license-validation certification.
The previous integration receipt and independent vault reports remain attributed
to their original versions and source revisions.

## Source and changes

- Baseline: `db655482d330940f993c32103321b546d8c907d4`.
- Runtime/regression: `1ddf1c168f1ca9f9c61615202a8749ed9dd6243e` queues one refresh
  at the enclosing composition boundary and resolves simple schema token paths
  through the existing resolver. Compound expressions and function calls still
  use official Core compilation. No persistent expression cache was added.
- Fixture: `0dee5f85bc91e647945721e5ff81eec080299ccd` declares Themes 2.1.2 and loads
  base Genesis before Pro Genesis in native, Vue and React consumers. A permanent
  computed-position/containing-block check covers native text/email anchors.
- Coverage policy: `d623599a665fdc9dc5ae17aa03841721bf4627f8` budgets two workers for
  coverage only. Assertions, timeouts, cycle counts and thresholds are unchanged.
- Clean build/package/browser/fixture source: `000f978d09e4dcc835f1b4b774a89cb677fe76cc`.
  This adds status documentation to d623; production hashes match 0dee. Later
  artifact commits do not retroactively change a receipt's tested source.

Node 24.19.0, npm 11.17.0, Vitest 5.0.5, JSDOM 30.1.3, TypeScript 6.0.3,
Rollup 4.67.2, Playwright 1.64.1, installed Chromium 154.0.8037.57.
Core/Themes 2.1.2 and Pro 0.130.3. The configured release-profile browser versions,
Firefox and WebKit were not run. No browser downloads were attempted.

## Coverage diagnosis and limits

The original five instrumented timeouts remain in
[the original integration receipt](../master-integration-20261103/README.md).
A retained baseline focused run reproduced two nested-row timeouts (35/37 passed).
A separate eight-case instrumented CPU sample shows Core compilation on 48.486%
and form refresh on 83.640% of inclusive sampled stacks. Percentages overlap.
`profile-summary.json` gives the original profile hash and transformed-coordinate
caveat; the raw 7 MB diagnostic profile remains in the writer scratch workspace.
This is evidence of repeated work, not a production-performance benchmark.

Nested placement was queueing redundant whole-form refreshes. The small scheduling
change retains the enclosing mutation's refresh boundary. Simple token paths were
also repeatedly compiled; they now use the existing token resolver directly.
Public schema compatibility tests cover replaced data, false/zero values, numeric
paths, receiver binding, loop scopes, independent renderers and compound/call
fallback. Those compatibility tests passed before and after the optimization;
they are not presented as a functional failure-first regression.

| Source / command | Result | Retained evidence |
| --- | --- | --- |
| db655 baseline focused coverage | 35 passed; 2 nested-row timeouts | `retained-baseline.log`, LCOV |
| Guard-only dirty diagnostic | Focused 37 passed; full run stopped after 6 varying timeouts, exit 130 | `outermost-experiment.log`, `full-outermost.log`, exact patch in `full-candidate-source.json` |
| Both changes focused coverage | 57/57 tests passed; partial-suite coverage thresholds fail as expected | `token-candidate-focused.log` |
| 0dee full serial coverage | 2689 passed + 1 expected failure; 1 test timeout and 50 skipped after a core fixture-hook timeout | `full-final.log`, `serial-final-coverage-summary.json` |
| 0dee then-default coverage | 2739 passed + 1 expected failure; unchanged core 1000-cycle test exceeded 5000 ms (5017 ms) | `full-default.log` |
| 0dee full coverage with two workers | **2740 passed + 1 expected failure; all 182 files and existing thresholds pass** | `full-two-workers.log`, `two-workers-coverage-summary.json`, LCOV |
| d623 canonical `npm run coverage` | 2739 passed + 1 expected failure; unchanged core jQuery-free bundling test exceeded 5000 ms (7820 ms) | `canonical-coverage.log` |
| d623 implicated core suites in isolation | 62/62 tests passed; process exits 1 on full-suite thresholds for this partial run | `core-isolated.log` |

The successful full run gives all nine FormKit modules 100% statements, branches,
functions and lines. Global coverage is 99.97% statements/lines, 99.83% branches,
100% functions; existing exceptions are unchanged. Later canonical failure is
still a blocker to claiming a consistently clear full gate. Failures vary across
unchanged core tests, but these observations do not establish an exclusive
environmental cause. Independent canonical coverage in the existing vault cloud
is requested. No unrelated core code or tests were modified to obtain a pass.

## Official styling evidence

`theme-evidence.json` records exact official package integrities and CSS hashes.
Themes 2.1.2 supplies unconditional `.formkit-inner { position: relative; }`.
Pro 0.130.3 supplies only a conditional `[data-has-overlay] .formkit-inner` rule;
its stylesheet does not replace the base theme. The fixture previously loaded
only the Pro extension. The correction imports the base theme for all stacks,
without changing adapter runtime styling.

The new collector assertion fails on the original consumer source `605f1f1a`
while its previous 14 core cases pass (`style-red/`). This red check used the new
collector separately from that old consumer, not an old-source collector.
The assertion checks computed position and an absolute probe's actual offsetParent.
It does not establish real Pro popover scrolling, resize or keyboard behavior.

`vault-baseline-report.json` is explicitly a coordinator-reported result, not a
writer execution: source db655 / Pro 0.130.3 passed 107/107 functional cases,
12/30 original extended positioning cases, and 30/30 with a transient relative
position rule. Original raw vault artifacts are not copied here. The permanent
theme and updated runtime require the separate final vault rerun. This writer
has no FORMKIT binding and did not request, generate or publish a key. Online
license validation remains unverified after `net::ERR_TUNNEL_CONNECTION_FAILED`.

## Delivery and independent review

See `delivery.json` for exact commands, source and stage exits. Build/declarations,
API inventory, source/distribution consumers and isolated packed FormKit checks
passed at clean 000f. Packed checks include ESM/CommonJS, declarations and nested
row lifecycles. Consumers retain their original lockfiles and artifact hashes.
The native/React installations contain no Vue or @formkit/vue packages.

The first browser attempt could not launch the absent default pinned Chromium;
its launch report is retained. The permitted installed-Chromium run passed 15/16
journeys; FLOW-02 exceeded the overall 90-second deadline. The final source line
was awaiting cancellation after destruction, but that is not evidence of a
90-second cancellation hang. Unchanged isolated FLOW-02 passed in 16.2 seconds.
Independent source review verified abort installation before the third callback,
disposal abort and callback completion, and found no cancellation-path defect.
Both observations are retained; no cancellation fix or timeout increase was made.

Independent Astra source review cleared the small runtime changes, public tests,
fixture correction and coverage-only worker budget. Evidence review checked
profile aggregation, official CSS hashes and the distinction between successful
and failed runs. Review is source/artifact inspection, not independent live QA.
Final delivery and collector results are recorded below when complete.

### Final delivery results at clean 000f

The final unchanged native browser run passed **16/16** in 1.6 minutes;
FLOW-02 passed in 7.5 seconds. The preceding 15/16 and isolated pass remain in
this bundle. Targeted lint and the public-contract test-boundary check passed.

All three consumers completed independent install, locked reinstall, Pro
ESM/CommonJS import and Vite build. `consumers/` retains source/version/lock
receipts. The permanent anchor regression passes in **all three stacks**;
native passes **15/15** collector assertions, Vue **12/15**, React **13/15**.
No page errors or captured core runtime errors occurred. The collector exits 1:
Pro bootstrap is correctly classified as blocked in this keyless environment,
and reference failures remain failures. Actual Pro controls were not rendered.

The Vue failures are local-class removal, dynamic submitAttrs and duplicate
requestSubmit suppression. React fails local-class removal and duplicate
requestSubmit suppression. The native trace records two requestSubmit attempts
with one callback and a disabled submit action. These exact bounded comparisons
do not establish full parity, broader framework correctness or performance.
`style-green/` contains all desktop/mobile pixels and interaction observations;
`style-red/` preserves the failing anchor on the original source.

Current remote master observed during delivery was
`ea40bf478603f97f5cfb080220a776490f7f81da`. Its six commits since this branch's
c83 base affect Dependabot configuration/tests and two isolated consumer fixture
dependency sets, not FormKit or shared runtime. They have not been merged into
this branch or silently attributed to these test results.

### Required independent follow-up

On the published follow-up revision in the existing authorized vault cloud:

1. Run canonical `npm run coverage` with Node 24.19.0/npm 11.17.0. Preserve its
   actual full-gate result; do not change thresholds, timeouts or test workloads.
2. Rebuild/prepare the native Pro 0.130.3 consumer, using the approved environment
   bootstrap only, and repeat the 107 functional plus 30 extended positioning,
   wheel/hover, resize, reopen and teardown assertions. The permanent fixture
   now imports both Genesis stylesheets; do not inject the old transient rule.
3. Record exact source/toolchain and distinguish local plugin/control operation
   from online license validation. Do not copy a key into receipts or fixtures.

PR creation remains separately denied and was not retried. No merge, npm release,
production deployment, security change, browser download or credential operation
was performed in this follow-up.
