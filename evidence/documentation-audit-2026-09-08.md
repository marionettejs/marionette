# Documentation audit, September 8, 2026

Final library base: `2b5fde974abd94c2da911a02a4bbc0b486c7f661`, with uncommitted documentation work and the child-event map ownership fix. Earlier reading and implementation trial evidence retains its own base and documentation digest.

## Scope and evidence

Three agents completed line-by-line reviews of 54 assigned documentation files. The core and companion comment inventories cover 63 authored source files. After upstream Region teardown and native data changes landed, the affected contracts and comments were reviewed again against the final base. Detailed inventories, corrections, and limits live in `docs/maintainers/line-audit-*.md`, `source-comment-audit.md`, and `package-comment-audit.md`.

The sole runtime difference from this base is the own-property check in `src/mixins/view.ts` for child-event maps. Regression tests reproduced inherited event-name failures before the fix. A TypeScript parser/printer comparison with comments removed confirmed other modified authored TypeScript files differ only in comments.

## Final validation actually executed

- `npx vitest run --coverage --maxWorkers=2`: 120 suites, 2,024 tests passed; 100% statements, branches, functions, and lines.
- `npm run test:fixtures`: all 40 installed-package fixtures passed, including build, declaration consumers, exact documentation examples, portable skill lookup, and packaged relative-link/hash verification.
- `npm run test:browser`: all eight browser scripts passed in Chromium, Firefox, and WebKit, including the documented form keyboard, native validation, draft/focus/selection, retry, and teardown checks.
- `npm run docs:check`: 29 marked examples across 17 fixture validators; 105 generated HTML files and 1,588 internal links checked. The fixture run above, rather than markers alone, executes the examples.
- `npm run lint:ci`, `npm run test:dist`, `npm run test:source`, and `git diff --check`: passed.
- Portable agent helper: eight tests passed. Agent benchmark contract: 19 tests passed. These helper/contract runs preceded the final upstream integration; their implementation did not change during integration.
- Website: `npm run check` passed all 15 tests after importing the final 61-page snapshot. It contains 45 consumer pages also shipped in the package.
- Browser review confirmed desktop and phone-width search, consumer-first results, current installation wording, and previous/next guide navigation.

The first full coverage run on the earlier base had two five-second timeouts while validation overlapped. A bounded two-worker rerun passed, as did the final-base run. An initial package fixture caught missing shipped Markdown targets; the final successful run includes their corrections. Do not omit these failures when evaluating the validation history.

## Agent and publication boundaries

Three independent implementation submissions passed withheld navigation, editable-list, and widget-lifetime checks on their recorded earlier snapshot. Saved task reports and implementations are in `benchmarks/docs/results/2026-09-08/`. These finite trials do not establish comparative Vue performance, automatic skill discovery, or measured agent gains.

The user authorized a progress deployment of the whole v5 website to `v5.marionettejs.com` for teammate review. The main website and npm release were not changed. The deployment retains development provenance and noindex. Its homepage demo remains on its explicitly pinned runtime; it does not run the current library audit build.

Context7 public registration exists, but publishing the source configuration, ownership proof, and checking curated retrieval remain separate work. No paid service, shared query key, or hosted MCP backend was added. Runtime diagnostic URL alignment remains a release/publication follow-up. The complete reference application remains explicitly deferred. Screen-reader review and full application composition are not established by this audit.

Deployment artifacts, exact file hashes, source backup, Cloudflare deployment IDs, rollback targets, and live checks are retained under the local `marionette-v5-docs-progress-20260908-2b5fde97` artifact directories.

Final v5 deployment: `081db671-acac-4777-b366-00931b93aee7`. All 416 served artifacts matched their saved SHA-256 hashes. Cloudflare initially rewrote one package identifier as an email address; the final documentation-only `no-transform` header prevents that transformation. The original pre-docs rollback target remains `0f666b8b-bfd7-4c04-bff6-829426f69b40`.


# Documentation delivery follow-up — September 9, 2026

Website source: marionettejs/website, feat/integrated-v5-preview, base 592349b plus saved working changes. Library source: 2b5fde974abd94c2da911a02a4bbc0b486c7f661 plus working changes.

The independent public reader found overly broad Backbone integration wording and unclear package/source matching. These installation claims were corrected. The opening now offers three entry paths and an executable counter. Supporting fixtures, skill files, and saved trial evidence are explicitly exported with hashes; the website publishes exact text under /docs/source/ and resolves evidence links there. Historical backbone.marionette URLs retain their repository. Demo provenance now describes the public preview and separately identifies documentation provenance.

Checks actually executed in this follow-up:
- npm run docs:package: 45 consumer pages; benchmark evidence excluded, consumer fixtures and portable skill retained.
- npm run docs:check: 30 example markers across 17 fixture validators; 105 HTML files, 1,557 internal links.
- Fresh local tarballs installed into two isolated fixtures: docs-package and docs-application-guides passed. The former checked hashes, 397 relative links, portable skill lookup, and consumer/evidence boundaries. The latter executed the exact counter, TypeScript, testing, security, form, and widget examples.
- Focused ESLint and git diff --check passed.
- Integrated website npm run check: 19 tests passed, including exact source asset publication, link rewriting, historical repository identity, and rejection of altered or unsafe asset paths.

Deployed Cloudflare Pages marionette-v5: 818b77b6-67de-4782-8b33-8aa28540a101.
All 447 served files match the frozen 448-file artifact. The remaining file is
`_headers`, which Cloudflare consumes as deployment configuration rather than
serving as content; its effective response headers were checked separately. Four initial checks saw propagation differences; targeted retry passed. Both verification records are retained. Supporting source responses have text/plain, nosniff, no-transform, and noindex headers. Live opening page visually inspected; routing search returned 18 results.

Rollback: 4e6f4920-f3d0-462e-a5e3-77573fd9a776. Static files only; no data migrations, paid services, main-site change, library publication, or source push. Website ownership returned to the marketing task for the user's newer navigation request after this artifact was verified; that later change is not part of this deployment. Full reference application remains deferred. This finite delivery pass does not claim universal documentation accuracy or measured parity with peers.
