# Completeness and consistency results

2026-09-30. Based on `47cb69d164091f47e5796173d02eb8d2259862c7` with this local audit diff. Evidence below records the tested dirty snapshot; it does not refresh earlier milestones.

## Outcome

The bounded pass reconciles the existing framework-wide corpus with public contracts, declaration examples, installed discovery and private reference patterns. It adds no consumer pages, framework runtime behavior, dependencies or helper layer. The optional records lesson remains one teaching case.

Three subagents independently inspected API coverage, writing/declaration examples and private architecture patterns. Their [API](evidence/completeness-api-audit.md), [writing](evidence/completeness-writing-audit.md) and [pattern](evidence/completeness-pattern-audit.md) reports retain findings and limits. The private comparison was read-only against a dirty rc.1 reference, not a consumer acceptance run for this rc.2 candidate.

## Corrections

- Clarified manual-child identity and comparator-dependent placement, prepared-root cancellation and rejection of Region-owned roots, property-key types, hook recursion, and custom-provider identity versus DOM retention. Extended existing manual-child reconciliation tests for same-key replacement under three comparator policies.
- Added canonical installed-reference discovery to utils/adapters READMEs. Task discovery routes shared state to its core/provider contracts before optional data. Existing installations can go directly to a task.
- Removed two declaration-example `escapeHtml` helpers in favor of the existing optional Lit adapter. Kept Region and child ownership as the teaching goals, with no declaration signature changes.
- Handled terminal failures in records open/retry/close UI-intent calls. Added browser assertions for rejected close and failed retry recovery; the latter dispatches the page's retry intent directly and does not claim Retry-button interaction.
- Clarified the external-host boundary for retained refresh. Reconciled stale planning status and public coverage disclosure.

The semantic inventory now records **54 documented groups and two partial groups**. These are metadata dispositions, not a completeness score. A complete custom immutable-store integration and exact Application destination-binding/reentry order remain partial. Existing runtime limitations remain visible; this audit does not resolve them.

## Verification

All commands below ran successfully. [Execution summary](evidence/completeness-verification.json) records counts and log hashes; the [installed report](evidence/completeness-installed-report.json) records package/content hashes.

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build`, `npm run build:types` | Passed |
| Full unit suite | `npm run test:unit` | 138 files, 2,125 tests passed |
| Tooling suite | `npm run test:tooling` | 380 tests passed |
| Final metadata/retrieval | `node --test test/tooling/api-contracts.test.mjs test/agent-docs/retrieval.test.mjs` | 16 tests passed |
| Documentation gates | `npm run docs:check` | 46 actual fences, 15 TypeScript examples, 20 declaration fixtures passed |
| Final installed candidate | `npm run docs:package`, `npm run check:docs-installed` | 38 pages; five packages; discovery, lint, compiler and consumer-test recipe passed |
| Guide browser behavior | `npm run test:browser -- test/browser/docs-guides.spec.mjs --workers=2` | 24 checks passed |
| Records browser behavior | `npx playwright test --config examples/records/playwright.config.js --workers=2` | 54 checks passed |
| Final records failure cases | Same config with `--grep 'UI close\|retry intent'` | Six checks passed after retry-test label correction |
| Site and links | `npm run docs:build`, `node scripts/docs/check-links.mjs` | 83 pages built; 84 HTML files and 1,103 internal links validated |
| Packaged declarations | Inspect actual `npm pack ./.package --ignore-scripts` tarball | Four ESM/CJS declaration examples include optional Lit and omit helpers |

Focused lint and whitespace checks passed. The [declaration inspection](evidence/completeness-declarations.json) records its tarball hash. Exact existing Application tests, `cancels preparation by selecting the already displayed root` and `rejects a directly displayed root while preserving a prepared replacement`, back the added ownership prose. Existing CollectionView sorting coverage includes children without a source model; extended reconciliation checks cover actual manual Views and comparator policies.

One early documentation check failed while the records dev build concurrently replaced shared artifacts. The sequential rerun and final installed check passed. Avoid overlapping these build consumers; this was not evidence of a consumer runtime failure.

## Claude consultation

The [first review](evidence/completeness-claude-review.json) received the public diff, audit findings and neutral private-pattern conclusions with verification still pending. It requested clearer ownership/sorting wording, optional-integration labeling and complete delivery evidence. Those changes were made; READMEs already changed locally were included in the second review input.

The [second review](evidence/completeness-final-claude-review.json) received the revised diff and available verification. It reported no blocking issues and suggested precise retry-test labeling, installed-root wording, model-less manual-child wording and exact contract/declaration evidence. These were addressed and checked after that review. The suggestion to extract a recovery helper was not adopted: the short intent-handler chains remain readable without another abstraction. Claude reviewed supplied artifacts; it did not independently run the suites or measure readers.

## Strengths and limits

**Strengths:** independent task/reference structure, consistent native ownership, explicit optional-provider boundaries, delivered declaration/discovery checks and browser failure coverage. The changes address general reader needs rather than a benchmark's expected answer.

**Limits:** passing checks establish specific contracts and examples, not best-in-class teaching effectiveness. Search tests are authored probes, not independent readers. A dirty private source comparison cannot prove consumer compatibility. Third-party widget integration, a real consumer migration, registry/live deployment and the two detailed semantic gaps remain separate work.

The refreshed peer check supports the structural choices: [React Learn](https://react.dev/learn) and [React reference](https://react.dev/reference/react) separate task learning from API lookup; [Svelte's AI guidance](https://svelte.dev/docs/ai/overview) combines concise instructions, retrieval and framework analysis (checked 2026-09-30). This is a structural comparison, not a measured ranking or evidence that Marionette can reproduce compiler analysis.

## Next validation

Freeze compatible documentation conditions against the same runtime. Use a small controlled fresh-reader comparison on unseen local interaction, managed readiness and extension tasks, scoring discovery, ownership, functional outcomes and unnecessary scaffolding separately. Follow with a real consumer migration/test path. Add authoring only for independently useful gaps these results or the coverage inventory justify.
