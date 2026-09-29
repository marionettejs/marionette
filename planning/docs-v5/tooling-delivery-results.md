# Tooling and delivery integration results

2026-09-30. Local implementation is complete for the assessed documentation entrypoints, agent distribution, retrieval surfaces and production consumer checks. Public publication and live retrieval are separate gates.

## Delivered

- Root README, contributor instructions, AGENTS and test guide route readers to current contracts and real commands. Broken references to retired maintainer pages were removed. Entrypoint links and commands have focused checks.
- The existing root `llms.txt` already covers all 38 consumer pages. A navigation coverage check and omitted-page control guard that coverage. No additional consumer page or framework runtime was added.
- Npm consumers can copy the delivered skill; the repository plugin requires a matching source checkout. Hosted guidance checks version and revision. The copied skill remains usable offline. Actual client evidence distinguishes discovery from activation.
- Context7 selects the canonical `docs` corpus, includes independent companion references, and excludes maintainer roots. Its current owner schema validates. It still selects public `master`; no registration or feature-branch retrieval is claimed.
- The diagnostic schema now accompanies its catalog. A clean export supplies the website's navigation, HTML, Markdown, Pagefind search, llms bundles, diagnostics and MCP. Candidate publication status and the pinned published workshop runtime have distinct provenance.
- Candidate MCP requests require the correct source revision as well as version. Published labels require matching clean installed registry-archive evidence. Bundle coverage and task routes fail explicitly when inconsistent.
- The new production harness installs five explicit tarballs, copies their actual packaged records source and verifies the production bundle under `/records/`, with an origin-root API. It checks the installed module graph, transport cancellation, Retry, keyboard focus, reload, updated HTML/CSS and retained old hashed assets. This is one delivered teaching case, not a definition of all Marionette application architecture.

## Frozen candidate

The tested library source is **`37cda1fb3b370ac02b0f13988d6571e4524f4356`**, package version **5.0.0-rc.2**, `sourceDirty: false`. The consumer snapshot has **38 pages and 25 assets**, digest `04f344624bf4afa012adcedcfb0823b2cee9ce0303743c0920cc3bd861f18778`.

[Artifact identities](evidence/tooling-candidate-artifacts.json) retain the five tarball hashes and local archive location. The installed-doc and production checks use identical tarball hashes. Later reporting commits do not change which revision these results certify.

Website integration is isolated in `docs/v5-reset-integration` in the separate website checkout. It is committed locally as **`cc413baac0c0e80296fdfee11a57e68d73d7a08d`**. Its canonical imported identity matches this library snapshot; exact-head checks and Worker build identify that website commit. No library push, website merge, registry publication or deployment occurred.

## Executed verification

| Check | Result and scope |
| --- | --- |
| Full library tooling | 387 passed on the final tracked source. Final affected entrypoint/plugin/discovery checks: 8 passed; strengthened host checks: 2 passed. |
| Final authoring docs gates | Passed: 7 export tests, 46 executable fences, 20 declaration fixtures, 15 TypeScript examples, 84 HTML files / 1,103 internal links and 38 installed consumer pages. |
| Clean source build and installed recipes | Passed from the frozen commit; exact five tarball hashes match production inputs. Installed examples, lint/type invalid controls, consumer testing mutation and TypeScript recipes passed. |
| Actual client smoke | Codex 0.159.0 discovers the copied project skill as enabled and reads the local marketplace; local lookup succeeds with networking disabled. Claude Code 2.1.119 validates its manifest. No global install, model turn or client MCP startup. |
| Production consumer | Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6 passed five HTTP/build checks plus eight browser groups per engine. Only intentional 503 and cancelled API requests were observed. |
| Website full build/tests | 88 passed against the final clean import. |
| MCP transport parity | 80 complete documents, one packaged example, 246 equivalent stdio/Worker tool calls. Version/revision rejection and complete retrieval are covered. |
| Website presentation | All 38 pages at 1,280px and 375px: 76 page/viewport combinations plus rendered search passed. Existing published rc.1 workshop browser flow also passed during integration. |
| Local website HTTP | 96 readable resources, zero failures. |
| Worker artifact | Wrangler dry-run passed; exact-head rebuild and parity bind its deployment revision to the website commit. No upload. |
| Context7 / static quality | Current owner schema with URI format passed; affected lint and whitespace checks passed. No remote Context7 update. |

Evidence: [installed report](evidence/tooling-installed-report.json), [production report](evidence/tooling-production-report.json), [client smoke](evidence/tooling-client-smoke.json), [website HTTP report](evidence/tooling-website-http.json), [import provenance](evidence/tooling-website-import.json), [website/Worker identity](evidence/tooling-website-identity.json), [Context7 schema](evidence/tooling-context7-schema.json) and [execution log hashes](evidence/tooling-verification-logs.json). Production lockfile and build logs are retained beside the report. No runtime source changed, so the earlier full unit count is not presented as a new run.

## Claude review

The [initial review](evidence/tooling-delivery-claude-review.json) received the bounded library/website diff, production harness and actual verification limits. It requested stronger identity and browser assertions and final clean-import checks. Those changes were applied: unconditional hosted provenance guidance, candidate request revision enforcement, publication evidence, exhaustive bundles, pending shutdown assertions, network-error capture, installed module graphs and retained hashed assets.

The [follow-up review](evidence/tooling-delivery-final-claude-review.json) found no blocker for local commits, but caught missing candidate `sourceRevision` tool-argument instructions. The distributed guidance now follows `catalog.requestIdentity` and names both arguments; a focused check protects this contract. The clean export, tarballs, installed recipes, client smoke, production browsers and website checks were rerun. Example related-document links are validated and the candidate predicate is shared. Repeated synthetic Git-fixture cleanup failures were fixed with bounded removal retries and fixture-local maintenance settings; no product fallback was added. Official installation links and CLI marketplace help were verified read-only; `docs/maintainers` does not exist.

Two proposed removals/fixes were contradicted by inspection: the active published rc.1 package does use `dist/docs/manifest.json`, and the lookup helper imports `symbols.mjs` even without a distributed symbol index. Both required files remain. Obsolete instructional redirects were not restored merely because they were formerly published; no active consumer requiring those aliases was established. Active v4 archive and rc.1 workshop consumers remain explicit exceptions with their own runtime identity.

## Strengths and weaknesses

**Strengths:** one identifiable consumer snapshot supplies the package and every retrieval surface; distribution choices are clear; actual installed bundles and real browsers verify behavior. The corpus remains framework-wide and tooling work added no example-only abstractions.

**Weaknesses:** delivery consistency does not establish better fresh-agent outcomes. Full Claude/Cursor plugin activation is unverified. Local HTTP/dry-run checks cannot establish remote caching, account configuration or Worker CPU behavior. The private architecture comparison and prior consumer migration evidence do not certify this candidate in a real migrated application.

## Remaining public gates

Publication policy still disables rc.2 publication. A website main merge deploys Pages and MCP; this candidate branch must remain unmerged until the release/public documentation decision and corresponding release checks are complete. Publishing rc.2 docs currently also requires the documented website runtime/vendor upgrade and its workshop checks: published-archive identity is verified against the installed npm package. The active rc.1 manifest-layout exception is removed when that runtime moves. After publication, verify exact live Markdown/catalog/source hashes, search and MCP mismatch rejection; refresh Context7 from the intended public source and inspect returned contracts. Source revision links must be publicly reachable before those services advertise the candidate.

A real consumer migration, reserved fresh-reader comparison and the two disclosed detailed semantic API gaps remain in the [coverage inventory](coverage.md). They are not silently closed by delivery tests. No benchmark task wording or measured model preferences drove these documentation changes.
