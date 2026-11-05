# Live sibling lists and remaining render fanout

Baseline: `9c482f1de87778749c6fd48b65917d8e71dfb873`.
Production change and behavioral verification: `3578f808d2e189cd61d67d72b9376f03c72d102d`.
Lint-comment correction: `72b0862e9e5b898dbad1261150a58fb0c6720543`.

Each element host now lazily acquires its live `childNodes` collection once and
reuses that reference. Insertions and removals remain visible through the live
list. Root/range hosts, expression evaluation, component updates, DOM mutations,
event registration and scheduling retain their existing behavior. This reduces
per-pass work; it does not reduce the number of root or child render passes.

Independent Astra source and measurement reviews cleared the bounded change.
A new public test empties and repopulates the same host with text, keyed elements
and component ranges, checking destruction, order, edited values, identity and
focus. All 32 affected tests passed before and after the production change.
These are preservation guards, not a newly failing functional regression.

## Measurements and limits

The source-bundled experiment used the same installed dependencies, Marionette
runtime and public readiness oracle on both sides. Each fresh page received a
10-field warmup for the measured revision; order alternated before/after and
after/before. All 32 measured journeys settled correctly without page errors.

At 100 required fields, four-pair medians were **3,116 to 2,493 ms**, with every
pair improving by 10–23%. A separate fresh-Chromium-process-per-journey check
completed 20/20 journeys. Its four required-field pairs had medians **3,811 to
2,783 ms**, improving 15–31% per pair. Those journeys also checked synthetic
input/clear, values, validation counts, retained identity and focus.

Do not generalize these gains: the original 50/200-field cases contained large
outliers, including an 11.26 s baseline at 50 fields and 34.28 s at 200. Those
results remain retained but do not support a reliable gain estimate. Original
100-field no-validation pairs were all 2–5% slower (243 to 254 ms median). The
six fresh-process control pairs were mixed, with medians 353 to 368 ms and broad
overlapping ranges. Original edit cases were also slower; fresh-process edit
latencies improved. No typing or no-validation neutrality claim is made. The
source comparison is narrow; the cause of timing variability remains unresolved.

Separate diagnostic instrumentation, excluded from timing samples, found at
100 required fields with form actions disabled:

| Work | Before | After |
| --- | --- | --- |
| Native element `childNodes` getter reads | 62,700 | 42,102 |
| Renderer update calls | 10,602 | 10,602 |
| Reconciliation calls | 63,204 | 63,204 |
| Public `form:state` notifications | 1,101 | 1,101 |

Independent review verified snapshot/bundle hashes and that the complete emitted
delta contained only the live-list change plus source comments. The measured
candidate exactly matches the production change. A subsequent lint-global comment
and inventory hash update produce identical TypeScript-emitted JavaScript with
comments removed; the comparison proof is retained privately.

Toolchain: Node 24.19.0, npm 11.17.0, FormKit Core-family 2.1.2,
Playwright 1.64.1, Linux headless Chromium 154.0.8037.57. These small-sample
observations do not establish a universal speedup or complexity guarantee.

The larger invalidation problem remains. The diagnostic counted 101 queued root
passes plus initial render; 100 queued passes were first scheduled by descendant
mutations. Root blocking-count changes also emitted 100 notifications, coalesced
into those passes. This is scheduling attribution, not a tested event-filtering
counterfactual. Both routes require examination before a root bailout is safe.

The next investigation is capture-only dependency/effect tracing with no skipped
work. It must isolate parent and child reads while propagating opaque descendant
obligations; preserve own/inherited/missing resolution, mutable schema behavior,
getters, callbacks and lifecycle; and account for DOM callback/listener ordering
that a whole-render bailout could suppress. This change establishes no such
bailout or new observation contract.

## Verification

On clean Git worktree `3578f808`, build, canonical coverage (2,778 passed plus
one expected failure across 186 files), package ownership, all nine packed-consumer
stages and 19 Chromium cases passed. All nine FormKit source modules reached 100%
coverage with unchanged thresholds. Lint then identified two DOM type names missing
from the existing lint-global comment. That failure is preserved.

Commit `72b0862e` changes only the lint comment and its inventory hash. On that clean
revision, full lint, public-test boundaries and API-inventory checks passed.
TypeScript 6.0.3 emitted identical executable JavaScript before/after the comment
correction. The behavioral suites were not needlessly rerun for that comment.

Earlier coverage/timeouts and performance discrepancies remain preserved in their
original receipts. No limits, assertions, worker settings or thresholds changed.
Actual-Pro acceptance and independent timing validation of this new candidate
remain pending; earlier results retain their exact source/version attribution.
Online license validation remains unverified.
