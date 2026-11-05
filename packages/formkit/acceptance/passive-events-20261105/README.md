# Passive schema event repair — 2026-11-05

Clean tested source: `16682abe2e54fe1143141b0f6bc0ea9105923180`, on
`codex/formkit-master-integration-20261103`. Later evidence commits do not change
that tested executable source. Independent vault QA subsequently rebuilt published
`ca183a6064337dd6183f1719dc8e3b023c3abe40` and reported **6/6 actual-Pro touch
checks and 8/8 targeted regressions passed**, with zero failures, page errors or
timeouts. The writer did not execute that QA or receive its raw artifacts.

## Readiness and chosen scope

Remote branch d18db560 was 16 commits ahead and six behind master ea40bf47, with
merge base c83a9f25. The six master commits affect Dependabot configuration, two
non-FormKit consumer fixtures and a tooling test. A read-only merge-tree simulation
exited 0 with no conflicts; no branch merge or working-tree integration occurred.
`readiness.json` preserves exact SHAs, paths and the simulation tree. This does
not certify execution on a merged tree. During verification master advanced to
`2e8a4fe494c57f0be631d764361452ff8df30d04` with root/fixture tooling overrides and
locks plus test guidance (minimatch/glob); no FormKit or runtime source changed.
A fresh simulation against candidate 16682abe also exited 0, with 18 candidate
commits ahead and seven behind. No integration was performed. These receipts
use the candidate's recorded lock, not the later master tooling graph.

Independent Astra review identified a supported-contract defect: Pro 0.130.4
contains eight onTouchstartPassive and four onTouchmovePassive bindings, including
slider touch handling. The adapter registered touchstartpassive/touchmovepassive,
which browsers do not emit. The official Vue runtime interprets the suffix as a
native passive listener option. Static archive provenance/counts are retained in
`upstream-evidence.json`; no Pro bootstrap or vendor modification was used here.

The renderer now strips only a trailing Passive after a nonempty event name and
sets passive:true. Literal onPassive still means the custom passive event. Each
authored binding owns a separate listener wrapper so plain/passive bindings can
share a callback without DOM registration deduplicating them. Wrappers preserve
native element receivers and bound token receivers; update, removal and teardown
remove the corresponding registered wrapper. No Once/Capture support, full Vue
event syntax, new API methods, Core upgrade or recovery policy was added.

The open-panel Destroy button remains a separate fixture/vendor interaction gap;
it was not evidence of an adapter teardown defect. Other engines and a real host
application remain acceptance work requiring an appropriate execution target.
Historical reference failures require equivalent-stack reproduction before blame
can be assigned. No network/licensing workaround or repeated validation request
was attempted.

## Failure-first proof and final checks

The test-only commit 7b3cf418 added two unit cases and the real-touch browser
reproduction without production changes. On the baseline runtime, both new unit
cases failed (15 existing cases passed), and a successful Chromium touchscreen tap
produced no callback; the browser test failed its delivery assertion. Red logs,
report and test patch are retained. Review then exposed two edge defects in the
provisional repair: literal onPassive and shared callbacks. Both failed before
correction (17 cases passed); the provisional source/test patches and red log
remain. The final focused unit suite passed 19/19.

| Clean-source check | Result |
| --- | --- |
| Full build, declarations and package ownership | Passed |
| Canonical coverage | 2,748 passed plus one expected failure, 182 files; all existing thresholds passed; all nine FormKit modules 100% |
| Packed ESM/CJS, declarations, locked consumer | All nine stages passed |
| Native Chromium journeys | 17/17, zero unexpected/flaky/skipped results |
| New touch journey | Three trusted touchstart taps; callback replacement, removal, reinstallation and retained-target teardown passed; zero page errors |
| Actual Pro touch on this source | Independently reported: 6/6 touch checks and 8/8 targeted regressions on published ca183a606; not executed by writer |

The browser journey uses hasTouch and real locator.tap calls. It proves trusted
touchstart delivery and listener lifecycle. Passive cancellation semantics are
covered separately by cancelable synthetic unit events. Neither establishes
physical-device behavior, actual slider dragging, or Firefox/WebKit support.
`trusted-touch-trace.json` is decoded from the retained green browser attachment.
The browser test was strengthened after review to prove reinstallation through a
third tap before retaining the active element for teardown.

`verification.json` records exact commands/exits/timings. `tool-versions.json`
records Node 24.19.0, npm 11.17.0, Core 2.1.2, Playwright 1.64.1, Chromium
154.0.8037.57, TypeScript 6.0.3, Vitest 5.0.5 and JSDOM 30.1.3. Only the installed
cloud Chromium was used. No browser download or Mac test ran. Independent Astra
reviews were read-only source/test/evidence inspections, not independent live QA.

## Independent actual-Pro touch acceptance

The existing vault QA owner reported the result through the parent in QA turn
`01a1aa3b-3c5c-73e1-b543-06a862b26040` (thread
`01a1a141-9e0c-7156-8ce2-0b5d80196006`). `parent-vault-touch-pass.json` records
that report and external artifact locations. Those files are in a separate QA
environment, absent here; no raw QA hashes or execution were verified by the writer.
The writer did verify all 40 original bundle hashes, all 13 source hashes and
that the published candidate's changes after 16682abe were documentation/evidence
only. `reconciliation.json` records these local checks. The original `receipt.json`
is a preserved pre-QA checkpoint: its pending status is superseded by this section,
not a current blocker. The original static `independent-review.json` is unchanged.

Baseline native d18db560 passed 3/6 checks: slider movement and both passive-listener
registration checks failed. With the same trusted gesture, its slider remained 80
before and after finger-up; the genuine Vue positive control reached 20. On the
candidate the slider reached 20 before finger-up and stayed 20 afterward. QA verified
passive:true for touchstart/touchmove and retained-handle listener removal on destroy.
Real repeater touch reordering passed on both baseline and candidate; that validates
the driver but did not detect the slider defect. The original failures remain
preserved, and QA reports the external baseline evidence hashes unchanged.

The candidate also passed mouse drag, keyboard stepping, disabled state, repeated
updates, dropdown/autocomplete callbacks, datepicker reopening, reset and cleanup.
QA used trusted CDP Input.dispatchTouchEvent in Linux headless Chromium
154.0.8037.57 with 390×844 mobile/touch emulation, Pro 0.130.4, every Core-family
package 2.1.2, drag-and-drop 0.6.3, Node 24.19.0, npm 11.17.0 and Playwright 1.64.1.
QA reports a passed credential scan including unpacked tarballs, a clean repository,
no remote writes, stopped server/browser and verified port closure.

This is emulated Chromium touch acceptance, not physical Android/iOS/Safari testing
or broader cross-browser parity. The existing 137/137 baseline plus 8/8 release-group
Pro pass remains attributed to published ffe7d95d and executable source 7967f80c;
those suites were not rerun here. Online license validation remains unverified.
No full parity, performance improvement, release readiness or permission to retry
the denied PR action follows from this bounded result. No new tests were run for
this documentation reconciliation.
