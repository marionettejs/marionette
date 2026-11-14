# Independent-review correction: conditional identity lookup

Parent/source before correction: `a87dd4a01e0df4315770121c74e132e4764d3d82`, on isolated branch `codex/formkit-schema-regressions-20261114`. The frozen reconstructed publication checkout remains unchanged at `fbc97910c4ad4b7b47d01c0db57a69c32dc4ba49`.

The independent review requested changes on `80b7a88541eccd27eee6d4b03394ac6bbc86b5a5`: field projection compiled string conditions, but the separate layout conditional-prop resolver still treated an unprefixed `false`/arithmetic string as truthy. A conditional name therefore allocated its else field but requested its then name and threw. The same mismatch was reproduced on the later a87dd4a source. Earlier passing 95/87 and 96/93 suites did not cover this case and are not evidence against the finding.

## Correction

Only `core/schema-layout.mjs` changes at runtime: conditional-object identity resolution normalizes string `if` expressions in the same manner as field projection before selecting a branch. Ordinary string props remain literal, expression branches continue resolving with the current lexical scope, and name/key lookup now agrees with the allocated owner. No fallback/guard, new field owner, second interpreter or unrelated behavior change was added.

`schema-conditional-identity-test.mjs` has 28 mount scenarios in each of the actual adapter, Vue and React arms. It covers sugar, literal FormKit props and legal-bind explicit overrides; false/true, arithmetic, prefixed and dynamic conditions; conditional labels/placeholders; nested conditional anonymous keys; dynamic keyed-name replacement and retained identity; conditional native-group ownership; and exact Core/registry/DOM cleanup.

## Evidence and commands

```
node core/schema-conditional-identity-test.mjs experiment
node core/schema-conditional-identity-test.mjs vue
node core/schema-conditional-identity-test.mjs react
node core/verify-free.mjs evidence/conditional-identity-review-correction/free-acceptance.json
node core/verify-free.mjs evidence/conditional-identity-review-correction/free-reference.json comparisons
```

Run from `experiments/formkit-react-patterns`. `before-results.json` records the fixture failing on actual clean a87dd4a source with `Missing owned layout field: thenField`, while both peers pass. `focused-results.json` records all three arms passing after correction. `review-provenance.json` preserves the source/digests and request-changes classification of the supplied independent 24-probe/12-regression review.

Final combined results: **97/97 acceptance and 96/96 reference checks passed**, including all earlier condition/name/bind/key regressions plus relevant mixed-layout, provider/Root/Schema, lifecycle and teardown checks. Both reports have matching 17-module hashes and `runtimeUnchanged:true`. `source-hashes.json` records each parent/final runtime hash; only schema-layout differs. This is a new rereview candidate, not independent approval.

Cloud Node/JSDOM only. Existing opaque/default-child/provider and unkeyed-anonymous controller-local identity limits remain. No frozen-checkout edit, integration, remote/base change, push, merge, publication, timing change, Mac test or security/credential operation occurred.
