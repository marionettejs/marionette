# Independent form-feature review

Frozen core SHA256 `fd68608e2495feb39ec1cbc94b627bade5a682badc8de322fc9a4ec42b05e795`.

## Verdict

Official form/text definitions are now used, and the tested ordinary submit/reset/async completion paths work. This is useful progress from the earlier Core-group-only prototype, not full context/schema parity or broad lifecycle acceptance. No browser/timing run was performed.

The requested `checkpoints/e7c25f21` directory was absent in this executor, so no filesystem diff against it was possible. I inspected the current full source against the exact prior source read during my earlier review. The relevant additions are library definitions, minimal featureContext, submit listeners/promise exposure, root messages, terminal reset guard and form node creation.

## Independently executed checks

- `node harness/submit.mjs experiment 3`: invalid submit blocked; valid three-field payload; reset validation restored.
- `node review/form-async.mjs`: valid async handler called once; while pending, root/child props and actual input disabled all true; loading present. Destroy before handler resolution, then resolve: no exception, children0, empty host, loading cleared, context null. No retained subscription/heap claim follows.
- `node review/form-reset-async.mjs`: submitted payload preserves `edited`, reset restores initial Core/DOM value while promise remains pending; after resolution, input enabled and loading cleared. Submitted state reset false. Output retained in separate fd68608e JSON files.

## Concrete reentrancy risk

When `onSubmitRaw` synchronously destroys the form, `submit()` rejects with `TypeError: Cannot convert undefined or null to object`. No valid-submit callback runs. Repro is the second case of `review/form-async.mjs`.

I checked upstream rather than assuming this was an adapter regression: `node review/form-reentrancy-parity.mjs vue` reproduces the same TypeError in FormKit Vue2.5.0; the React2.5.0 equivalent did not reject in this test. The official inputs `handleSubmit` continues using the node after the raw callback. Therefore inheriting upstream features does not automatically solve lifecycle reentrancy. Document this as an inherited risk or guard the narrow adapter-owned callback continuation without silently suppressing unrelated user errors. Retain a destroy-inside-raw-submit regression if this is to become a supported flow.

## Remaining capability/context caveats

- `featureContext.state` remains an empty object even during/after these submissions. Upstream binding state such as valid/loading/disabled/submitted is not projected into context. Node props/store and the hard-coded renderer work for the tested slice, but callbacks/schema/class code reading standard context.state cannot be called equivalent yet.
- The renderer still manually owns form/text DOM and listens to a selected event set. Using official definitions/features does not introduce the upstream schema interpreter or full context plugin.
- Root message display checks, submit errors/rejections, callback destruction at additional boundaries, stale async completions with new submissions, browser native submission, and cleanup instrumentation remain outside this narrow acceptance.
- Prior shared-harness caveats remain unless separately corrected and verified. This review did not rerun the entire evolved four-arm suite.

## Next focused step

Keep the official-definition change as an experimental checkpoint. Add explicit tests for the declared context-state contract and raw-submit destruction before asserting feature parity. Do not infer speed, full React behavior, or retirement of the existing adapter from this checkpoint.

### Exact failure and correction boundary

Full stack preserved in `review/form-async-stack-fd68608e.json` (repro script `review/form-async-stack.mjs`). After `onSubmitRaw` destroys the owner, official `@formkit/inputs/dist/index.mjs:828` evaluates `clone(node.value)`; the destroyed node's value is null, and `@formkit/utils/dist/index.mjs:284` calls `Object.keys(null)`. The failure happens before `onSubmit`, not during DOM teardown.

A normal-return wrapper around onSubmitRaw alone cannot stop official handleSubmit from continuing. Nor is catching arbitrary post-destroy TypeErrors acceptable: that would suppress real user/upstream failures. A narrowly scoped adapter boundary can preserve immediate destruction and callback order by invoking the original raw callback synchronously, checking terminal ownership immediately afterward, and aborting only that continuation with a private identity sentinel consumed by the adapter's submit promise boundary. User-thrown errors must remain distinct and propagate; the valid-submit callback must not execute after destruction. This is a proposed narrow mechanism, not implemented or accepted here. It must also cover the no-user-raw-callback case and destruction caused by submit-raw listeners, without delaying destroy. A separately owned submission coordinator with explicit terminal checks is another option, but copying the whole upstream submit algorithm brings additional parity maintenance.

Required regression: raw callback destroys owner; submit resolves as canceled/terminal according to documented adapter contract, DOM and Core stay destroyed, valid callback never runs, and a deliberate user error from raw callback still rejects unchanged. Expand to destruction inside other callback boundaries separately rather than treating this one guard as complete lifecycle safety.
