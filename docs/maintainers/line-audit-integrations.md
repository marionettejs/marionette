# Integration and event documentation line audit

This audit covers the 19 files below in the local documentation worktree on
2026-09-08. Every line in each assigned file was read, including code blocks and
links; the first frozen inventory contained 3,922 lines. The current-base addendum below
records the subsequent upstream data change. Source inspection and the tests
listed below establish specific contracts, not a guarantee that every sentence
or every possible integration has been exercised. Existing worktree changes were
preserved. This work adds documentation and a development-only snippet test; it
adds no production resources.

## Exact file coverage

| File | First frozen lines | Result and source evidence |
| --- | ---: | --- |
| `docs/basics.md` | 275 | Corrected symbol copying for `extend` and merged options; distinguished string-only `mergeOptions` and own non-enumerable constructor selection. Checked `packages/utils/src/extend.ts`, `src/mixins/common.ts`, and helper tests. |
| `docs/classes.md` | 100 | Read completely; class roles and composition agree with `src/create-marionette.ts` and the six module constructors. No additional edit. |
| `docs/common.md` | 315 | Corrected the implication that direct Backbone event interoperability needs DataApi configuration. Checked utility binding, normalization, option, and trigger implementations. |
| `docs/data.api.md` | 278 | Explicitly identified both Backbone and native Model/Collection sources as observable; labeled custom-adapter and actor examples as configuration fragments. Checked `src/runtime/data-api.ts`, collection reconciliation, native API, and actor/Backbone adapters. |
| `docs/dom.api.md` | 253 | Corrected adapter overlays to include enumerable symbols; checked all native methods and jQuery/Morphdom/Lit overrides against `src/runtime/dom-api.ts` and adapter source. |
| `docs/events.class.md` | 498 | Corrected child-add timing, complete presented-child render payloads, default comparator events, template-free CollectionView lifecycle, filter arguments, Region examples, and cleanup guidance for detached resources. Checked View, CollectionView, Region, Behavior, Application and monitor implementations. |
| `docs/events.entity.md` | 163 | Identified the provider-specific payload in the collection callback fragment; checked delegation, cleanup and host-destruction guards in the entity and View/Behavior mixins. |
| `docs/events.md` | 651 | Corrected opt-in child bubbling, supplied child templates/constructors/parent markup, preserved arbitrary message arguments, clarified Backbone event interoperability, removed the unconditional memory-leak promise and unverified historical JSFiddle examples. Checked Events, View child forwarding and DOM trigger construction. |
| `docs/radio.md` | 296 | Completed the request service and one-time reply examples; checked registration, fallback, reset, logging, owner cleanup, and parity claims against Radio/Requests source and tests. |
| `docs/runtime-isolation.md` | 82 | Labeled renderer/template placeholders as a configuration fragment; checked isolation, class composition, setter recipients, return values, overlays and default snapshots in `src/create-marionette.ts`. |
| `docs/utils.md` | 65 | Read completely; standalone `extend` and `VERSION` claims agree with exports and implementations. No additional edit. |
| `docs/terminology.md` | 85 | Read completely; model/serialization/state ownership and lifecycle distinctions agree with the corresponding source. No additional edit. |
| `docs/optional-backbone.md` | 119 | Explicitly distinguished optional dependency from observability and completed the preexisting-listener example; checked reads, snapshots, native events, flagged-sort limitation and no-op owned disposal against the Backbone adapter. |
| `docs/choosing-integrations.md` | 135 | Explicitly retained observable Backbone for existing applications; distinguished plain static values, native observable values and provider requirements. Checked public subpaths and adapter contracts. |
| `docs/public-api.md` | 77 | Read completely; checked runtime exports and companion exports against entry modules/manifests. Root corrected `monitorViewEvents(view)` self-link to `#monitorvieweventsview`. |
| `packages/adapters/readme.md` | 235 | Labeled actor prerequisites and made the replacement jQuery example's imports complete; checked all five adapter source modules, package subpaths and source ownership. |
| `packages/data/readme.md` | 150 | Added the explicit Model import to the TypeScript constructor example; checked native methods, notification semantics, destroy behavior, conversion methods and declarations against source/types. |
| `packages/radio/readme.md` | 75 | Read completely; standalone/default/isolated registries and logging claims agree with Radio, Requests and debug source. No additional edit. |
| `packages/utils/readme.md` | 70 | Made the standalone example import Events from utils and corrected request helpers to use channel reply methods rather than receiver listening methods. Checked the complete export list. |

The four companion readmes are the complete `packages/*/readme.md` inventory at
this audit. Historical pre-v5 starter/upgrade pages were not restored. Backbone
remains a supported optional observable provider. The complete application
starter remains outside this finite pass.

## Executed evidence

The following targeted source command passed **16 files / 248 tests**:

```sh
npx vitest run test/unit/utils/extend.spec.js test/unit/common/get-option.spec.js test/unit/common/merge-options.spec.js test/unit/common/normalize-methods.spec.js test/unit/common/bind-events.spec.js test/unit/common/trigger-method.spec.js test/unit/runtime/data-api.spec.js test/unit/runtime/dom-api.spec.js test/unit/create-marionette.spec.js test/unit/dom-adapters.spec.js test/unit/data-package/api-integration.spec.js test/unit/collection-view/collection-view-lifecycle.spec.js test/unit/events-parity.spec.js test/unit/events-iteration.spec.js test/unit/radio-parity.spec.js test/unit/requests.spec.js --reporter=dot
```

The checked-in `test/unit/docs-integrations-examples.spec.js` reads the actual
Markdown snippets, resolves their imports to authored source and a fresh runtime,
and executes the examples in jsdom. It verifies row clicks, Region and
CollectionView prefix opt-in, explicit child handlers, two-generation message
arguments, Region show/empty state, filtering, empty Views, preexisting Backbone
listeners, Radio return values, and the standalone utils component.

```sh
npx vitest run test/unit/docs-integrations-examples.spec.js --reporter=dot
npx eslint test/unit/docs-integrations-examples.spec.js --max-warnings=0
git diff --check
```

The snippet suite passed **11 tests**; its targeted lint passed after correcting
one quote-style error. `git diff --check` passed. These direct Vitest commands do
not run the npm `pretest` type/declaration checks. Full package fixtures, build,
link checks and broader validation are coordinated by the root audit and are not
claimed here.

## Runtime issue found during the audit

Reading child-event forwarding exposed an inherited-map lookup bug:
`childViewTriggers: {}` could treat an emitted `constructor` event as a configured
trigger and throw. This was reported to the root audit instead of changing the
runtime contract silently. The root reproduced it through public APIs, added
`test/unit/child-event-map-ownership.spec.js`, and applied own-property checks to
both child maps. The root reported six suites / 123 tests passing for that change;
that separate result is root-run evidence, not part of the 248 tests above.

## Limits

The snippet checks cover the named examples, not every code block in the 19 files.
Configuration fragments explicitly rely on application-owned actors, templates
or adapters. The audit did not execute a complete application, test every provider
version or browser, browse historical live examples, publish a package, or deploy
a site. Static source agreement and unit results are not measured agent gains or
a stable-release claim. Final rendered-link and packed-package results belong in
the overall audit closeout after the documentation freeze.


## Current-base addendum: native data at `2b5fde97`

After upstream PR #465 landed, this worktree moved to
`2b5fde974abd94c2da911a02a4bbc0b486c7f661`. Both changed data guides were read
completely again: `docs/data.api.md` (292 lines) and `packages/data/readme.md`
(194 lines). The existing observable-Backbone language, independent StateApi
setup, and explicit example imports survived the merge.

The upstream implementation and docs now preserve supplied native Model instances
through construction, addition and reset even when a different raw-attribute
factory is configured. Lookup uses exact member instance, then application id,
then cid. Batch removal uses one temporary identity index and a removal Set;
current ids, including silent changes, are read for that operation. No persistent
index or observer queue was introduced.

The package guide received three clarifications after the merge:

- Bulk removal skips missing and repeated matches, returns Models in input order,
  preserves survivor order, and uses the first current member for duplicate ids.
- An absent sparse `previous` key implies prior absence only for an attribute
  included in that mutation's `changed` map.
- Collection reset rebuilds CollectionView children but does not destroy the
  supplied Model instances it retains.

The updated constructor/member unions, partial attributes and known-key `set`
contract were checked against authored declarations and the changed
`test/fixtures/data-package-types/validate.mts` consumer. Installed declaration
verification remains part of root validation; this addendum does not claim to
have rerun that fixture independently.

With Node `v24.19.0`, the following commands passed on the updated source:

```sh
npx vitest run test/unit/data-package test/unit/docs-integrations-examples.spec.js --reporter=dot
node --test test/performance/data-package.test.mjs
git diff --check
```

Results: **5 source/snippet suites / 58 tests** and **2 deterministic performance
contract tests**. The performance test bounds id reads during bulk removal; no
new timing or production throughput measurement is claimed. The source-comment
refresh is recorded separately in [the companion comment audit](./package-comment-audit.md#current-base-addendum-native-data-at-2b5fde97).
