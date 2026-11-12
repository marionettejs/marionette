# Independent extracted React bindings review

Source SHA256:
- extracted core/upstream-bindings.mjs `ce3dabc48acaf1d960784f1c4013ee7aaaef5e1ca9aaeba26a7d951d19f50ccd`
- installed published @formkit/react2.5.0 dist/index.mjs `6d2a1950a197355e2fe20536ee3809899160df05f13b3d03f11dd93868dc82c8`

## Fidelity and provenance

Selected source body (reactive store helpers and complete bindings initialization) matches published code except the declared class-observer ownership Set, kill-on-destroy, and explicit context.refreshClasses extension. React useReactiveStore hook is omitted, with imports/helper initialization/export plumbing adapted. Mechanical unified diff preserved in review/upstream-bindings-ce3dabc4.diff. core/LICENSE.formkit exactly matches installed upstream LICENSE; copyright header present.

This extraction retains upstream context states, props/messages, validation visibility, handlers, functions, class caching and flush behavior rather than the earlier minimal context. It does not include useInput, React reconciliation, schema evaluation, or component ownership. Correct extraction is not evidence that new direct DOM renderer uses every context contract correctly.

## Must-fix terminal regressions

Run `node review/upstream-bindings-probe.mjs`; result preserved in review/upstream-bindings-ce3dabc4-result.txt.

1. **Subscriber after owner destruction.** Register two context store subscribers; first destroys node; second still runs in same dispatch. Result laterSubscriberAfterOwnerDestroy=1 although stored subscriber set is cleared. The upstream snapshot forEach reintroduces the precise terminal-dispatch issue already fixed in old experimental store. Add terminal/membership checks in the extracted store, clearly recorded as an upstream adaptation, and test unsubscribe/destroy during dispatch.
2. **Class observer resurrection.** Retain context, destroy node, invoke new refreshClasses and read classes.input. The callback recomputes root classes once after destruction and the getter creates another observer. Result classCallsAfterDestroy=1. Kill-on-destroy alone is insufficient: guard refresh and class getter against terminal owner state; no new observers or notifications should be created through retained context after destruction.

No renderer integration, browser timing, performance, or complete lifecycle acceptance provided by this source review. Fix these narrow paths before freezing the integrated successor, retain adverse evidence, then independently rerun.
