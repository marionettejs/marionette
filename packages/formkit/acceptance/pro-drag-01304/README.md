# Pro 0.130.4 repeater contract repair — 2026-11-04

The repair and corrected collector were tested at clean source
`7967f80c4ef3f02319716f235a490de653bb3391`. The existing branch is
`codex/formkit-master-integration-20261103`. Later evidence/documentation commits
retain that tested-source attribution. Actual Pro dragging on this repair is
pending the existing approved vault QA environment.

## Failure and cause

The coordinator reported independent vault QA on exact published
`531347548728e59a632533288be716f5e96e8ef0`: the preceding functional/positioning
suite passed 137/137, but the new native release collector passed only 5/8 groups.
Both actual drag attempts failed before starting. Native rows were UNDEFINED
elements; widening the row selector still failed, exposing zero-area drag handles
with `formkit-dragHandle` classes. Four other release targets passed. An isolated
replacement/submission/reset/destruction diagnostic passed 4/4.

The original Vue collector passed 7/8. Its sole failure was the bubbling event
observer; a capture-phase diagnostic passed all eight groups with actual drags
before and after replacement. These are parent-reported vault results, not writer
executions. `parent-vault-failure.json` records their provenance and original
artifact locations; those raw artifacts remain in the separate QA executor.

Two adapter defects explain the native DOM evidence:

- Loop expansion spread schema objects, dropping non-enumerable discriminators
  and conditional accessors. Published Pro sections expose such getters. The
  repair retains property descriptors and omits only the consumed `for` property,
  including when that property is non-configurable. It does not invent a fallback
  element or patch the vendor.
- Default section classes omitted Core's kebab conversion. The repair uses the
  official FormKit utility while preserving explicit `rootClasses` precedence.
  This restores Genesis selectors such as `formkit-drag-handle` and
  `formkit-prefix-icon`.

Separately, DND 0.6.3 stops dragstart/dragend propagation at each row. The collector
now observes in capture phase. It retains direct LI selection and real `dragTo`,
asserts the exact handle class token and nonzero visible geometry, resets event
observations for each gesture, and asserts both model and rendered order. Each
drag's geometry/events/order is returned separately. No forced pointer action,
move-up/down substitute, widened selector or relaxed value assertion was added.

## Regression and verification evidence

The test-only commit `d764af89800d83495cec08c49ff8ea351c8e0db9` retains four new
public regressions. Before repair they yielded four failures and 19 passes;
`red-unit.log`, `red-tests.patch` and `regression-receipt.json` preserve the exact
source/patch attribution. After repair all 23 affected tests passed. Coverage
includes conditional and null fragments, native input/component getters, keyed
identity, scoped listeners, destruction and registry cleanup. Existing explicit
custom class functions retain their authored naming.

`verification.json` records clean-head commands, exit statuses and timings with
Node 24.19.0/npm 11.17.0. Coverage retained every assertion, timeout and threshold.
The initial browser preparation failed before tests because npm's default cache
under /home/agent/.npm was unavailable. Its exit 254/log remains preserved. The
same command was retried with a command-local cache in the writable workspace;
no source, lock or security settings were changed for recovery.

The clean-source results are:

| Check | Result |
| --- | --- |
| Full build, declarations and package checks | Passed |
| Canonical coverage | Exit 0; 2,744 tests plus one expected failure, 182 files; all existing thresholds passed; all nine FormKit modules 100% |
| Packed ESM/CJS, strict declarations, locked consumer | All nine stages passed |
| Native Chromium example journeys | 16/16 passed, zero unexpected/flaky/skipped results |
| Fresh Pro 0.130.4 native consumer preparation | Install/reinstall, no-Vue graph, ESM/CJS imports, strict types and Vite build passed |
| Fresh native comparison collector | 15/15 core checks, zero page/runtime errors; overall exit 1 for blocked Pro bootstrap |
| Corrected release collector | Exit 1, blocked Pro bootstrap, zero positive cases executed |
| Actual Pro dragging after repair | Never run in writer environment; pending vault QA |

Runtime versions: Core-family packages 2.1.2, Pro 0.130.4, DND 0.6.3,
Playwright 1.64.1 and installed cloud Chromium 154.0.8037.57. Browser contexts and
owned servers were closed after collection. No browser download or Mac test ran.

Independent Astra source and collector reviews cleared exact 7967f80c. They
performed static review only, not independent browser execution. Their findings
and qualifications are recorded in `independent-review.json`.

## Pending actual Pro retest

This writer environment has no FORMKIT binding. Local keyless-bootstrap results
must not be interpreted as actual Pro acceptance. Keep the original failure and
previous versioned receipts. In the same approved vault environment, prepare this
published revision with the existing development bootstrap, then retain the 137
baseline checks and run the corrected release collector:

```sh
npm run build
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs native'
node test/fixtures/formkit-pro/capture-release-01304.mjs <output> <actual-port> native
```

Require real LI rows, visible handles, both separate real drag traces, duplicate
order/count before and after replacement, edit alignment, and submit/reset/destroy.
A separately prepared Vue consumer remains available for diagnosing differences.
Use the existing approved runtime key setup; do not put any key in this repository
or receipt. No new credentials, license bypass or account changes are requested.
Online license validation remains a separate unverified boundary after the prior
proxy failure. This work does not claim full parity, performance improvement,
release readiness, direct Destroy-button reachability under an open panel, or
successful Pro dragging before the independent vault rerun.
