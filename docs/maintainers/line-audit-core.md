# Core reference line audit

This records the bounded core-reference pass on 2026-09-08 in the existing dirty
`marionettejs-docs-agent-strategy` worktree. It is a local source audit, not a
release certification. Existing changes from earlier passes were preserved.
Every assigned page was read from its first line to its last line, including its
prose, tables, links, and examples. Concrete behavior was compared with the local
implementations and relevant unit-test assertions. Source code was not edited by
this pass.

## Page coverage

Line counts identify the complete files at the end of this pass. Further edits
will change those counts. The original assigned files contained 5,373 lines; the
reviewed result contains 5,406 lines.

| Page | Lines reviewed | Principal source evidence and corrections |
| --- | --- | --- |
| `marionette.application.md` | 1–498 | `src/modules/application.ts`: constructor ordering; async operation cancellation, readiness adoption, stable-state failure recovery, child ownership, Region ownership. Clarified runtime/cycle conflicts, actual terminal-registration inspection boundary, and last committed state on failure. |
| `marionette.behavior.md` | 1–608 | `src/modules/behavior.ts`, `src/mixins/behaviors.ts`, `src/mixins/view.ts`: construction, UI merge, host event subscription, direct destruction and host cleanup. Added `stateEvents` to copied options, documented host `trigger()` broadcasting, corrected State cleanup coverage, and made model/provider assumptions explicit. |
| `marionette.collectionview.md` | 1–1434 | `src/modules/collection-view.ts`, `src/modules/child-view-container.ts`: construction, observation, updates, render/empty paths, container methods, sorting/filtering, manual ownership. Fixed missing render/setup, invalid const reassignment, reversed/model-based comparator examples, implicit child-event forwarding, empty-Region placement, observation vocabulary, fragment attachment, event conditions, and defer-sort/filter examples. |
| `marionette.mnobject.md` | 1–179 | `src/modules/object.ts`, `src/mixins/common.ts`, `src/mixins/destroy.ts`, `src/mixins/state.ts`, `src/mixins/radio.ts`: options, IDs, events, State/Radio cleanup and failure guard. No additional text correction was necessary in this pass; prior worktree edits remain. |
| `marionette.region.md` | 1–739 | `src/modules/region.ts`, `src/modules/common/build-region.ts`, `src/modules/common/view.ts`, View Region registration methods: deferred resolution, ownership, show/empty/detach/reset/destroy, replacement and overrides. Fixed same-Region reuse, selector versus Element reset, construction-time error claims, symbol-copy semantics, and removed obsolete Backbone destruction fallback and deferred-cleanup animation example. |
| `marionette.state.md` | 1–231 | `src/mixins/state.ts`, `src/runtime/state-api.ts`, State owner constructors: lazy creation, borrowed/owned lifetime, subscription and disposal. Added missing imports/provider setup context and separated before/after declarations that otherwise failed to parse together. |
| `marionette.view.md` | 1–396 | `src/modules/view.ts`, `src/mixins/view.ts`, template/UI/Region mixins: constructor, attribute refresh, Region reads and child dispatch. Corrected Region lookup versus `show()` resolution, child-root insertion, detached-parent mounting language, and symbol copying versus default DOM attribute application. |
| `view.lifecycle.md` | 1–285 | View/CollectionView/Region render and teardown implementations, `src/modules/common/view.ts`, lifecycle monitoring: initial state, managed transitions, terminal calls and child cleanup. Removed the unconditional claim that a live rendered child cannot become unrendered during an update; detach preserves rendered state. |
| `view.rendering.md` | 1–549 | `src/mixins/template-render.ts`, renderer and DOM adapters: template evaluation, synchronous attachment, serialization and context. Fixed non-output Underscore tags, missing HTML closure/import, wrong example variable, enumerable-symbol merge semantics, and named application-owned model helpers explicitly. |
| `dom.interactions.md` | 1–314 | `src/mixins/view-events.ts`, `src/mixins/ui.ts`, `src/runtime/event-delegator.ts`: native event delegation, trigger defaults, UI normalization and cleanup. Corrected leading-whitespace guidance, Behavior UI capture on redelegation, and the unsupported own-undefined-selector diagnostic claim. |
| `dom.prerendered.md` | 1–173 | View construction, Region show, CollectionView child construction: populated roots, existing child identity, explicit rendering and rerender ownership. Made the collection example's table/source prerequisites explicit, used DataApi source access, and preserved child options. |

Unverified JSFiddle links were removed from these canonical pages. They were not
executed or treated as evidence for the current source. Backbone remains an
optional supported observable integration through its DataApi; its examples were
retained and repaired. No historical starter or pre-v5 upgrade page was restored.

## Runtime/documentation discrepancies

These are distinctions found in the existing implementation, not runtime changes:

- `normalizeUIString` checks own key presence, not whether its value is
  `undefined`. An own undefined value currently becomes the literal string
  `"undefined"`; it does not throw `MN0018`. The supported selector type remains
  string. Documentation now states that boundary instead of promising a missing
  key diagnostic for an invalid value.
- Native object spread copies enumerable symbols in template context, Region
  options and child options. Earlier prose incorrectly said symbols were ignored.
  String-key iteration contracts elsewhere remain separate.
- Region and child-view resolver code trust supported input shapes. Invalid
  values do not have a universal guaranteed Marionette diagnostic. Documentation
  now names actual checked errors and marks other shapes unsupported.
- Region operations do not await a custom `removeView` Promise. The old delayed
  jQuery removal example could finish Region empty/destroy before child cleanup.
  It was replaced with synchronous override guidance and application-owned
  animation/cancellation responsibility.
- CollectionView can mark an updated child unrendered before rendering it again;
  a filtered updated child can remain unrendered until visible. The old blanket
  live-rendered-state claim was stronger than the implementation.

## Executed verification

The following command actually ran and passed: **12 files, 355 tests**.

```sh
npx vitest run test/unit/application-lifecycle.spec.js test/unit/application-child-lifecycle.spec.js test/unit/application-ownership.spec.js test/unit/application-root-view.spec.js test/unit/state-owner.spec.js test/unit/behavior-communication-contract.spec.js test/unit/behavior-ui-contract.spec.js test/unit/region-lifecycle.spec.js test/unit/mixins/template-render.spec.js test/unit/collection-view/collection-view-sorting.spec.js test/unit/collection-view/collection-view-filtering.spec.js test/unit/collection-view/collection-view-empty.spec.js --reporter=dot
```

Additional bounded Node checks ran successfully:

- Parsed all **138 JavaScript fences** with `@babel/parser`; six method/property
  fragments were parsed in an object wrapper. This checks syntax, not runtime
  behavior or missing application dependencies.
- Executed **11 actual CollectionView documentation blocks** under JSDOM, using
  a fresh `createMarionette()` source runtime per block. Import specifiers were
  mapped to local source/dependency paths; snippet bodies were otherwise
  unchanged. Assertions checked dynamic child classes; custom/source sorting;
  disabled source sorting; string comparators; deferred comparator changes;
  function/object/string filters; deferred filter changes; and remove-filter
  followed by an explicit filter pass. Each case destroyed its Views afterward.
- Direct current-source assertions verified own-undefined UI normalization,
  missing-own-key `MN0018`, and enumerable-symbol template-context copying.
- `git diff --check -- docs` completed successfully.

No marked `executable-example` block was changed by this pass. Existing fixture
extractors therefore need no changes for these edits. The coordinating audit
runs the complete documentation fixtures after all parallel page edits freeze;
that result belongs in the overall audit record.

## Limits

Reading all lines is coverage of the assigned text, not proof of every possible
runtime combination. The targeted tests and 11 direct executions do not execute
every unmarked example. Application-specific imported Views, model helpers,
HTTP loaders, installed template engines, custom adapters and animation code
still require their application's setup. No full application, external live
example, browser performance claim, publication, deployment, push, or release
was exercised by this pass. Runtime-source comments and other documentation
pages are owned by the other audit passes.

## Current-base addendum: Region teardown on `2b5fde97`

After the original pass, the worktree advanced to upstream `2b5fde97`, including
Region teardown change `ae842653` (#455). The upstream delta in
`src/modules/region.ts`, `src/modules/view.ts`, the Region reference and
`test/unit/region-lifecycle.spec.js` was read before the update, then checked
against the updated worktree. The Region reference conflict was resolved by
making the new teardown behavior canonical while preserving this audit's other
corrections. Its reviewed result is now 745 lines; the earlier coverage table
records the pre-update snapshot.

The current contract is:

- Region `isDestroyed()` remains false during `before:destroy`, `reset`,
  `before:empty` and `empty`; it becomes true after reset returns, before the
  Region's `destroy` notification.
- `empty()` and `reset()` are ordinary synchronous calls during destruction
  cleanup. They become terminal no-ops after destruction completes. There is no
  private authorization token or special required override-delegation route.
- `show()`, `detachView()` and recursive `destroy()` still stop accepting work
  immediately when destruction begins. Cleanup errors leave teardown incomplete;
  a later `destroy()` neither retries nor resumes it.
- A child that destroys itself releases its Region ownership and the owning
  parent View's subscriptions to that child. Later child events are not
  forwarded. Upstream tests also cover a child destroy handler destroying the
  parent without repeating Region teardown.
- View's own Region lookup now reads its null-prototype registry directly. Its
  public non-rendering lookup, missing-name and explicit special-name contracts
  are unchanged.

The same-Region detach/re-show correction, missing-mount current-view preservation,
original-selector versus original-Element reset guidance, provider-neutral
ownership, and removal of the old deferred-cleanup animation remain intact.
No marked executable snippet changed.

With `/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin` prepended to `PATH`, this
command passed **4 suites, 57 tests**:

```sh
npx vitest run test/unit/region-lifecycle.spec.js test/unit/region-detach-contents.spec.js test/unit/view-get-region.spec.js test/unit/view-has-region.spec.js --reporter=dot --maxWorkers=2
```

A TypeScript parsed-source comparison with comments removed confirmed that the
updated Region source differs from current HEAD only in comments. Both working
and staged Region diffs passed `git diff --check`. The earlier 355-test result
belongs to the prior base; this addendum does not silently relabel it as a run
against the newer revision. The coordinating audit owns the current-base full
build and fixture result.
