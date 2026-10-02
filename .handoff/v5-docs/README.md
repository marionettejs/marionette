# Temporary v5 documentation handoff

This branch transfers an unfinished checkpoint. The `.handoff/` directory is transfer-only: keep its inputs outside the implementation checkout while evaluating, and omit it from the product PR. No runtime API changes are included.

## Baselines

- Library: `docs/v5-reset`, commit `1eb1f56fd9bba481ee833fd7df53a9a2edd9f800` (PR #599).
- Website: `docs/v5-reset-integration`, commit `5d5b1c9000e84ce71d8669eb6f58380abd7b7b11` (PR #42); unchanged by this handoff.
- Clean library baseline package: 38 documentation pages, 26 assets; content SHA256 `c25b901d10f5294ebaec59eea32cc32a0cef36041fa566783a2634fdb7b4164f`.
- Local unfinished candidate content SHA256: `a3f828091ebedca964a983df8e872f635f6ed286f47b441dd31fe64a6d19e57e`. This was built at the baseline revision with dirty source. Rebuilt revision/provenance will change after committing.

## Completed work and evidence

Canonical member contracts distinguish primary documentation routes from incidental mentions. Symbol schema 2 retains signatures and broad fallback references. Shared View bindings and the optional learning route were clarified. Search scoring is unchanged.

Before transfer, this command passed all 48 tests:

```sh
node --test test/agent-docs/lookup.test.mjs test/agent-docs/retrieval.test.mjs test/agent-docs/symbols.test.mjs test/tooling/api-contracts.test.mjs
```

Inventory/routes regeneration, docs packaging, narrow lint, and diff checks also passed locally. Full `npm run docs:check`, cloud reconstruction, held-out retrieval, and reader trials have not run for this checkpoint. Astra and Claude reviewed the plan; implementation review remains pending.

Development location hits increased from 10 to 13 of 16, preserving the nine previously successful question cases. CLI metadata shrank for most sampled symbols, but `Application.restart` grew from 3,837 to 5,315 bytes. These are development diagnostics, not evidence of reader effectiveness. See `development-summary.json`; do not use reserved questions for tuning.

## Continue in order

1. Verify all files against `manifest.json` and the three frozen inputs against `evaluation/FROZEN.sha256`. Preserve any existing cloud edits.
2. Reconstruct the clean baseline from the exact library commit in a separate checkout. Use `config/release-profile.json` and the lockfile, install dependencies, then run `npm run build` and `npm run docs:package`. Keep evaluation inputs outside this checkout. Verify canonical package page/resource/helper hashes and content SHA256; ignore host paths and archive byte identity. Baseline cloud parity is not yet demonstrated.
3. Adopt the 17 source changes, keeping `.handoff/` out of the product diff. Assess restart metadata growth and required facts without another query-specific tuning loop.
4. Run full `npm run docs:check`, affected tooling checks, and actual packaged/installed/copied helper checks. Obtain Astra/Claude implementation review when available.
5. Freeze the final candidate. Have an independent reviewer run each of the 12 reserved retrieval questions once per condition, save raw results before scoring, and preserve failures. Do not expose reserved queries to implementation agents or tune after observing their results.
6. Reader trials require separate authorization plus concrete runner/model settings and enforced aggregate and per-attempt budgets. `evaluation/launch-settings.pending.json` remains pending. Do not launch them from this handoff.
7. Produce a clean library snapshot, synchronize the website integration once, and verify parity plus its normal build/tests. Report results and limitations before publication or merge.

## Objectives

Keep docs centered on the framework rather than one example. Current Application contracts are async start/restart, retained restart, synchronous stop/destroy, and viewEvents for the view lifetime; remove hand-rolled refresh patterns. Local interactions and own-model persistence may belong in a View. Optional `@mnjs/data` is an incomplete observable-data layer; API access and persistence are separate concerns. Direct Markdown should suffice, with skills/MCP optional. Avoid example-only utilities, exotic recovery, private consumer references, and benchmark-specific prose. Preserve the rebuilt/removal scope of PR #599.

Only temporary handoff publication is authorized. Do not push other refs, open PRs, merge, release, deploy, or launch paid reader trials on that basis.

## Development measurement

`measure.mjs` takes a packaged library root, fixture path, and output path. Run it using `development.json` for development diagnostics. Raw output can contain local package paths and copied documentation; keep it outside tracked product files.

```sh
node measure.mjs PACKAGE_ROOT development.json OUTPUT_JSON
```
