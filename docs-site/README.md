# Documentation publication

The library repository owns documentation and executable examples. The website
repository owns presentation, navigation UI, search, and the deployment artifact.
Both render the same Markdown; do not maintain a second reference in website HTML.
The consumer documentation starts at [the documentation index](../docs/readme.md).
Importing reference docs does not update the playground runtime or deploy the website.

## Build and review

```sh
npm run build
npm run docs:check
npm run docs:export
```

`navigation.json` lists the current consumer corpus, including nested API pages,
with one title, section, and route per page. `resources.json` explicitly lists the
supporting diagnostic catalog, agent skill, and records example source. Planning,
evaluation results, and repository test fixtures are excluded from the export.

`docs:check` validates navigation coverage, exact exported bytes, relative resource
links, generated HTML links and anchors, agent routes, and the reference examples.
The example check executes actual documentation fences with JSDOM and checks their
TypeScript declarations against the built packages. It does not establish browser
behavior or reader effectiveness. The records example has separate browser tests.

`docs:export` writes `.docs-export/manifest.json` and the selected files at their
repository paths. It also produces `docs-sections.json`, which records verified
heading offsets for local lookup. The former symbol-to-contract index is not
published: its semantic mappings refer to retired documentation and need a separate
coverage audit before being offered again.

The manifest records package version, source revision, working changes, each
file's SHA-256, and a combined content hash. It contains no timestamp or network
input. `docs:package` stages those same consumer pages and resources in `.package`
for npm packaging. The package includes the records source for reading alongside
the lesson; it does not install a separate authored application starter.

The website imports the canonical snapshot explicitly:

```sh
npm run docs:import -- /absolute/path/to/.docs-export
npm run check
```

These commands run in the website checkout. A library export does not deploy the
website. The imported site must retain the snapshot's provenance and display local
changes as such. A changed document requires a new website import.

For a release snapshot, export a clean checkout of the exact release commit and
preserve the importing website revision. Package and site content must not be
silently replaced with a different version. The homepage demonstration has its own
runtime provenance; importing documentation does not update that runtime.

## Website integration

The integrated prototype renders the full reference under `/docs/`, with local
Pagefind search, Markdown alternatives, a scoped `llms.txt`, and links to exact
source provenance. The existing website's layout and static builder remain the
presentation layer. A framework migration is not required to obtain those features.

The library's `.docs-site/` renderer remains a validation surface and the existing
diagnostic-host artifact. It now uses the same complete navigation list rather
than a separate publication allowlist. It maps `/docs/` entries to `/development/`.

## Hosting and distribution choices

The default recommendation is Cloudflare Pages for the integrated static website.
Keep GitHub as the canonical source and package distribution, and use Context7 as
an optional retrieval channel. A docs-specific hosting service is an alternative
when its managed version navigation is worth adapting the existing site.

| Service | Role and current free boundary | Decision for Marionette |
| --- | --- | --- |
| Cloudflare Pages | Static asset requests are free and unlimited when they do not invoke Functions. The free plan permits 500 builds/month, 20,000 files/site, and 25 MiB/file. | Preferred host for the combined website and docs under the popularity constraint. Build once per reviewed content change; serve static files. |
| GitHub Pages | Public repositories can use GitHub Free. Published sites have a 1 GB limit and a soft 100 GB/month bandwidth limit; rate limiting can apply. | Suitable for a small site or recovery copy, but less suitable as the primary host if traffic grows dramatically. |
| Read the Docs Community | Free for open-source projects with public docs and advertising-supported hosting. | A credible managed-docs alternative if the project accepts its advertising and platform integration. Keep canonical Markdown in this repository if adopted. |
| Context7 | Optional public-repository indexing and retrieval; consumers use their own accounts and quotas. | Add discovery without making the website depend on its API or availability. It does not replace the website host. |

These are current plan boundaries, not promises that a provider will retain the
same terms indefinitely. Recheck them before enabling a service. Do not attach a
paid plan, enable usage overages, or add an automatic upgrade to compensate for
traffic. If the free service is unavailable, retain downloadable package docs and
the repository; consider another free static host instead of silently incurring a
bill. Do not maintain a second independently authored documentation set.

Sources checked September 2026: [Cloudflare static pricing](https://developers.cloudflare.com/pages/functions/pricing/),
[Cloudflare platform limits](https://developers.cloudflare.com/pages/platform/limits/),
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits),
and [Read the Docs platform choices](https://about.readthedocs.com/choosing-a-platform/).

## Deployment decision

The public website and optional documentation MCP have separate manual deployments.
Prepare and review the complete static website artifact and matching MCP corpus,
then follow the [website deployment runbook](https://github.com/marionettejs/marionettejs.com/blob/main/mcp/DEPLOYMENT.md)
for the authorized hosting configuration and live checks. Keep static and installed
documentation available independently of MCP. Record the previous deployments so
content and presentation can be restored together if needed.

Keep hosting within the authorized free plans; do not enable paid overages or an
automatic upgrade. Record measured MCP CPU limits and accepted availability
limitations for each release. A successful request does not prove the service
stays within its provider's nominal resource budget. Domain registration remains
an existing separate cost.

The catalog reserves `/errors/<code>/` routes. Coded runtime `MarionetteError.url`
values point to `https://marionettejs.com/errors/<code>/`, where the integrated
website generates catalog pages from the same source. Do not remove published
error codes or leave their URLs unresolved.

`docs-site/CNAME` configures `docs.marionettejs.com` for the separate diagnostic
artifact. The existing `DOCS_PAGES_ENABLED` gate is unchanged. Retire that separate
Pages deployment and library presentation scaffold only when its domain is served
by the integrated artifact; keep the shared catalog and export validation.

Legacy documentation at `marionettejs.com/docs/current/` describes earlier releases.
Do not replace it implicitly when deploying the v5 preview. Stable and immutable
release URLs require actual release snapshots and a separately reviewed route map.

## Context7

`context7.json` selects current consumer documentation and excludes maintainer
policy and migration comparisons from default retrieval. Migration guides remain
available through the canonical index; agents doing an upgrade should open those
explicitly so old and new APIs retain their before/after context. The public library
is `/marionettejs/marionette`; its development branch is `master`. A user should
select documentation matching their actual installation or source revision.

Keep parsing policy in this repository so changes can be reviewed alongside docs.
Ownership verification requires the public proof file on the default branch; a
local file alone does not claim the library. Refresh indexing after the reviewed
configuration lands. Test representative retrieval for version confusion and
integration choice before presenting Context7 as a reliable shortcut.
For a release, follow the [Context7 steps in the release checklist](../docs/maintainers/release-checklist.md#5-close-the-release-or-recover):
register the published version, request a refresh, and verify actual retrieval.
Refreshing the configured development branch does not pin it to a release.

Each developer connects Context7 using their own account. The docs site does not
proxy queries or distribute a maintainer API key. Free-tier throttling may make
Context7 unavailable; canonical Markdown, package documentation, and local website
search remain usable. Do not enable a paid plan or usage overages.

Sources checked September 2026: [Context7 configuration](https://context7.com/docs/library-owners),
[Context7 ownership](https://context7.com/docs/howto/claiming-libraries),
[Context7 plans](https://context7.com/plans), and
[Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## Continuous website reading-copy sync

Merges affecting rendered reading-copy sources request the website's single
[reading-copy sync workflow](https://github.com/marionettejs/marionettejs.com/blob/main/.github/workflows/docs-sync.yml).
It reads the latest merged `master` Git objects, preserves website publication
wording with a three-way merge, validates the complete website/MCP artifact, and
creates or updates `automation/library-docs-sync` as one ready website PR.
Dispatches contain no executable code, source URL, or revision to trust; delayed
requests always converge on current `master`. Use **Request website documentation
sync → Run workflow** to retry failed delivery or recover a missed event.

This is development/CI tooling only: no library runtime cost. Supporting-resource-only changes (`docs-site/resources.json`, catalogs, skills,
fixtures and benchmark assets) intentionally do not dispatch: the receiver leaves
those archived assets pinned and synchronizes Markdown pages only.
Ordinary syncs never
run a library build, change package versions, import a new npm archive, or copy
skill/starter assets. Reading-copy edits carry their exact source revisions and
hashes separately from the immutable npm archive. Conflicting publication edits
stop for review rather than overwriting website wording.

Setup: create the repository secret `WEBSITE_DOCS_DISPATCH_TOKEN` in this library
repository. Use a fine-grained token restricted to `marionettejs/marionettejs.com`
with **Contents: write**, the permission required by GitHub's repository dispatch
endpoint; no access to write this library is needed. Store the value only in
Actions secrets. Configure the receiver and its PR credential first, then enable
this sender. See the website's `scripts/docs-sync/README.md` for receiver setup,
branch rules, validation, conflict recovery, and token rotation. The default
`GITHUB_TOKEN` cannot dispatch across repositories.

An npm release remains an explicit import in the website. Read the exact revision
from the published package's `docs-manifest.json`, export with `npm run docs:export`
from a clean checkout of that revision, and import the complete `.docs-export` with
`npm run docs:import -- /path/to/released-source/.docs-export`. The full export
preserves maintainer pages that the consumer npm package omits.
Require matching version/repository/revision, `sourceDirty: false`, identical
metadata and bytes for every npm consumer page/asset, and the reviewed maintainer
route inventory. Website `npm run check` verifies the npm subset against the pinned
installed package; review the full manifest diff for maintainer scope. Review
publication edits and supplemental schema provenance with that import. Ordinary
merges must never import a moving or unreleased export into this archive.

Neither workflow merges PRs or deploys. After the website sync PR merges, manually
build and deploy the complete website and MCP from the same reviewed website
commit, record the corpus hash, and follow `mcp/DEPLOYMENT.md`. Existing diagnostic
Pages hosting is a separate opt-in workflow; this sync grants no Pages, deployment,
package, or release permissions.
