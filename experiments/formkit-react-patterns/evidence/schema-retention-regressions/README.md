# Legal-bind retention and explicit-key identity checkpoint

Base reconstruction: `fbc97910c4ad4b7b47d01c0db57a69c32dc4ba49`. Previous focused commit: `80b7a88541eccd27eee6d4b03394ac6bbc86b5a5` (condition/name fixes, 95/95 acceptance and 87/87 references). Both changes are sequential commits on the sole-writer branch `codex/formkit-schema-regressions-20261114` in `/workspace/scratch/ea2cded971c5/formkit-schema-regressions-20261114`. The frozen publication checkout remains unchanged; no PR/base/publication operation is part of this work.

## Result

Compatible built-in literal FormKit declarations with legal string `bind` now reuse the existing field projection and owner map. Effective bound type/name/key are resolved at evaluation time, explicit props win, and an omitted type defaults to text. Stable named or explicitly keyed fields retain their Core owner, DOM and uncontrolled edits through Schema-only, memo-only, combined Schema/memo and data-only updates. No second interpreter or opaque-component state cache was added. Overridden factories and whole expression-bound props remain opaque.

Private anonymous fallback identities are now symbol metadata on declarations and only become a field key when needed for anonymous reconciliation; they are distinct from an explicit key. Named field reuse checks explicit key equality as well as type. Changing or removing an explicit key therefore replaces Core/DOM and the uncontrolled value, matching both pinned peers. An older mixed-layout fixture removed its key while asserting retention; it now keeps that key stable. The new test independently proves key-change and key-removal semantics in actual Vue/React. The earlier failed acceptance receipt is preserved as `before-retention-expectation-correction.json` and is not presented as a runtime defect.

## Commands and evidence

From `experiments/formkit-react-patterns`:

```
node core/schema-bind-retention-test.mjs experiment document
node core/schema-bind-retention-test.mjs vue document
node core/schema-bind-retention-test.mjs react document
node core/schema-bind-retention-test.mjs experiment shadow
node core/schema-bind-retention-test.mjs vue shadow
node core/schema-bind-retention-test.mjs react shadow
node core/verify-free.mjs evidence/schema-retention-regressions/free-acceptance.json
node core/verify-free.mjs evidence/schema-retention-regressions/free-reference.json comparisons
```

Final results: **96/96 acceptance and 93/93 reference checks pass**, with matching unchanged runtime hashes. These include the first-pair regressions and native mixed-layout/focus, repeated/default scope ownership, provider/library inheritance, Root/Schema lifetime, registry cleanup, submission and terminal teardown checks. `focused-results.json` extracts the six actual adapter/Vue/React Document/ShadowRoot fixtures from the final report. They cover 72 update/identity observations plus bound textarea/default type, explicit precedence/raw values, anonymous bound keys, loop lexical scope/reorder, Core parents, actual DOM roots and exact destruction/registry cleanup.

`before-results.json` uses the final fixture against untouched frozen fbc97910 through a narrow Node import hook: four expected adapter failures and eight successful peer controls. The same two failures were observed on 80b7a885 before implementation. `external-review-provenance.json` preserves the coordinator-provided independent 120-observation review's provenance/classification. That prior review is failure evidence, not 120 passing final parity checks. `source-hashes.json` maps all 17 transitive runtime files at fbc97910, 80b7a885 and the final source.

## Remaining boundaries

Non-container default-child bodies and provider-containing opaque scopes retain their existing factory lifecycle. A container whose type comes only from bind and has a default-child body remains opaque; explicitly declaring group/list type selects its native children projection. Anonymous declarations without a stable explicit key retain their existing controller-local identity across presentation replacement; no new unkeyed remount guarantee is made. `props: '$fieldProps'` is not added as common upstream syntax. These are cloud Node/JSDOM checks, not Pro/browser/device/accessibility/performance certification. No timing claim, Mac test, network workaround, security change, merge, push or deployment occurred.
