# Literal FormKit component default normalization

New isolated branch `codex/formkit-component-defaults-20261114` starts at frozen `11aa0e06c81601287af3a0c68b1e40cc01e9b7f1`. Worktree: `/workspace/scratch/ea2cded971c5/formkit-component-defaults-20261114`. The 11aa benchmark/review worktree and fbc97910 publication checkout are unchanged. Mixed-composition/CI investigation was checkpointed separately at `81eb72c3cf9439f4c36371ee95cf36915e19bfb8` before switching to this priority blocker; that feature is not implemented here.

## Review and correction

Independent review approved the narrow conditional resolver correction at 11aa but held the combined tree for component-default regressions introduced by native literal-bind projection. The eight failures are four override values (type undefined/null, name null/empty) in Document and ShadowRoot. Exact reviewer reports and digests are in `review-provenance.json`. The existing 97/96 receipts did not cover or dismiss these failures.

Literal built-in FormKit declarations now carry private projection metadata. After evaluating explicit override precedence, their nullish type defaults to text and their falsy name normalizes to undefined for Core-generated naming. Explicit nullish type suppresses a bound textarea; it does not fall back to that bag type. Explicit null/empty name suppresses the bag's name rather than reusing it. Field projection and layout outlet lookup share the same name normalizer. Only `schema.mjs` and `schema-layout.mjs` change at runtime; no owner, opaque cache or validation guard was added. Standalone field-schema validation is unchanged and explicitly tested.

## Reproduction and results

From `experiments/formkit-react-patterns`:

```
node core/component-prop-defaults-test.mjs experiment document
node core/component-prop-defaults-test.mjs vue document
node core/component-prop-defaults-test.mjs react document
node core/component-prop-defaults-test.mjs experiment shadow
node core/component-prop-defaults-test.mjs vue shadow
node core/component-prop-defaults-test.mjs react shadow
node core/verify-free.mjs evidence/component-default-normalization/free-acceptance.json
node core/verify-free.mjs evidence/component-default-normalization/free-reference.json comparisons
```

`before-results.json` records exactly eight failures on the actual clean 11aa source, plus the passing undefined-name and actual peer controls. Each case checks exact teardown even on the failed mount. `focused-results.json` extracts the six actual final adapter/Vue/React Document/ShadowRoot fixtures: all five values per fixture now pass, with edit/Core/DOM retention across data-only, memo-only and Schema-only updates, explicit-key replacement, parent/root inheritance and exact node/registry/DOM cleanup.

Fresh combined results: **98/98 acceptance and 102/102 references pass**, including adjacent literal/anonymous/conditional/retention/key, slots, owner, provider, root, descriptor and lifecycle/teardown checks. Both reports have matching unchanged hashes for the 17-module runtime closure. `source-hashes.json` records parent/final hashes and receipt digests.

This is a new frozen candidate for independent rereview, not approval to integrate. No mixed-field runtime implementation, CI fix, release publication, merge/push, remote/base change, benchmark-fixture edit, performance claim, Mac test, security or credential change occurred. Existing opaque/default-child/provider and controller-local anonymous identity boundaries remain documented; whole `props: '$fieldProps'` strings are not added as common upstream syntax.
