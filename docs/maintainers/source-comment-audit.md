# Core source comment audit

On 2026-09-08, the audit read every complete authored TypeScript file under
`src/`, including declarations, alongside the associated implementation and
relevant tests. It reviewed explanatory comments and JSDoc for current behavior,
API ownership, lifecycle order, return/mutation semantics, and unsupported
performance claims. Package source under `packages/*/src` is a separate audit.
Generated build output and installed dependencies are outside this inventory.

## Complete inventory

The finite inventory contains **32 files**. Each row represents a complete file
read, including code surrounding its comments. Line counts identify this local
snapshot; the documentation manifest records its revision and dirty state.

| File | Lines after audit | Disposition |
| --- | ---: | --- |
| `src/create-marionette.ts` | 220 | Read; no correction identified |
| `src/index.ts` | 69 | Read; no correction identified |
| `src/mixins/behaviors.ts` | 128 | Comments corrected |
| `src/mixins/common.ts` | 55 | Comments corrected |
| `src/mixins/delegate-entity-events.ts` | 63 | Read; no correction identified |
| `src/mixins/destroy.ts` | 29 | Read; no correction identified |
| `src/mixins/radio.ts` | 53 | Read; no correction identified |
| `src/mixins/state.ts` | 93 | Read; no correction identified |
| `src/mixins/template-render.ts` | 99 | Comments corrected |
| `src/mixins/ui.ts` | 156 | Read; no correction identified |
| `src/mixins/view-events.ts` | 112 | Read; no correction identified |
| `src/mixins/view.ts` | 287 | Comments corrected |
| `src/modules/application.ts` | 712 | Comments corrected |
| `src/modules/behavior.ts` | 220 | Comments corrected |
| `src/modules/child-view-container.ts` | 542 | Comments corrected |
| `src/modules/collection-view.ts` | 1243 | Comments corrected |
| `src/modules/common/build-region.ts` | 57 | Read; no correction identified |
| `src/modules/common/chainable-methods.ts` | 30 | Read; no correction identified |
| `src/modules/common/monitor-view-events.ts` | 97 | Read; no correction identified |
| `src/modules/common/view.ts` | 54 | Read; no correction identified |
| `src/modules/object.ts` | 165 | Comments corrected |
| `src/modules/region.ts` | 559 | Comments corrected |
| `src/modules/view.ts` | 559 | Comments corrected |
| `src/runtime/data-api.ts` | 99 | Read; no correction identified |
| `src/runtime/dom-api.ts` | 139 | Comments corrected |
| `src/runtime/event-delegator.ts` | 71 | Read; no correction identified |
| `src/runtime/renderer.ts` | 17 | Read; no correction identified |
| `src/runtime/state-api.ts` | 32 | Read; no correction identified |
| `src/runtime-id.ts` | 2 | Read; no correction identified |
| `src/utils/extend.ts` | 32 | Read; no correction identified |
| `src/utils/subscribe-bindings.ts` | 22 | Read; no correction identified |
| `src/version.d.ts` | 2 | Read; no correction identified |

## Corrected comment blocks

| File and block | Correction and implementation evidence |
| --- | --- |
| `src/mixins/behaviors.ts`: `_destroyBehaviors` | Host teardown calls Behavior cleanup before its final `destroy` event, not after the whole host lifecycle. Cleanup includes State and subscriptions. |
| `src/mixins/common.ts`: binding helper labels | The mixin is used by nonvisual classes too. Replaced View-only wording with receiver/context terminology. |
| `src/mixins/template-render.ts`: `mixinTemplateContext` | It returns either input when the other is falsy, or a fresh own-property merge. It does not copy context into the supplied data object. |
| `src/mixins/view.ts`: option list, `_getEl`, `destroy`, `_childViewEventHandler` | Added composed State/template options; distinguished supplied-element reuse from element creation; removed the unproven extra-paints claim; identified child handlers/triggers as shared by View and CollectionView. |
| `src/modules/application.ts`: `start` | Named asynchronous readiness and shared in-flight startup rather than suggesting it starts every arbitrary application process. |
| `src/modules/behavior.ts`: introduction, host proxy, `destroy` | Described host ownership, forwarding of all host events, subscription/State cleanup, and absence of a separate emitted destroy lifecycle. |
| `src/modules/child-view-container.ts`: constructor, `_set`, `findByModel` | The container stores/indexes Views but does not destroy them. `_set(..., true)` supports membership changes. Model lookup uses the provider key, not necessarily object identity. |
| `src/modules/collection-view.ts`: child storage, `_initialEvents`, update removal, `_getImmediateChildren`, setters, rendering, manual addition | Distinguished managed and presentation containers, normalized observations, lifecycle monitoring's actual caller, and explicit numeric-index insertion. Removed stale array-lookup rationale. Setters immediately sort/filter on changed values unless prevented; they do not test readiness. Surviving elements may move during ordering. |
| `src/modules/object.ts`: constructor | Current utilities are Marionette-owned; a historical Backbone convention does not imply a Backbone runtime dependency. |
| `src/modules/region.ts`: `reset` | Initial selectors are re-queried when needed; an initial native element is reused. |
| `src/modules/view.ts`: Region reset, `emptyRegions`, constructor, render reset | Reset empties child Views and restores deferred references; construction does not evaluate templates; `emptyRegions` can render the parent; prerendered contents also cause Region reset before template replacement. |
| `src/runtime/dom-api.ts`: buffer, query, containment, movement | Buffer is a DocumentFragment, queries return descendant-only NodeLists, containment excludes the root itself, and state-preserving movement is limited to an existing child of the same parent when `moveBefore` is available. |

The public CollectionView guide was also clarified: provider-key lookup finds the
currently indexed child but does not promise to retain its instance when a
collection observation replaces the model object.

## Validation performed

- Parsed every core TypeScript file with TypeScript and printed it with comments
  removed. The resulting text matched `HEAD` for **all 32 files**, establishing
  that the source edits changed comments only, including type declarations.
- `npx eslint src --max-warnings=0` passed.
- `git diff --check -- src` passed.
- The following focused behavior run passed **8 suites and 346 tests**:

```sh
npx vitest run test/unit/mixins/template-render.spec.js test/unit/mixins/behaviors.spec.js test/unit/runtime/dom-api.spec.js test/unit/collection-view/collection-view-sorting.spec.js test/unit/collection-view/collection-view-filtering.spec.js test/unit/collection-view/collection-view-reconciliation.spec.js test/unit/region-lifecycle.spec.js test/unit/child-view-container.spec.js --reporter=dot --maxWorkers=2
```

These tests exercise template-context copying, Behavior cleanup, DOM operations,
comparator/filter updates, keyed reconciliation, Region lifecycle, and container
membership. The [reference audit](./reference-audit.md) records the earlier
Application, Radio, monitoring, and runtime-configuration checks.

A preliminary comparison using TypeScript's standalone scanner was discarded:
a scanner without parser context misread template-literal boundaries and treated
later comments as literal text. The successful comparison used complete parsed
source files and the TypeScript printer instead.

## Meaning of completion

Every file in the inventory was read and each identified comment defect was
corrected. This establishes finite audit coverage, not a proof of universal
correctness. No comment-only pass proves every browser/provider combination or
finds every latent runtime bug. The behavior checks above cover their stated
assertions; source reading supports the remaining comment review.

Future source changes invalidate the affected inventory rows until reviewed
again. Keep comments tied to the operation they explain, and use executable
behavior evidence for claims about rendering, lifecycle, identity, and cleanup.

## Subsequent runtime correction

After the comment-only comparison above, a documentation audit reproduced an
inherited child-event map lookup that could throw on `constructor`. The separate
fix in `src/mixins/view.ts` checks ownership for event and trigger entries.
`test/unit/child-event-map-ownership.spec.js` covers both View and CollectionView,
including explicitly mapped special names. Do not interpret the earlier
comment-only comparison as describing that subsequent runtime change.

## Current-base addendum: Region on `2b5fde97`

Upstream Region change `ae842653` (#455), included in the updated worktree base
`2b5fde97`, replaces the special destruction override authorization chain with
ordinary synchronous `reset()`/`empty()` calls. The changed Region code and tests
were re-read. The Region source comments now state that empty remains available
during cleanup, destruction is marked complete after reset, and external child
destruction also releases parent subscriptions. The earlier reset comment
correction remains: original selectors are queried again when needed; original
Elements are reused without a query. The View lookup change to direct access of
the null-prototype Region registry required no public-contract comment change.

Using Node **v24.19.0**, TypeScript parsing and printing with comments removed
confirmed `src/modules/region.ts` still matches current HEAD semantically. This
was a new comparison limited to that file; it does not replace the earlier
32-file snapshot or conceal the separately recorded child-event runtime fix.
Region lifecycle, detach contents, View get-Region and has-Region tests passed
**4 suites, 57 tests**. The exact command and current Region contract are in the
[core audit addendum](./line-audit-core.md#current-base-addendum-region-teardown-on-2b5fde97).
No runtime code or marked executable example was changed by this re-audit.
