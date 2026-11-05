# Sibling lookup allocation check

Production source: `c7dcad6dc3121d656a49851a43e91787c2bf94f7`.
Comparison baseline: `af59f37bc3abc01dbd5d9504874a07afa56c02d1`.

The native renderer previously copied a container's entire child-node collection
for each positional lookup. It now indexes that collection directly. The internal
host type accepts an array-like collection; component-range snapshots, scheduling,
validation settlement, expression evaluation and event delivery are unchanged.

Independent Astra source review found no semantic blocker. A public renderer test
combines keyed elements, text and multi-node components, then inserts, reorders and
removes siblings while checking identity, edited values, focus, selection and
exactly-once cleanup. The affected 45 tests passed before and after the change.

The source-bundled Chromium experiment used the same installed dependencies and
Marionette runtime on both sides, one warmup each, and alternating before/after and
after/before pairs. Readiness required settled values and validation, expected
blocking counts, exact named values, DOM counts and stable public notifications.

| Fields | Validation | Samples per revision | Before median | After median |
| --- | --- | --- | --- | --- |
| 50 | required | 4 | 1,327 ms | 1,256 ms |
| 100 | required | 4 | 5,871 ms | 4,506 ms |
| 200 | required | 2 | 29,462 ms | 23,653 ms |
| 100 | none | 4 | 325 ms | 326 ms |

All four 100-required-field pairs improved by 20–26%; the median reduction was
23%. Fifty-field ranges overlap. Two hundred-field measurements varied widely
(before 27.4–31.6 s; after 18.0–29.3 s). These are fixture observations, not a
complexity proof or general performance guarantee. Large validated forms remain
slow. The 100-field probes still emitted exactly 1,101 public state notifications.

All 32 measured form journeys completed without browser errors. Four also checked
synthetic input/clear, retaining values, control identity and focus; they do not
establish trusted typing throughput. A separate CPU profile was excluded from the
timing table. Independent measurement review verified that the compared bundles
differed only in the intended executable expression and source comments.

Two earlier setup attempts are excluded: one accidentally selected the candidate
on both sides, and another failed dependency resolution before collecting trials.
Their receipts remain retained locally. No figures above come from those attempts.

Toolchain: Node 24.19.0, npm 11.17.0, FormKit Core-family 2.1.2,
Playwright 1.64.1, Linux headless Chromium 154.0.8037.57. This comparison uses
authored source bundles; package delivery is checked separately. No Pro control or
Vue/React performance comparison ran in this experiment.

On production source `c7dcad6d`, build, package ownership, nine packed-consumer
stages and all 18 native Chromium tests passed. Canonical coverage passed 2,766
tests plus one expected failure across 184 files, with unchanged thresholds and
all nine FormKit modules fully covered. A subsequent test-only commit
`a4654f77d24bff0aed457e919e74107b53f3076c` splits declarations to satisfy lint;
it leaves production source unchanged. On that commit, all 45 affected tests,
full lint, the public-test boundary and API-inventory checks passed. The original
lint failure is retained.

Actual-Pro rating/togglebuttons acceptance and minimal colorpicker diagnosis are
separate from this result. Earlier Pro touch/drag receipts retain their original
versions and source attribution; no full parity or online-license claim is made.
