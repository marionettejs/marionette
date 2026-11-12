# Callback contract reassessment

## Correction to my earlier review

I previously treated destruction inside a class callback and inside pre-submit callbacks as required terminal-safety cases, then required increasingly specialized recovery. That conclusion was not grounded in a verified public contract. The repository AGENTS.md says synchronous callback failures do not imply rollback or attempt-all cleanup, and to distinguish supported regressions from a new recovery feature. Passing a newly invented adverse test does not establish that feature was required.

## Verified upstream evidence

Published FormKit2.5 Core types define FormKitClasses as a function producing CSS classes and rootClasses as allocating base section classes. They do not promise arbitrary destructive lifecycle actions during evaluation or recovery from user callback exceptions. The published observer.watch synchronously evaluates the block and then stopObserve/applyListeners; it contains no terminal checks, catch/recovery, or rollback contract. Vue/React class-cache evaluation follows that pattern.

I ran equivalent component-level destructive class callbacks in Vue and React2.5 (review/class-upstream-destruction.mjs; retained logs). Both happened to complete with empty hosts and no collected errors. This is observed behavior, not a documented guarantee. The published bindings do not use our added class-observer ownership Set/kill path; therefore their not throwing does not prove our new watch helper is required for parity. Do not describe upstream as explicitly prohibiting the behavior either: no such prohibition was verified.

Normal valid-submit completion is materially different from class computation. review/submit-completion-upstream.mjs tests onSubmit synchronously unmounting, returning undefined or an already-resolved Promise. Both modes complete without rejection in both Vue and React. This is the ordinary submit/navigation/completion path we should preserve.

Earlier-stage onSubmitRaw unmount behaves differently: review/form-reentrancy-parity.mjs reproduces clone(null) failure in Vue; React does not reject in that probe. The official handler continues through validation/payload preparation after raw callback. A guaranteed terminal-cancellation protocol here is not a shared verified upstream contract.

## Minimal recommended correction

1. Restore published observedNode.watch for class caching. Remove class-watch helper and the five assertClassAlive checks from the extraction transform/source. Remove destructive-class tests as acceptance gates; retain historical results marked exploratory, not required behavior.
2. Keep ordinary owner cleanup of observers, store subscriptions, DOM listeners and nodes, normal post-destroy public-method guards, tracked class invalidation and explicit refresh behavior. These are resource ownership, not a promise to recover from callbacks that destroy the evaluation owner. Do not defer teardown merely to satisfy the rejected callback test.
3. Remove the private terminal-submission sentinel and callback wrappers unless a separately demonstrated supported workflow actually requires them. Use official callback behavior and retain the default no-op submit when none is supplied. Do not turn all raw-submit destruction or destroy-during-settlement cases into guaranteed cancellation semantics.
4. Preserve tests for ordinary invalid/valid submission, async loading/disabled/reset, normal onSubmit-driven unmount/navigation, destruction while a previously returned async submission settles, and unmodified user exception/rejection propagation. Re-run these after simplification, because successful upstream tests alone do not verify our adapter integration.
5. Update docs/reviews to withdraw broad callback-recovery claims. A callback deliberately violating an operation's lifetime can fail without rollback/attempt-all cleanup guarantees. Continue to fix ordinary unsupported-input validation/resource ownership bugs proportionately; don't erase those fixes merely because a different adversarial callback feature was unnecessary.

No source changes made. This recommendation is scoped to removing unverified reentrancy/cancellation guarantees, not removing ordinary lifecycle cleanup or claiming all callback failures are harmless.
