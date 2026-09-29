# API completeness audit

2026-09-30. Audit of the existing full member inventory, canonical API/package reference, source, and exact tests. No inventory generator changes, runtime changes, guide edits, or commits performed by this audit.

All exported names and public member names in the existing generated inventory occur in the API/package reference corpus. This lexical screen rules out obvious missing names; it does not prove every overload, callback, lifecycle ordering or integration behavior is taught. The seven partial groups are primarily detailed behavioral coverage, not absent classes or methods. Counts are metadata groups, not a completeness percentage.

## Changes

- `getOption` reference explicitly accepts string, numeric and symbol keys, matching its PropertyKey overload and implementation. Removed unrelated onceWrap/uniqueId/subscription lifetime statements from owner-get-option and owner-merge-options metadata.
- Added one sentence explaining same-name triggerMethod recursion and listener-only trigger alternatives.
- Documented source replacement insertion before sorting while unaffected manual children retain identity; scoped the manual profile's order claim to the actual comparator/source contract.
- Clarified Application reselecting its own displayed root destroys a prepared replacement; directly displayed borrowed Region content is not its selected root.
- Clarified custom stable opaque model references against immutable stores and that retained View identity does not guarantee retained DOM/drafts. Narrowed profile wording accordingly while retaining the valid missing integration recipe as a visible partial gap.
- Added version-matched canonical-reference discovery to utils/adapters READMEs, which previously lacked the installed paths already present in data/Radio READMEs.

## Seven partial groups: before and after

| Group | Before | After | Source justification and remaining scope |
| --- | --- | --- | --- |
| manual-children | partial | documented | `src/modules/collection-view.ts` `_onCollectionUpdate` inserts replacement at previous child index then calls `sort`; `_setChildrenFromSnapshot` retains manual Views. Reconciliation tests cover same-key replacement and actual manual children/source ties. The new paragraph explains placement without another example. |
| provider.custom-state-consumers | partial | partial | `test/unit/data-api-redux.spec.js` reads stable ID references from immutable backing entities. Its custom `attachElContent` preserves input nodes; this is not a StateApi/DataApi guarantee. Metadata now distinguishes retained View identity from renderer-dependent DOM retention. Full custom immutable-store notification/cleanup integration recipe remains absent and visible. |
| application-lifecycle | partial | partial | Application's adopted stop readiness precedes destination binding; `application-start-region.spec.js` and `application-restart-completion.spec.js` also test reentry from completion hooks beginning a distinct cycle. Ordinary readiness/cancellation/stop/restart rules are documented. Exact binding order and completion-hook reentry are advanced valid behavior still absent, deferred rather than removed from metadata. |
| owner-trigger-method | partial | documented | `packages/utils/src/trigger-method.ts` resolves and calls the hook before dispatch. Invoking the same triggerMethod inside its hook recurses. One sentence gives the useful forwarding distinction. |
| owner-get-option | partial | documented | `packages/utils/src/get-option.ts` accepts PropertyKey, reads options first, then receiver. Shared table now states key types without niche examples. |
| owner-merge-options | partial | documented | `docs/packages/utils.md` already explicitly documents safe own-data-property treatment of __proto__; this was a stale metadata citation gap. Added its existing Component methods anchor, no edge-case prose. Implementation `merge-options.ts` uses `setProperty`; exact unit test verifies own enumerable string options and safe prototype handling. |
| application-composition | partial | documented | `src/modules/application.ts` setView releases prior prepared root, permits own displayed root, rejects another owned View; tests in `application-prepared-view.spec.js` verify reselect and directly displayed Region root rejection. New concise paragraph states both contracts. |

## Remaining priorities and limits

Custom provider recipe and advanced lifecycle ordering remain explicit gaps. Neither blocks ordinary consumer use of the documented classes. Separate remaining decisions such as allowed missing Region mounts are already exposed in the Region reference; this audit does not resolve runtime policy. Type-only exports are named and covered by class/provider/TypeScript guidance, but structural occurrence alone cannot establish practical typing completeness.

No new executable API fences were introduced. Existing source/tests substantiate the prose; root should regenerate/check inventory and run its metadata contract tests because authored profile descriptions/citations changed. Whitespace validation passed. This audit does not claim the full unit suite, reader effectiveness, registry publication, or browser checks.
