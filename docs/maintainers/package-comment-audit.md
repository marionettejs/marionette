# Companion source comment audit

This September 2026 pass inspected the comment text throughout the 31 authored
TypeScript files under the four companion packages, checking relevant surrounding
implementations and declarations. Files without comments remain in the inventory.
This is a comment accuracy audit, not a claim that every runtime branch was tested.

## Reviewed files

- `packages/adapters/src/data/backbone.ts`
- `packages/adapters/src/data/internal/keyed-snapshot.ts`
- `packages/adapters/src/data/xstate.ts`
- `packages/adapters/src/dom/jquery.ts`
- `packages/adapters/src/dom/lit-html.ts`
- `packages/adapters/src/dom/morphdom.ts`
- `packages/data/src/api.ts`
- `packages/data/src/collection.ts`
- `packages/data/src/index.ts`
- `packages/data/src/model.ts`
- `packages/radio/src/debug.ts`
- `packages/radio/src/index.ts`
- `packages/radio/src/radio.ts`
- `packages/radio/src/requests.ts`
- `packages/utils/src/bind-events.ts`
- `packages/utils/src/bind-requests.ts`
- `packages/utils/src/build-event-args.ts`
- `packages/utils/src/call-handler.ts`
- `packages/utils/src/error.ts`
- `packages/utils/src/events.ts`
- `packages/utils/src/extend.ts`
- `packages/utils/src/get-option.ts`
- `packages/utils/src/get-value.ts`
- `packages/utils/src/index.ts`
- `packages/utils/src/is-string.ts`
- `packages/utils/src/merge-options.ts`
- `packages/utils/src/normalize-methods.ts`
- `packages/utils/src/once-wrap.ts`
- `packages/utils/src/set-property.ts`
- `packages/utils/src/trigger-method.ts`
- `packages/utils/src/unique-id.ts`

## Corrections

| Source | Correction |
| --- | --- |
| `packages/utils/src/bind-events.ts` | The target is the receiver, followed by entity and bindings. Values are a single method/function; space-separated keys name multiple events. |
| `packages/utils/src/bind-requests.ts` | The target is the receiver, not a first positional argument. Unbinding without a map removes replies for that receiver. |
| `packages/utils/src/events.ts` | `off` combines supplied filters; omitting an event name does not discard callback/context filters. Once listeners are removed before invocation. A thrown callback stops synchronous dispatch. |
| `packages/utils/src/trigger-method.ts` | Colon conversion matches segment initials; method names are cached per event. The option/method runs before the event, its exception prevents that event, and its result is returned without awaiting. |
| `packages/utils/src/get-option.ts` | Only a non-undefined option takes precedence over the receiver property. |
| `packages/utils/src/call-handler.ts` | Described the actual argument-count specialization rather than an unmeasured speed claim. |
| `packages/radio/src/requests.ts` | Constant replies retain their original value for removal matching; removal also filters callbacks/context. Exact replies precede default replies. |
| `packages/radio/src/radio.ts` | Tune-in logging uses configured hooks, which need not write to the console. |
| `packages/adapters/src/dom/morphdom.ts` | Empty-root initialization populates its contents; the root itself is retained. |

Native Model/Collection constructor/type comments, relational ordering and id
equality, subscription cleanup, Backbone event normalization, and Lit teardown
comments were checked against their corresponding operations. No runtime edits
were needed for these companion comment corrections.

## Evidence and boundaries

TypeScript parsed/printer comparison with comments removed matched `HEAD` for all
63 core and companion source files after the comment pass. The subsequent,
separate child-event map correction in `src/mixins/view.ts` changes runtime behavior
and is covered by `test/unit/child-event-map-ownership.spec.js`; it is not included
in the comment-only claim. The original reproduction failed for both View and
CollectionView before the fix. Six relevant suites passed 123 tests afterward.

The core-file inventory is in [the core audit](./source-comment-audit.md).
Documentation page audits and installed-package fixture runs supply separate
behavior evidence. Source comment inspection cannot establish all browser,
third-party-provider, or application behavior.


## Current-base addendum: native data at `2b5fde97`

After moving the worktree to `2b5fde974abd94c2da911a02a4bbc0b486c7f661`, all
comments in `packages/data/src/collection.ts` (378 lines) and
`packages/data/src/model.ts` (195 lines) were checked again against the surrounding
implementation and changed runtime/type tests.

The updated Collection comment correctly distinguishes retained Model instances
from raw attributes constructed by the configured factory. `indexModels` builds
cid entries, overlays application ids in reverse order to retain the first id
match, then overlays exact Model identities; its comment describes that precedence
accurately. SameValueZero id equality, relational comparator behavior and the
constructor/type name comments remain accurate. Model's declaration changes add
partial attribute results and typed known-key writes without introducing an
obsolete runtime comment. No further source comment or runtime edit was needed.

Current-source validation: `npx vitest run test/unit/data-package
test/unit/docs-integrations-examples.spec.js --reporter=dot` passed 5 files /
58 tests, and `node --test test/performance/data-package.test.mjs` passed 2 tests
under Node v24.19.0. This is a focused refresh of these two changed source files;
the earlier 63-file comment/printer comparison describes the earlier audit
snapshot, not a newly repeated all-source comparison after the upstream update.
