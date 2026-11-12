# Independent review: first React-pattern experiment

Verdict: useful runnable narrow proof of concept; not accepted for lifecycle robustness or architecture/performance selection yet. No browser or timing execution performed. No product/core/harness edits made.

## Frozen inputs

- core/index.mjs SHA256 `7056fcde7d8edeb94e430e0c20bf0a207d359ed1668eb1714c38d15cab405299`
- harness/check.mjs `10f706d1706dd403b91d210eb3301e99bcf1d701a0f8f668d5178a3effa0b1c1`
- harness/fixtures.mjs `94f8dd3dae8cd940deb49c88ec945e2c0e97c9f9288f29426b9552cf69af9ca1`
- harness/reference.mjs `8e4c9bb8559669dbe403e57760613de6f2df15390c1de9bae7ccd38229613ea6`
- PROTOCOL.md `f3f6f764885ecb67897965031790356145831ec47bf8f4154984a511a346b4d4`

## Independently reproduced failures

Run `node review/adversarial.mjs` from the experiment root.

1. **High: terminal ownership can be resurrected.** After `api.destroy()`, `api.setFields([{name:'z',label:'Z'}])` succeeds, creates one new child on the destroyed Core root, adds an input to the detached form and installs new subscriptions. Recorded fields=1, children=1, detachedInputs=1. Guard public topology/reset operations against terminal owner state; decide whether no-op or explicit error, then test both immediate and queued late calls. This contradicts the intended cleanup ownership contract even in the narrow supported slice.
2. **High: identifiers collide across forms.** Two live forms each with field `x` produce duplicate `experiment-x` and `experiment-x-rule_required` IDs. Labels/error IDREFs can resolve to the other form. Allocate a unique per-form ID prefix and preserve it through ordinary updates and explicit render. Add two-form assertions for unique IDs and owner-local label/message references.
3. **Medium: subscription dispatch continues after teardown.** A first subscriber calling `store.destroy()` does not prevent a second subscriber from executing in the same snapshot iteration. Repro reports afterDestroySubscriberCalls=1. The `dead` condition is checked only before entering the loop. Recheck terminal state before each subscriber, and define unsubscribe-during-dispatch behavior explicitly. The current single-paint subscriber reduces exposure but the exported store claims broader subscription semantics.

## Passing checks independently rerun

- `node core/test.mjs`: all 13 listed checks pass, including batching, queued notification canceled when destroy happens before dispatch, observer-driven class updates and explicit render refreshing a silent closure while retaining control identity.
- `node harness/check.mjs experiment 20`: listed structural/input/reset/dynamic/destroy checks pass.
- Parent's recorded Vue/React/experiment20/200/400 runs were inspected as prior evidence, not represented as independently rerun here.

## Harness and equivalence gaps

- Reset verifies one selected value/control only; dynamic add/remove verifies DOM count only. It does not establish all Core values/errors, removed node destruction, registry cleanup, or absence of retained observer callbacks.
- Validation test establishes the required-message count at mount, not exact per-field expected text/state after typing/external/reset. IDREF existence is checked globally rather than association to the correct field. Add exact owner-local assertions.
- Shared classes are static. The harness does not compare observed class callback invalidation or cross-field dependencies, central to the proposed architecture.
- Current adapter arm is absent, explicitly acknowledged in protocol. Do not claim comparison of both adapters until frozen current-source provenance and arm exist.
- The experiment is a hand-written flat text renderer on a Core group. Vue/React use upstream form definition/features and schema machinery. The protocol properly discloses this; a faster result here cannot show equivalent form performance. Expand semantics or separate overhead/capability conclusions.
- Synthetic input/change events and JSDOM do not prove real keyboard, browser focus/selection, layout, paint, touch or accessibility. Preserve the current prohibition on speed conclusions.

## Recommended next coherent revision

Fix the three lifecycle/identity failures, extend the shared checks for exact validation/reset/topology and tracked classes, then re-review. Keep this prototype isolated and explicitly experimental. Do not retire current adapter code or tests based on these results.
