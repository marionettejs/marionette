> SUPERSEDED: root-first scope verdict below was incomplete and is withdrawn. It missed pending ledger settlement and suppressed deep lifecycle observations. See TEARDOWN-CORRECTION-REVIEW.md; only corrected child-first Core cleanup is accepted.

# Independent whole-form teardown review

Frozen index SHA256 `2338c528f34fdd97e09a22037f7f9d1741b0ca7d78d976355c5b330391240ec8`; renderer `955c491c8405f2977cedc41ba19708cf7d7e77f19bab2f6bf3694bf438036dcd`.

## Scoped verdict

The parent-first terminal Core teardown and bulk DOM clear pass the supported workflows exercised here. No new defect reproduced. No unsupported destructive-callback recovery requirement imposed.

## Independent verification

- core/teardown-test.mjs:200/400 fields each destroy201/401 nodes, deregister all captured IDs, show0 observed root commit events during teardown and1 root childList clear record. Live field removal still commits and preserves retained sibling/value.
- New review/nested-teardown.mjs: two nested groups and a cross-field help slot destroy in form→outer→inner→x order exactly once. All IDs deregister, captured context subscriber sets empty, double destroy unchanged, dispatching input/blur on captured detached controls has no later metrics activity. Marionette events observed before:detach→detach→destroy. Raw result retained separately.
- core/nested-slot-test.mjs and core/submit-test.mjs pass.
- core/submit-completion-test.mjs passes ordinary supported submission completion/error cases.
- review/form-reset-async.mjs confirms reset during pending submission keeps submitted snapshot and initial reset value; later completion restores loading/disabled state.

An attempted obsolete core/submit-terminal-test.mjs filename was absent after deliberate retirement; its unsupported-cancellation cases were not reinstated as requirements.

## Inspection

Renderer destroy(false) still unsubscribes context notifications, removes DOM event listeners, clears effects and runs nested slot cleanup; it skips only physical node removals. Slot cleanup propagates the removal flag while killing observers. All field view/subscription resources dispose before any Core node destroys. Parent Core destruction precedes recursive child destruction on terminal whole-form path; maps clear and one root replaceChildren follows. Live-field path retains child-first Core cleanup and ordinary DOM removal. Marionette itself owns final detach/destroy. There is no delayed teardown or new callback recovery path.

## Limits

Observed event and mutation counts are not proof of every internal Core operation, absence of all retained heap references, or browser performance. Counter claims must retain their explicit boundaries. Nested groups/slots tested here do not establish general component or list support. Callback exceptions still have no rollback/attempt-all cleanup guarantee. This review changes no core source and performs no push.
