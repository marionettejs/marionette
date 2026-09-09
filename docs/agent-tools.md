# Set up an agent

Use the installed package's documentation and a small application instruction file
first. The optional Marionette skill helps an agent select those documents and
apply their lifecycle and integration rules. None of these resources requires an
account, network access, hosted model, or shared API key to read.

## Install the consumer skill

Builds containing these resources ship `dist/agent-skill/` and `dist/docs/` inside
the `marionette` package. Check that both exist in your installed package before
following these steps; earlier artifacts do not contain them. Do not upgrade an
application just to install instructions.

Copy the whole `dist/agent-skill/` directory, including `scripts/`, into the skill
location supported by your agent client, naming the copied folder `marionette`.
Use the client's documented installation mechanism; installing an npm dependency
does not automatically activate an agent skill. For a source checkout, the same
skill lives in `skills/marionette/`. Use the checkout matching the package's known
source revision.

For a client configured to read project skills from `.agents/skills`, run this
from your application directory when that destination does not already exist:

```sh
mkdir -p .agents/skills
cp -R node_modules/marionette/dist/agent-skill .agents/skills/marionette
```

Adapt the source path for a hoisted dependency or package manager without
`node_modules`. When updating an existing copy, review its local changes and
replace it deliberately; do not create nested copies. Keep the skill in the
application's repository if the team should share it. Update it alongside the
package, reviewing any project-specific edits. Agent clients differ in discovery
and reload behavior; follow the client's setup instructions and confirm that it
lists `marionette` before relying on automatic selection.

In a client supporting named skill invocation, try:

```text
Use $marionette to inspect this application's installed version and integrations.
Find the matching routing guide and explain which component owns cancellation.
Do not change the application yet.
```

A successful activation identifies the installed package, reports its documentation
revision, reads the relevant page, and distinguishes the router from Marionette's
lifecycle. A response that only repeats the prompt has not demonstrated retrieval.
If the client cannot load skills, give it [Build with Marionette](./agents.md) and
the matching task guide directly; the skill is an optional entry point.

## Read matching docs locally

The skill bundles a read-only helper requiring Node 24 or later. It addresses a
specific retrieval problem: the copied skill must locate the application's
installed docs, including hoisted dependencies, without importing application code.
It does not add a server, registry, or production dependency.

```sh
node .agents/skills/marionette/scripts/docs.mjs --project . --list
node .agents/skills/marionette/scripts/docs.mjs --project . --page docs/routing.md
```

`--list` returns JSON with absolute page paths, version, source revision, local
change status, and content digest. `--page` accepts an exact `source` path from
that list and prints one provenance record followed by the page's Markdown. Run
from the application workspace, not a neighboring package with a different
Marionette dependency. `--project` defaults to the current directory.

For a package manager without a physical `node_modules` tree, find that
application's physical package directory using its package manager and supply
`--package-root /path/to/marionette`. The helper does not execute resolver hooks or
install packages to guess that path. Exit status `1` indicates missing docs,
invalid arguments, a version mismatch, or inconsistent files; it does not silently
switch to a different source.

The helper validates documentation hashes and their package version. This proves
that the files agree with their manifest, not that an arbitrary custom runtime was
built from that revision. Check installed exports and test uncertain behavior. An
alpha version alone cannot identify a source commit; `sourceDirty: true` means
local changes are included. Older packages without docs require an exact release
or known source checkout, not an automatic fallback to today's website.

## Record the application decisions

Adapt the [application instruction template](./application-agent-template.md).
Record actual integration choices, initialization points, resource owners, and
working test commands. Keep those decisions in the application. The library's
maintainer `AGENTS.md` describes changing Marionette itself and should not be
copied into a consumer application.

## Connect the optional documentation MCP

The public, read-only endpoint is `https://mcp.marionettejs.com/mcp`. Configure
it explicitly in a client that supports Streamable HTTP; no server login or API
key is required. Follow the website's [MCP setup guide](https://marionettejs.com/docs/mcp/)
for client configuration and the optional local stdio server. Installing the npm
package or copying the skill does not establish an MCP connection.

1. Read the `marionette://catalog` resource and compare its
   `provenance.packageVersion` and `provenance.sourceRevision` with the installed
   documentation manifest. A matching version label alone is insufficient.
2. Pass the exact installed `version` to every `search_docs`, `get_doc`, and
   `get_example` call. The server rejects unsupported versions, including `latest`
   and `next`; do not upgrade the application to match the server.
3. Use a search result's `id` as `get_doc.path`. Follow each returned `nextOffset`
   until it is `null` to read the complete document. For an example, use its catalog
   `id` as `get_example.name` and retrieve all chunks before parsing the recipe JSON.

The hosted snapshot may lag a new release or candidate. Use installed Markdown
when provenance does not match or the service is unavailable. Retrieved recipes
still need application tests; this server does not inspect or run your application.
Keep private application data out of hosted documentation queries.

## Choose an optional service only for a specific need

| Resource | Useful for | Boundary |
| --- | --- | --- |
| Packaged Markdown and manifest | Reading the contract shipped with an installed package | Available offline; verify custom runtime provenance separately. |
| Website Markdown and `llms.txt` | Discovering pages and reading a published snapshot | An index is a set of links, not automatic instruction installation. Check version and source metadata. |
| Documentation MCP | Structured search, full-document retrieval, and example discovery | Follow the [MCP workflow](#connect-the-optional-documentation-mcp). Check catalog version/source and follow pagination. It does not inspect or test your application. |
| Context7 | Finding relevant excerpts through a supported agent integration | Optional third-party retrieval; results can omit setup or mix versions. Verify against the exact source. |
| Local skill helper | Finding and checking packaged docs from a consumer workspace | Reads files only; no network, project-code execution, or automatic fallback. |
| Website WebMCP tools | Operating the website's interactive example | Controls that example, not the consumer application. It is not a remote documentation server. |

For Context7, use the public `marionettejs/marionette` library and the client's
Context7 setup instructions. Each developer uses their own account and limits.
Do not put a maintainer's API key in a website, repository, or shared public proxy.
If a free quota is exhausted, read the static or installed docs directly; do not
enable paid overages. Check the current [Context7 plans](https://context7.com/plans)
and [documentation](https://context7.com/docs) before configuring an account.
Public indexing does not prove that the latest source configuration is active.

Marionette does not require a custom MCP server, a hosted AI chat, or a WebMCP
connection to build an application. Keep tooling outside the production import
graph and avoid duplicating the contract in tool prompts. The same documentation
remains available to human readers.
