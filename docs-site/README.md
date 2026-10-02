# Documentation publication

The library owns canonical Markdown, executable examples, the diagnostic catalog
and the application skill. The website owns presentation, search and deployment.
Read the [consumer index](../docs/readme.md) for application work and
[contributor guidance](../CONTRIBUTING.md) for library work.

## Build one identifiable snapshot

```sh
npm run build
npm run docs:check
npm run docs:export
```

`navigation.json` defines consumer pages, titles and routes. `resources.json`
selects the diagnostic catalog/schema, complete skill and records lesson source.
Planning, benchmarks and repository test fixtures stay outside the consumer export.

The export in `.docs-export` records package version, source revision, dirty state,
individual hashes and an aggregate digest. It includes a heading-section index for
focused retrieval and `docs-symbols.json` for exact public symbol lookup. Use
section search for an unknown location or symbol lookup for a known API member. These checks establish delivery and
specific example behavior, not independent reader effectiveness.

`docs:package` stages the same consumer snapshot in `.package`; pack that directory
for npm distribution. Root `npm pack` and Git dependencies do not deliver the complete
consumer corpus. The package includes the skill and readable records source; it
does not install an authored application starter. [Consumer tooling](../docs/tooling.md)
and [agent guidance](../docs/agents.md) describe its supported use.

For release evidence, use a clean checkout of the exact target commit and preserve
the five package tarballs and their hashes. Unrelated untracked files make the export
dirty too. A version string or a successful build does not authorize publication.
The checked-in [publication policy](../config/release-promotion.json) and exact-artifact
release certification determine whether a package can be published.

## Integrate the website

Use the current `marionettejs/marionettejs.com` checkout and its instructions:

```sh
npm run docs:import -- /absolute/path/to/.docs-export
npm run check
node scripts/check-agent-site.mjs --local --report output/agent-retrieval.json
```

Run these commands in the website repository. Review navigation, import provenance,
Markdown alternatives, search, `llms.txt`, diagnostics and the MCP corpus together.
An unreleased candidate must remain identified as a candidate. A published archive
must match its npm package bytes; publication wording must not disguise a different
runtime or source revision. The website's demo/workshop runtime has separate provenance.

The website's ordinary reading-copy sync opens a PR from merged library `master`.
It does not replace package archives or skill assets. Navigation changes stop for
explicit website review, so a rebuilt corpus requires an integration update. Package,
skill or resource changes need an explicit snapshot import, not a reading-copy sync.
The sender workflow requires `WEBSITE_DOCS_DISPATCH_TOKEN`; receiver setup is in the
[website sync guide](https://github.com/marionettejs/marionettejs.com/blob/main/scripts/docs-sync/README.md).

## Deploy and verify

Merging a reviewed website change into `main` runs the shared
[site/MCP deployment workflow](https://github.com/marionettejs/marionettejs.com/blob/main/.github/workflows/deploy.yml).
It checks the artifact, publishes/verifies Pages, then publishes/verifies MCP from
that same checkout. Follow the [deployment and rollback runbook](https://github.com/marionettejs/marionettejs.com/blob/main/mcp/DEPLOYMENT.md);
do not publish the website out of band. Library merges, local exports and plugin
changes do not themselves deploy the integrated website.

Before deployment, record the target commit, documentation and runtime hashes,
previous Pages deployment and Worker version. Verify that the advertised version,
all Markdown/diagnostic URLs, search and MCP catalog/tools agree with the reviewed
artifact. Exercise the deployed website and a consumer production bundle separately.
Check direct visits, asset/API errors, failure/retry, teardown, keyboard and focus.
A local server check does not establish CDN cache behavior or Worker CPU limits.

Pages and Worker uploads are sequential, so a failed Worker deployment can leave the
services temporarily on different snapshots. The deployment runbook owns recovery
and rollback. Retain installed/static docs independently of MCP and keep the existing
free-plan constraints; local timing does not prove edge resource compliance.

`docs-site/CNAME` and the opt-in `DOCS_PAGES_ENABLED` workflow describe a separate
diagnostic Pages artifact. They do not publish the integrated website. Retire that
artifact only after its existing domain and diagnostic routes are handled by the
reviewed deployment. Preserve published v4 documentation for its active consumers.

## Optional retrieval channels

The local skill works without a hosted service. The optional hosted MCP catalog must
match the application's installed version and source revision before use; matching
version strings alone do not establish the same contract. It does not run code or validate
an application's architecture. Verify catalog identity, document hashes, focused
retrieval and explicit version-mismatch rejection after each deployment.

`context7.json` selects library `master` and declares supported release tags in
`previousVersions`. Its rules require matching the installed package version;
`master` may differ from a published release. After configuration changes merge,
refresh the library and verify the requested version and representative contracts.
A refresh request is not evidence of correct retrieval.
Context7 is optional; do not make installed documentation or the website depend on
its availability. See [Context7's owner documentation](https://context7.com/docs/library-owners).
