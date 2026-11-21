# Single checkbox independent review

Frozen SHA256 index `ea4d5d62aff3747847139d491fbd219654ae3a8858c5916b6e8ca801bf45305c`; renderer `f182cf7e452e1f2577503d3b294f8f3f566aa874440119c9ace7be944b9c01c1`.

## Finding

`setFields` silently ignores changed `onValue`/`offValue` for retained checkboxes. `review/checkbox-update-probe.mjs` declares YES/NO then Y/N; same node/input retained but click still emits YES and Core onValue stays YES. `field.update` only writes label/help/disabled/validation/visibility. Apply notified mapping changes or explicitly reject them if unsupported; do not silently accept inconsistent spec and behavior. This is ordinary declared configuration, not callback rollback/recovery.

## Verified scope

- Independently reran upstream Vue/React fixture, adapted same fixture to candidate (`review/checkbox-parity-candidate.mjs`, JSON alongside): optional absent value stays undefined, default boolean toggles, custom YES/NO, public Core input updates checked property, required false passes while accepted absent fails, reset restores absent/custom initial values, unmount removes controls.
- `review/checkbox-lifetime-probe.mjs`: help/error nested conditional ARIA transitions, disabled click, removed captured control has inactive input/click listeners, all owned nodes destroyed.
- Reran `core/checkbox-test.mjs`, `core/submit-completion-test.mjs`, `core/nested-slot-test.mjs`: pass. Includes nested checkbox, remove/readd, option-array rejection before mutation.
- Recursive conditional attribute branch owns and removes its own effects; checked writes live property, not only attribute.

Fixture corrections: adapted candidate initially looked up hardcoded root ID, but candidate generates ID; changed fixture to retain public returned node. Disabled→enabled probe initially clicked before async binding flush; after ordinary tick it passes. These were harness errors, not implementation defects.

No core edits. No claim of full schema parity, themed decorator/icon visuals, native keyboard Space, browser scrolling or IME. Browser scroll/reorder issue is separate outstanding work. Scoped native checkbox acceptance is conditional on resolving explicit mapping-update gap.

## Correction re-review: accepted for this native slice

Index SHA256 `660b148fe7f4535d781de32cdd7e3a65b632ce1cdac3b0f608dd8a236f6cb496`; renderer remains `f182cf7e452e1f2577503d3b294f8f3f566aa874440119c9ace7be944b9c01c1`.

Original `review/checkbox-update-probe.mjs` now emits Y after YES/NO→Y/N, preserving Core and input. Independently reran `core/checkbox-update-test.mjs`: existing value remains uncoerced, checked state updates, next click uses new mapping, falsey scalar 0/null retained, omitted overrides normalize true/false. Both upstream `core/checkbox-prop-parity.mjs vue|react` runs confirm explicit-change parity and differing omission semantics (Vue clears, React retains). `core/README.md` explicitly identifies default normalization as adapter policy, not common upstream parity.

Candidate shared parity fixture, lifetime/IDREF/disabled probe, writer checkbox and nested-slot tests pass again. This resolves the mapping finding. Scoped acceptance for branch/browser testing only; no theme, trusted keyboard, browser scroll or full-feature parity approval. No runtime source edits by reviewer.
