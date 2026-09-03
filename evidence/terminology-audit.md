# Marionette v5 terminology audit

Audit base: upstream commit `e03eb4c2b0f68c36de2f931114c08346ec551a66`.

The audit covered production source and comments, public error text, tests,
documentation, roadmap material, package declarations, exports, fixtures, and generated
distributions. The only runtime behavior change in this cleanup is the pre-stable API
rename from `DataApi.items(collection)` to `DataApi.models(collection)`; no compatibility
alias remains.

## Retained rejected-term occurrences

Every retained occurrence belongs to one of the four requested classifications:

| Classification | Files or patterns | Reason retained |
| --- | --- | --- |
| Intentional historical reference | `docs/upgrade-v2-v3.md`, `docs/upgrade-v3-v4.md`, and migration rows that quote `ItemView` or `backbone.marionette` | Exact former names are necessary migration evidence. The terminology ledger and this audit also quote rejected terms in order to prohibit or classify them. |
| Intentional historical reference | `upgradeGuide.md` and `changelog.md` name `DataApi.items(collection)` only when documenting its removal | The exact former API is required for an actionable migration. |
| Intentional historical reference | Negative `DataApi.items` assertions in the core and package unit, distribution, and ESM/CommonJS fixture validators | These occurrences prove the obsolete alias is absent from source and shipped package surfaces. |
| Unrelated English usage | `item`/`items` locals in `scripts/performance/*.mjs` iterate manifests, generated chunks, budgets, or approvals | These values are not models or collection data. |
| Unrelated English usage | `align-items` declarations in `docs-site/assets/styles.css` | This is a CSS property name. |
| Unrelated English usage | `utils/dispose-all.js` and `packages/data/src/dispose-all.js` | `disposeAll` is an explicitly retained internal attempt-all teardown helper, distinct from the public cleanup-function noun. |
| Generated/external content | JSON Schema `items` keywords under `benchmarks/agent` and `config/diagnostics`, plus validation text emitted from those schemas | `items` is the standard JSON Schema array keyword, not Marionette model terminology. |
| Generated/external content | `dist/**` and `packages/data/dist/**` | Generated output mirrors canonical source or one of the retained identifiers above. |
| Unresolved inconsistency | `mixins/template-render.js`, `docs/view.rendering.md`, and their template-render tests use the serialized collection property `items` | This is a separate current public identifier. Renaming it would be a second runtime behavior change prohibited by this cleanup's guardrail. Decide it before the API-shape freeze; the split vocabulary must not survive into stable v5. |

Re-run the repository search after generating distributions so any new occurrence
must either use the canonical vocabulary or be added to this table with a concrete
justification.
