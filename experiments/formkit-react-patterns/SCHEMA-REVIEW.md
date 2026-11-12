# Independent narrow schema and terminal-submit review

Frozen SHA256:
- core/schema.mjs `36115e063986cc28e266b3ad9af827574a8122ab6608233c3d6dbf7a376ce864`
- core/index.mjs `39ab2474b1e85b94a934d8334ea91aa88964e7159f906f40eebb6cd54c45a35e`

## Schema verdict

Accepted for the tested explicitly restricted conditional text-field projection. No new must-fix defect reproduced in this scope. This is not general FormKitSchema parity.

Independently ran:
- `node core/schema-test.mjs`: then/else swap, retained toggle control, removed Core child/value cleanup, explicit controller destroy, unsupported forms rejected, owner destroy.
- `node harness/schema-check.mjs` for **each** of vue, react, current and experiment: all pass conditional hidden→shown→removed→re-added, retained toggle identity, fresh conditional Core node and empty value after re-add, and destroy.
- `node review/schema-probe.mjs`: queued update canceled by explicit controller destruction and owner destruction (one initial callback only); destruction inside initial onFields callback marks controller destroyed and cancels queued work; malformed expressions reject with official E104; unsupported root dependency rejects TypeError. Output preserved in review/schema-result-36115e06.json.

The controller correctly uses official compile/provide and observer APIs. Initial application is synchronous; later applications coalesce to a microtask, deduplicated by projected field signature. Cleanup kills the observer and removes its owner receipt.

## Deliberate restrictions and evidence limits

- Only literal text fields and conditionals over `$values.<always-present-top-level-field>` are allowed. Nested data, $get, slots, loop/schema expressions, arbitrary components, dynamic props and field-name reuse across mutually exclusive branches are rejected. These restrictions must stay visible.
- Dependency reads observe root value; this does not demonstrate fine-grained leaf invalidation, bounded schema traversal, or performance parity. The whole projection can reevaluate on root value updates even when signature avoids DOM changes.
- The shared upstream fixture supplies root values through explicit subscription. Passing it establishes these specific conditional semantics, not automatic support for arbitrary upstream reactive data.
- Exception handling for arbitrary user onFields callbacks after asynchronous projection, constructing a controller on an already destroyed owner, and broad reentrant schema mutation are not accepted by this review. Current adapter-owned setFields is the tested consumer.
- No browser rendering, timing, heap/leak measurement, or full schema claim.

## Terminal-submit fix independently rechecked

At core39ab2474, unchanged review/form-async-stack.mjs no longer rejects after raw callback destruction; valid callback remains uncalled. Async destruction followed by resolution still leaves no children/DOM.

Independently reran core/submit-terminal-test.mjs: all5 regressions pass, including destruction during awaited settlement and preservation by identity of synchronous callback errors, asynchronous rejection, and rejection from a destroying submit callback.

The private per-owner sentinel is caught only by the owned submit boundary, not by error type or broad post-destroy suppression. The previously reported raw-destroy continuation issue is accepted as repaired on these paths. Direct invocation of upstream context handlers is not the same owned boundary; do not advertise it as equivalent public submit API. Other lifecycle/context limitations from FORM-REVIEW.md remain.
