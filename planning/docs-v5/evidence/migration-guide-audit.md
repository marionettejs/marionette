# Migration guide audit — 2026-09-30

## Scope and conclusion

`docs/guides/migration.md` supplies a procedural v4 application migration path: installation/integration setup, common View changes, feature readiness/ownership, then public behavior checks. It links the canonical API pages rather than repeating their complete option/lifecycle tables. There are no JavaScript, TypeScript, or historical code fences to register in the executable-example harness.

This is source-backed documentation, not evidence that a reader can migrate an application successfully. It adds no runtime compatibility path, migration shim, helper utility, or example-specific architecture rule.

## Comparison sources

- Historical v4 baseline: local `audit-v4.1.3`, commit `9c0147b44a077aa008abc1ca7c9a64496819731b`. Read with `git show`, without checking it out or altering the workspace.
- Current v5 baseline: `docs/v5-reset`, HEAD `595fce758b353506959474d60fbb246b1f3bdc57`, plus the new guide. Runtime/declarations were inspected directly.
- Upstream `docs/migration-from-v4.md` was read for coverage comparison. Its ledger also contains v5 alpha/earlier-candidate changes. Those were not treated as v4 behavior. In particular, this guide does not describe the former v5 concrete `State` export or a pre-stable fallback as v4 APIs. The `items` → `models` change is independently verified in the actual v4 serialization source.

## Source backing

| Guide claim | Historical/current source checked |
| --- | --- |
| Package/named imports, namespace Object alias, removed flags and root utility wrappers | v4 `src/backbone.marionette.js`, `src/config/features.js`; v5 `src/index.ts`, `packages/utils/src/index.ts`, `docs/packages/utils.md`. |
| Backbone/default data integration, independent state configuration, optional incomplete native data | v4 `src/view.js`, `src/mixins/template-render.js`; v5 `src/runtime/data-api.ts`, `src/runtime/state-api.ts`, adapter/data package manifests and references, `src/create-marionette.ts`. |
| Atomic Radio migration and debug method | v4 `src/mixins/radio.js`; v5 `packages/radio/src/index.ts`, `src/create-marionette.ts`, `docs/packages/radio.md`. Core imports the companion's default Radio; isolated runtimes allocate their own. |
| Fixed element-only View root, removed inherited remove/delegate helpers, native UI/event semantics | v4 View extends Backbone.View and overrides `setElement`; v5 `src/modules/view.ts`, `src/mixins/view.ts`, `src/runtime/event-delegator.ts`, `src/mixins/view-events.ts`, View/adapter references. jQuery content/query selection does not replace EventDelegator. |
| Collection-only serialized template property | v4 `src/mixins/template-render.js` uses `items`; v5 `src/mixins/template-render.ts` uses `models`. |
| Explicit View instances and inspection-only Region queries | v4 `src/region.js` `_getView` allocates a View for template/string/options, and `src/mixins/regions.js` queries call render; v5 Region/View methods and their canonical reference. |
| Hook receiver and literal event names | v4 `src/common/trigger-method.js` uses option lookup; v5 utils trigger-method implementation, event source and `docs/api/shared/events.md`. Backbone source semantics remain external. |
| Collection child helper/container contracts | v4 `src/collection-view.js` passes `$container`; v5 `src/modules/collection-view.ts`, `src/modules/child-view-container.ts`, canonical CollectionView reference. |
| Async Application lifecycle, readiness, root/child ownership, retained-refresh distinction | v4 `src/application.js` has synchronous notification-only start and Region proxy methods; v5 `src/modules/application.ts`, Application reference and retained-refresh guide. |
| Automatic incoming and outgoing listener cleanup after destruction | v5 destroy/View/Region/Application implementations, event cleanup reference and public destruction tests. Stop retains subscriptions; external sources need their own contract. |

## Executed verification

Ran:

```sh
npm run test:unit -- test/unit/application-preparation.spec.js test/unit/application-root-view.spec.js test/unit/application-child-lifecycle.spec.js test/unit/backbone-adapter.spec.js test/unit/events-literal-names.spec.js test/unit/destroy-listener-cleanup.spec.js test/unit/view.renderer.spec.js test/unit/mixins/view-events.spec.js
```

Result: **187 tests passed across eight files**. This focused run checks readiness/result delivery, ignored notification Promises, obsolete startup suppression, root ownership, registered child lifetime, borrowed Backbone data, literal event names, public final-notification/cleanup behavior, rendering, and trigger default prevention/propagation.

These tests already existed; none was added merely to mirror this prose. This run is not a full suite, a v4-v5 application migration, a browser plugin compatibility check, or a controlled reader-effectiveness comparison. Shared documentation delivery/link checks are root-agent work and must be reported separately after they run.

## Remaining coverage and measurement

- Existing Backbone consumers can migrate the framework without replacing their persistence layer. The optional adapter is a verified integration choice, not a blanket backward-compatibility fallback. Migrating persistence to another data solution is a separate application change.
- Specialized script/AMD loading, custom provider overlays, low-level extension overrides, and nuanced child-container callback behavior remain reference lookups; this page is not an exhaustive compatibility ledger.
- Test an actual representative consumer before declaring a completed migration. Its observable behavior and teardown should be checked against its former baseline; this guide's source comparison cannot establish application parity.
- A fresh reader/model trial should measure whether the reader discovers setup, chooses appropriate readiness/ownership, preserves intended data behavior, and validates teardown. Keep tasks and scoring independent of this guide's vocabulary. Compare documentation sets on the same frozen runtime.
