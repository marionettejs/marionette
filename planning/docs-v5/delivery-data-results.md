# Delivery, agent discovery, and native data

2026-09-30. Working changes on `docs/v5-reset`, based on `59a62504`. This is a completed authoring and local delivery slice, not release readiness or proof of teaching effectiveness.

## Delivered

- Normal export, package and site validation use the rebuilt corpus: 21 consumer pages, explicit example/skill/diagnostic assets, and a verified section index. Planning, evaluation evidence and the old fixture starter are excluded from npm documentation.
- `docs/agents.md` provides canonical task routes. The short portable skill and plugin mirror them; installed Markdown and local lookup work independently of a hosted service. Registry and hosted-MCP publication are not claimed.
- `docs/packages/data.md` covers the supported native Model/Collection surface. Setup links the reference; the standalone README keeps a small useful example. Transport/persistence remain explicit external responsibilities. The member audit is [recorded separately](evidence/data-package-reference-audit.md).
- Actual reference-fence execution moved from a planning probe into maintained tests. The runner discovers all API pages, requires an outcome assertion for every JavaScript/TypeScript fence, compiles type examples, and supports installed packages. The planning caller uses this same implementation.
- `npm run docs:check` now includes a normal staged-package installation, documented discovery commands, page/section/diagnostic lookup, content-hash verification, and reference execution against the installed tarballs.
- The existing release validation kit reads an explicit fixture file list directly. Its manifest disables Marionette installation scripts for the selected version. It is labeled a validation fixture; it is not shipped as the recommended npm application starter.

No framework runtime or declaration changes, publication, deployment, or new paid effectiveness campaign were made.

## Objective checks

| Dimension | Evidence and limit |
| --- | --- |
| Coverage | Native data members, hooks/events, providers and exports audited against source/types. Remaining Radio, utilities, adapters, diagnostics/lint prose, TypeScript and task/migration guide gaps stay in the inventory. |
| Accuracy | Source tests and actual Markdown snippets verify observable results. A separate agent checked every data source module and corrected two contract details. |
| Findability | Canonical task routes and current contract searches pass; installed list/search/page/section lookup verifies package-relative discovery. This is not independent reader transfer. |
| Architecture | The new data examples stand alone without records or an Application. Guidance preserves local View edits and assigns broader work according to lifetime. The records feature gained no new responsibilities or helper utilities. |
| Usability | Normal build/site/package commands and a fresh consumer installation run. Live website imports, registry publication and browser interaction were not exercised in this slice. |
| Maintainability | One canonical data reference replaces duplicated README prose. Export checks cover Markdown dependencies and imported skill modules. Published symbol mappings are unavailable until their retired references are rebuilt; generic lookup support is retained but not advertised for this corpus. |

This work follows the existing [peer decisions](peer-comparison.md#framework-wide-decisions): independent learning/reference paths, task routing, and precise contract lookup. No new peer outcome ranking or compiler-tooling parity is claimed.

## Independent review

The [Claude response](evidence/delivery-data-claude-review.json) received the objective, remaining coverage, selected canonical files, delivery/test diff and verification status. It requested changes. Applied findings:

- Keep diagnostic replacement links inside the rendered table; test both forms.
- Require an explicit release-fixture file inventory, preserve version-specific installation-script policy, and reject missing imported skill resources.
- Document post-destruction data writes as no-ops and per-Collection removal/update/destroy ordering; test event-map subscriptions and cleanup.
- Discover all API pages in the reference runner so a new fenced example cannot silently escape its outcome checks.
- Make packed-install discovery and reference execution part of ordinary repeatable verification.

Findings checked but not adopted:

- The review inferred `upgradeGuide.md` still shipped from a synthetic package test. It was already removed from the actual root file manifest; the rebuilt package omits it.
- Candidate wording remains because this working documentation is not verified as published on npm. Unqualified registry instructions would overstate availability.
- The retained records assets support the optional runnable lesson and its documented commands. They are not required by the API learning path and are not benchmark fixtures.
- The optional symbol helper remains a dependency of the generic lookup implementation. Installed page/section lookup succeeds without a symbol index; no current symbol-coverage claim is made.

The review correctly flagged the old API-contract checker as a merge/release blocker. It has not been disabled or relabeled as passing. Claude did not approve the final revised artifact; the applied changes were verified locally.

## Verification

- `npm run build`: passed, including source/declaration checks, all package builds and normal documentation packaging.
- `npm run docs:check`: passed on the final consumer corpus. Seven exporter checks, 15 executed reference examples, 16 declaration fixtures, and site validation of 67 HTML files / 809 internal links. Its installed-package step separately executed the same 15 examples and compiled eight TypeScript examples plus the 16 declaration fixtures.
- `node --test test/docs/*.test.mjs test/agent-docs/*.test.mjs test/release/build.test.mjs`: **81 passed**, including the additional dependency-closure regression test.
- `npm run test:data`: **50 passed across four files**, run by the data worker against unchanged data source.
- Current standalone utility documentation example: **one test passed**.
- `npm run check:diagnostics`: **41 catalog entries validated**. Separate rendered-table tests exercise the diagnostic formatting change.
- All changed JavaScript passed ESLint with zero warnings; agent-route consistency and whitespace checks passed.
- `npm run check:api-contracts`: **fails** at removed `docs/typescript.md`. The full repository verification and legacy fixture suite are not claimed green.

The [installed-package report](evidence/delivery-data-installed-package.json) records the actual five tarball hashes, 21 pages, 24 assets, source provenance and content hash. It verifies package resolution, list/search/section/page/diagnostic commands and every manifest entry's bytes. The check initially exposed a macOS temporary-directory symlink comparison in the new verifier; normalizing the temporary path fixed it, and the final normal workflow passed. It does not install a registry Marionette release or establish live publication.

Reported tests apply to this working slice, not earlier documentation or a live deployment.

## Remaining work

1. Migrate the repository API-contract checker: it currently fails opening removed `docs/typescript.md`, and its compact-reference/symbol mappings still target the retired corpus. Preserve source-signature and behavioral checks while rebuilding documentation links; do not manufacture coverage for missing families.
2. Audit legacy `test/fixtures/docs-*` consumers and replace their retired-page validators. The full fixture/release certification suite was not rerun or claimed green.
3. Verify the external website importer against the new export, then complete Radio, utilities, adapters, errors/lint guidance, TypeScript, common task guides and migration coverage.
4. Run a frozen independent reader evaluation at a coherent content milestone. Current tests establish delivery and contract correctness, not superiority over older docs or reliable application architecture.

The retained release artifact names (`developmentStarter` and `starter`) are required by the current artifact verifier. This compatibility is limited to that active artifact contract; rename them only with the producer and verifier updated together. They no longer determine consumer documentation or npm package contents.


## Reference organization follow-up

The maintainer clarified that optional package APIs, shared class behavior, runtime configuration and provider authoring are different reader needs. The current index and site navigation now distinguish them:

- `docs/api/`: core class references and the runtime configuration reference.
- `docs/api/shared/`: common methods, events, state and rendering/View bindings (formerly `view-runtime`).
- `docs/api/providers/`: core interfaces for data/state and rendering/DOM providers.
- `docs/packages/`: companion package APIs, beginning with optional `@mnjs/data`.
- `docs/integrations/`: concrete setup recipes using supplied packages.

Moved pages have one canonical location; inbound links, agent routes, package discovery, navigation and example extraction follow that location. The reference runner discovers nested core and package pages and namespaces fence checks by source path. Historical review/package evidence above retains its original paths and hashes.

Verification after reorganization: final `npm run docs:check` passed (7 export tests, 15 executed examples, 16 declaration fixtures, 67 HTML files and 811 internal links, plus a fresh installed-package lookup/reference run). Retrieval/plugin checks passed 9 tests. Changed test JavaScript passed ESLint. The [new installed-package evidence](evidence/delivery-data-reorganized-package.json) records the reorganized corpus. The previously documented API-contract and legacy fixture gaps remain separate outstanding work.
