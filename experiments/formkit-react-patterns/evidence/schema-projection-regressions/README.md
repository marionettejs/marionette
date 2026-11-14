# Schema condition and anonymous-name regression checkpoint

Baseline: exact `fbc97910c4ad4b7b47d01c0db57a69c32dc4ba49`. Implementation branch: `codex/formkit-schema-regressions-20261114`, isolated worktree `/workspace/scratch/ea2cded971c5/formkit-schema-regressions-20261114`. The frozen publication checkout is unchanged.

String conditions now use the official expression compiler for constants as well as token expressions, including conditional prop objects. Inactive required fields no longer allocate/render/block submission. Layout declarations receive a shared private fallback key even when an explicit name expression resolves to undefined; generated Core names and controls remain stable for data-only updates. Adding that key preserves original declaration descriptors. Named reconciliation and explicit keys retain their existing contracts at this checkpoint.

## Reproduction and verification

From `experiments/formkit-react-patterns`:

```
node core/schema-condition-projection-test.mjs experiment
node core/schema-condition-projection-test.mjs vue
node core/schema-condition-projection-test.mjs react
node core/schema-dynamic-name-layout-test.mjs experiment
node core/schema-dynamic-name-layout-test.mjs vue
node core/schema-dynamic-name-layout-test.mjs react
node core/verify-free.mjs evidence/schema-projection-regressions/free-acceptance.json
node core/verify-free.mjs evidence/schema-projection-regressions/free-reference.json comparisons
```

Final results: **95/95 free acceptance, 87/87 reference checks passed**, including both new fixtures and relevant mixed-layout, identity/focus, scope/subtree ownership, mounted/removed/repeated lifecycle and terminal teardown tests. Both reports agree on all runtime hashes and confirm they stayed unchanged during each run. `source-hashes.json` records baseline/final hashes.

`before-results.json` records the final regression fixtures run against the untouched baseline through a narrow Node import-resolution hook. Both fail before implementation; the final adapter and installed Vue/React arms pass. `submission-before-after.json` additionally records the original no-else reproducer: before, one required field is rendered and submission is invalid; after, zero fields are rendered and submission succeeds. The intermediate descriptor-failure log records a rejected implementation edge, corrected in the final runtime.

## Scope and limits

This checkpoint fixes only the false-condition and anonymous-name findings. Explicit name/key changes are tested through shared keyed remount semantics; no new unkeyed peer rename guarantee is claimed. Whole-bound `props` expressions are not added as portable schema syntax. The separately queued legal-bind/explicit-key retention findings are not corrected by this checkpoint. No Pro/browser/device/performance certification, Mac test, remote operation, merge or publication occurred.
