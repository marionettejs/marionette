# Independent official-root-form review

Frozen core/index.mjs SHA256 `ac8a1013782523e79d37c36c4da948bc6e353af81caaf887fefaef7f18ac579a`; section-renderer.mjs `76dd41924a1e653a2adc4befc9267d435ffcfe041a58c316184b2355c4a643c1`.

## Result

The ordinary official form/default-slot/message integration works on the independently exercised cases. One concrete callback-teardown edge remains; no broad lifecycle acceptance or performance conclusion.

## Independently executed

- core/root-schema-test.mjs: one reused form, official classes/attrs precedence, incomplete message schema/id/type, stable default-slot child, async loading/disabled state, reset, matching observed Core creation/destruction counts.
- core/submit-terminal-test.mjs: all five terminal cancellation and preserved user-error regressions pass.
- core/sections-test.mjs and core/precedence-test.mjs pass.
- Existing review/form-async-stack.mjs: pending submit disables root/child/DOM; destroying then resolving produces no recreated children/DOM; raw callback destroy cancels continuation without error.
- Existing review/form-reset-async.mjs: snapshot remains submitted edit; reset returns initial Core/DOM value while pending; later completion clears loading and reenables input.
- New review/root-messages.mjs: root error message replacement/removal, root attrs mutation/replacement precedence, retained input through messages and repeated render, single root form, teardown pass.

An initial attempted filename core/root-form-test.mjs was absent; actual root-schema-test.mjs above was discovered and run. No source files edited.

## Remaining concrete defect

Run review/root-adverse.mjs. A configured form class callback calls instance.destroy() while explicit form.render() refreshes classes. Destroy kills/revokes the active observer; the class evaluation continues and accesses observed.config, producing `TypeError: Cannot perform 'get' on a proxy that has been revoked` at upstream-bindings.mjs:206. Full stack/result saved in review/root-adverse-ac8a1013.json. Final owner remains destroyed, isRendered false, children0, empty host: no resurrection observed, but public render throws on an otherwise legitimate terminal action.

Avoid continuing a class evaluation after a user callback terminates its owner. Coordinate observer disposal with an active evaluation or introduce explicit terminal continuation checks; do not broadly swallow TypeError since genuine user callback errors must still propagate. Also recheck owner after root renderer refresh before continuing render lifecycle. Add a focused regression for destroy inside form and field class callbacks, with immediate teardown and original user exception behavior retained. No fix made here.

## Scope boundaries

Root rendering now consumes the actual official form schema; this is not a hand-coded message-list equivalence claim. The reused Marionette form and default-slot anchor are adapter ownership integrations, and each text field still has an extra host. Custom root slots/action components, nested groups, arbitrary components and broad schema behavior remain deferred/documented. Root slot toggles outside this fixed internal default slot were not accepted. Renderer/Core counters are not elapsed time, retained-memory measurement or exhaustive whole-work proof.

## Independently verified terminal-class correction

Frozen hashes:
- index `d72a81739a576a56df7daff5d688710ae7d66b45fa29a1fc7fb31beb5cdf5ebc`
- renderer `653f246b4fd654813db919bef8ec72b2c2c9d55a7a8f5aa58ad49521977a67a9`
- extracted bindings `c79d77fdd84198cde10f2768624465bdbc85102d7ae5ba77ba68ab8800aa291a`
- class-watch helper `1679729c346b301637ceb855e63f9f41b88c4ca8986f3c888031f9b2836369dd`

Unchanged root-adverse reproduction now returns destroyed=true, rendered=false, children0, empty host with no thrown error. Corrected output retained separately. All3 core/class-terminal-test.mjs regressions independently pass: root callback destruction, notified field callback destruction, original user error identity preserved.

Helper inspection: observer.observe returns an old dependency copy; helper synchronously evaluates, checks isKilled before stopObserve/applyListeners, catches only a private terminal sentinel, and rethrows other exceptions. Extracted class computation checks terminal state after user-controlled class phases. Teardown remains immediate; it does not postpone node/DOM destruction. Renderer rechecks dead state after token reads, and render checks terminal owner after root and field refresh. No broad TypeError suppression found.

New review/class-watch-probe.mjs verifies dependency switching removes the old property listener, the new dependency updates, kill empties receipt storage, and later property changes do not call the block. This is a focused subscription test, not exhaustive retained-heap proof.

Independent reruns of core/extract-bindings.mjs, core/root-schema-test.mjs, core/sections-test.mjs and review/root-messages.mjs pass. The original terminal-class defect is accepted as repaired on these paths. Broader schema/component behavior and timing remain outside this verdict.
