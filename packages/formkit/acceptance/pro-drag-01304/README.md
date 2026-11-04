# Pro 0.130.4 repeater contract repair — 2026-11-04

The repair and corrected collector were tested at clean source
`7967f80c4ef3f02319716f235a490de653bb3391`. The existing branch is
`codex/formkit-master-integration-20261103`. Later evidence/documentation commits
retain that tested-source attribution. Independent vault QA subsequently reported
**137/137 baseline assertions and 8/8 native release groups passed** on published
`ffe7d95d44caa259a3b786178c517a33083ab240`, whose changes after 7967f80c were
documentation/evidence only. The reported pass covers actual Pro dragging.
The writer did not execute that retest or receive its raw artifacts; see
`parent-vault-pass.json` for provenance, exact versions and limitations.

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

The writer's clean-source results, captured before the vault retest, are:

| Check | Result |
| --- | --- |
| Full build, declarations and package checks | Passed |
| Canonical coverage | Exit 0; 2,744 tests plus one expected failure, 182 files; all existing thresholds passed; all nine FormKit modules 100% |
| Packed ESM/CJS, strict declarations, locked consumer | All nine stages passed |
| Native Chromium example journeys | 16/16 passed, zero unexpected/flaky/skipped results |
| Fresh Pro 0.130.4 native consumer preparation | Install/reinstall, no-Vue graph, ESM/CJS imports, strict types and Vite build passed |
| Fresh native comparison collector | 15/15 core checks, zero page/runtime errors; overall exit 1 for blocked Pro bootstrap |
| Corrected release collector | Exit 1, blocked Pro bootstrap, zero positive cases executed |
| Actual Pro dragging after repair | Never run in writer environment; independent vault pass reported below |

Runtime versions: Core-family packages 2.1.2, Pro 0.130.4, DND 0.6.3,
Playwright 1.64.1 and installed cloud Chromium 154.0.8037.57. Browser contexts and
owned servers were closed after collection. No browser download or Mac test ran.

Independent Astra source and collector reviews cleared exact 7967f80c. They
performed static review only, not independent browser execution. Their findings
and qualifications are recorded in `independent-review.json`.

## Independently reported actual Pro retest

The coordinator relayed successful QA from thread
`01a1a141-9e0c-7156-8ce2-0b5d80196006`, turn
`01a1a71d-85d9-77bb-af14-56eca7357b51`, on exact published ffe7d95d:

- All 137 baseline assertions and all eight native release groups passed. There
  were zero failures, unexecuted groups, page/runtime errors or test timeouts.
- The repeater rendered three direct LI rows with visible 32×148 px
  `formkit-drag-handle` elements. Each actual gesture independently captured
  dragstart and dragend. Initial duplicate dragging produced matching model/DOM
  order `Duplicate, Tail, Duplicate`; replacement, another drag and editing the
  moved row produced `Fresh, Last, Moved Fresh`.
- Currency, reactive mask presentation, late labels, transfer search without
  extra serialization, public submission/reset/destruction and retained
  datepicker SVG identity passed. Permanent Genesis imports were used without
  test-only CSS overrides. The observed readiness was 630 ms; this is not a
  performance comparison or improvement claim.
- QA reported a passed credential scan, clean repository, no publication, stopped
  browsers/server and verified port closure.

Versions were Pro 0.130.4, DND 0.6.3, every installed Core-family copy 2.1.2,
adapter 5.0.0-rc.2, Node 24.19.0, npm 11.17.0, Playwright 1.64.1 and Chromium
154.0.8037.57. Online license validation remains unverified due to proxy request
failures. This is the tested native Chromium scope, not full Vue/React parity.

The original 53134754 failure, local execution logs, source hashes and static
review records remain intact. `receipt.json` and `independent-review.json` retain
their pre-retest pending status as historical writer checkpoints; they are not
the current QA status. Raw positive-run artifacts remain in the separate QA
executor and were not copied or hashed here. The parent-reported result is
recorded separately, without implying local execution or independent raw-artifact
verification by the writer. `reconciliation.json` records only source and artifact
hash checks actually performed here. No browser or coverage tests were repeated
for this documentation update.

For a future authorized reproduction, the existing fixture commands are:

```sh
npm run build
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs native'
node test/fixtures/formkit-pro/capture-release-01304.mjs <output> <actual-port> native
```

Use only the existing approved runtime key setup; no key belongs in this repository
or receipt. Full parity, other browser engines, online license validation, release
readiness and direct Destroy-button reachability under an open panel remain
outside this acceptance claim.
