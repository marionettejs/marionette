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
The same three Pro cases still need replay on this cleanup candidate. Shared
reference-side palette/normalization failures and historical broader Pro acceptance
remain separately attributed. No full parity or online-license-validation claim.
