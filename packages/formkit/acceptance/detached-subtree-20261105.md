# Retained subtree cleanup verification

Tested candidate: `901c16407e3c8b59bb225064f934a814de6780b7`.
Production repair: `3e49fc38ee9a47eb284377ea980df12920179014`.
Red regression commit: `4f219a6b975de92cb632e2f7a260de6f8d4e7998`.

Removing a generated panel previously removed each descendant individually. A
control retained by an already-started callback consequently lost its parent;
ordinary delayed DOM reads could throw after selection had already committed.
The repair releases descendant listeners and component resources while removing
the outgoing subtree root. Adopted forms still clear owned contents, and each
component retains authority over its own teardown. Scheduling, validation,
submission, cancellation and exception propagation are unchanged.

Before repair, five public unit cases failed, and a trusted Chromium click failed
with a null-parent `dataset` read. The native custom input commits a choice, closes
its panel and then completes a delayed DOM read. No Pro code or dependency is used
by this reproduction. Guards also cover condition/schema removal, destruction,
HTML replacement, retained-event cleanup, reset values and component destruction.
Two independent Astra source/oracle reviews found no blocker.

On the exact candidate, a clean detached worktree passed:

- Build and canonical coverage: 2,771 passed plus one expected failure across
  185 files; unchanged limits and thresholds, all nine FormKit modules fully covered.
- Package ownership and all nine packed-consumer stages.
- All 19 Chromium tests, including repeated pointer selection/close/reopen,
  delayed callback completion and retained-event cleanup after reset/destruction.
- Full lint, public-test boundary and API-inventory consistency.

The same source's 95 focused tests also passed in the persistent checkout. Two
full coverage runs there failed with five and four timeouts in application-lifecycle
and runtime suites. An isolated instrumented replay passed all 52 tests in those
files; its overall exit remained nonzero because repository-wide coverage thresholds
were intentionally retained. Monitoring found no OOM but did not establish a cause.
The published baseline's archive comparison had no test timeouts but could not pass
its catalog suite without Git metadata. The final clean worktree supplied real Git
metadata and passed the unchanged canonical command. Earlier failures are preserved;
their persistent-checkout cause remains unresolved and is not labeled environmental.

Toolchain: Node 24.19.0, npm 11.17.0, Core-family 2.1.2,
Playwright 1.64.1 and installed Linux Chromium 154.0.8037.57.

Independent Pro QA on earlier `af59f37bc3abc01dbd5d9504874a07afa56c02d1`
(production `b94e9892`) confirmed rating 28/28 and togglebuttons 68/68. Minimal
colorpicker remained 1/3: default selection passed; full and swatch-only auto-close
set the value and closed, then failed the retained-parent read. These are coordinator-
reported results for Pro 0.130.4/Core 2.1.2; raw QA artifacts were not transferred.
Independent vault QA subsequently reported acceptance on exact published
`7b38043fa46d85ba62b93b6a6e31af28585a820d`, with unchanged production source
`3e49fc38ee9a47eb284377ea980df12920179014`:

| Primary checks | Passed |
| --- | --- |
| Original minimal colorpicker cases | 3/3 |
| Rating | 28/28 |
| Togglebuttons variants | 68/68 |
| Colorpicker lifecycle | 31/31 |
| Targeted desktop | 8/8 |
| Release/repeater groups | 8/8 |
| Slider/repeater touch | 6/6 |
| Retained-popup cleanup | 6/6 |

All 158 primary assertions passed, none skipped. The original auto-close failures
were resolved without browser exceptions. Retained descendants kept their parents
while detached listeners released. Supplementary shared-reference checks remained
5/6: named Green after closing may remain literal rather than normalize; that also
occurs in references. This is distinct from the repaired retained-parent failure.

This is independently reported QA, not locally executed or raw-artifact-verified
by the writer. Versions: Pro 0.130.4, Core-family 2.1.2, drag-and-drop 0.6.3,
Chromium 154.0.8037.57. QA reported a passing credential scan and cleanup. Two
proxy tunnel failures had no retained targets; online license validation remains
unverified. No network retry or full parity claim is made. Historical results and
later compilation candidates retain their separate source attribution.
