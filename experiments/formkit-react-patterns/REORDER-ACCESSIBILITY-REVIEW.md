# Independent focus-preserving reorder review

Frozen core/index.mjs SHA256 `7ca2a5b1f59bf0941d94025bd7cbbc9b3bf2d3c5f41b8a3bfa149c65f9d733a3`.

Scoped JSDOM acceptance: the observed focus-loss defect is repaired across the tested ordinary reorder cases. Browser keyboard/IME evidence remains separate.

## Independent verification

- review/reorder-a11y-probe.mjs: unchanged fields, retained focused field reorder, sibling reorder, and moving focused ancestor group all preserve activeElement, selection range/direction, same input/Core node and value, with no focus event churn. Focused removal leaves control detached and does not refocus it. Exact output saved in review/reorder-a11y-7ca2a5b1.json.
- core/reorder-focus-test.mjs independently passes96 focused permutation reorders plus nested child+ancestor reorder, removal and destroy.
- review/placement-check.mjs: unchanged order has0root childList mutations; example actual reorder has2records and preserves focused input.
- core/submit-completion-test.mjs and review/pending-validation-teardown.mjs pass; no submission or pending-ledger teardown regression reproduced.

## Algorithm inspection

After reconciliation, code finds the retained sibling host containing document.activeElement and uses it as an unmoved pivot. It places desired siblings after and before that pivot using nextSibling checks. Nested reconciliation applies the same rule at each ancestor. No focus(), synthetic focus restoration, selection rewriting or moveBefore dependency is introduced. If focused field was removed, it is no longer a retained pivot; normal removal semantics apply.

## Limits

JSDOM cannot establish real Tab/Shift+Tab, viewport scroll preservation, accessibility-tree behavior, OS IME composition or real browser event sequencing. Avoid claiming these from synthetic composition events. The implementation avoids detaching the focused subtree, which is appropriate, but real-browser verification is still needed. No new unsupported callback-recovery requirements, source edits or publication actions in this review.
