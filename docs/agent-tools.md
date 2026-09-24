# Set up an agent

Use the installed package's documentation and a small application instruction file
first. For migration planning before installing the target, use the
[pre-migration path](#inspect-a-target-release-before-migrating) below. The optional
Marionette skill helps an agent select those documents and
apply their lifecycle and integration rules. None of these resources requires an
account, network access, hosted model, or shared API key to read.

## Get from a task to working code

| Situation | First read | Next action |
| --- | --- | --- |
| First screen in an existing project | [Quick start](./quick-start.md) | Adapt the complete module and check one interaction. |
| New project needing a toolchain | [Development starter](./development.md) | Copy the starter and run its validation. |
| Change an existing application | [Task table](./agents.md#read-for-the-task) | Read the selected guide and reuse the application's integrations. |
| One unfamiliar API detail | The matching page or declaration | Search for its symbol or heading; read the relevant section. |

Choose one retrieval route for the task. Installed Markdown is sufficient when
available; installing a plugin or connecting MCP is not a prerequisite. Record
package provenance and integration choices in the application instructions, and
refresh them when the dependency or configuration changes. Stop discovery once
the setup, update, and cleanup path is clear; verify the implementation before
broadening the search.

## Install the Marionette plugin

Install Marionette's upstream plugin when your client supports it. The plugin
bundles the consumer skill and the public read-only documentation MCP; the
application repository keeps only its own integration and verification decisions.

| Client | Plugin discovery | Install |
| --- | --- | --- |
| Codex and ChatGPT with plugin support | `.agents/plugins/marketplace.json` | [Codex CLI](#codex) |
| Claude Code | `.claude-plugin/marketplace.json` | [Claude Code setup](#claude-code) |
| Cursor | `.cursor-plugin/marketplace.json` | [Cursor setup](#cursor) |
| GitHub Copilot CLI | `.claude-plugin/marketplace.json` | [Copilot CLI setup](#github-copilot-cli) |

These marketplaces point to the same `plugins/marionette/skills/marionette/`
tree. The portable `plugin.json` and `mcp.json` serve clients that support Agent
Plugins 1.0. Claude Code reads its own manifest and `.mcp.json` from that plugin
directory. Installing the plugin does not change an application's dependencies.

### Codex

Until the plugin is listed in the public directory, add Marionette's repository
marketplace and install the plugin with the Codex CLI:

```sh
codex plugin marketplace add marionettejs/marionette --ref v5.0.0-rc.1 \
  --sparse .agents/plugins --sparse plugins/marionette
codex plugin add marionette@marionettejs
```

The repository marketplace is pinned to this immutable Marionette release tag.

Restart the client after installation, then confirm that `marionette` appears in
its plugin or skill list. The skill can activate implicitly for Marionette work or
explicitly as `$marionette`.

### Claude Code

Claude Code reads the marketplace in this repository and the plugin's
`.claude-plugin/plugin.json`, skill, and `.mcp.json`. After a release tag
containing these files exists, add its marketplace with
`claude plugin marketplace add marionettejs/marionette@v<version>`, replacing
`<version>` with that release's version. Then run
`claude plugin install marionette@marionettejs`. The `v5.0.0-rc.1` tag predates
the Claude Code marketplace, so it cannot be used for this installation.

Check that `/marionette:marionette` is listed and `/mcp` shows
the documentation server. A plugin reload or new session may be required.

### Cursor

Cursor can read `.cursor-plugin/marketplace.json` and the portable plugin in
`plugins/marionette/`. Its documented flow imports
`https://github.com/marionettejs/marionette` as a marketplace in Customize,
then installs the plugin. Importing the default branch
is a mutable preview until a release containing these files is available; the
`v5.0.0-rc.1` tag does not include the Cursor marketplace. Check that the
skill appears in Customize and that the documentation MCP is connected.

### GitHub Copilot CLI

Copilot CLI can read the same `.claude-plugin/marketplace.json` as Claude Code
and the portable plugin it references. After a release tag containing these
files exists, add its marketplace with
`copilot plugin marketplace add marionettejs/marionette#v<version>`, replacing
`<version>` with that release's version. Then run
`copilot plugin install marionette@marionettejs`. The `v5.0.0-rc.1` tag predates
this marketplace, so it cannot be used for this installation.

Confirm that the plugin is listed and its skill and
documentation MCP are available. Copilot in VS Code and Copilot cloud agent
have different setup surfaces; follow their client documentation to install a
skill and configure MCP.

The bundled MCP is optional evidence. Always compare its catalog's package version
and complete source revision with the application's installed documentation before
using remote results. The skill falls back to installed Markdown when they differ.

## Install only the consumer skill

Builds containing these resources ship `dist/agent-skill/` and `docs/` inside
the `marionette` package. Check that both exist in your installed package before
following these steps; earlier artifacts do not contain them. Do not upgrade an
application just to install instructions.

Clients without plugin support can copy the whole `dist/agent-skill/` directory,
including `agents/` and `scripts/`, into the skill location supported by the client,
naming the copied folder `marionette`.
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
node .agents/skills/marionette/scripts/docs.mjs --project . --page docs/quick-start.md
```

Use `--page` directly when the source path is known; `--list` is only needed for
discovery. Both modes return provenance, so listing first is unnecessary.
`--list` returns JSON with absolute page paths, version, source revision, local
change status, and content digest. `--page` accepts a package-relative source path
and prints one provenance record followed by the page's Markdown. For a relative
link in `docs/agents.md`, resolve `./forms-and-accessibility.md` to
`docs/forms-and-accessibility.md`; omit any `#heading` fragment. Use `--list` if
the source path is uncertain. Run from the application workspace, not a neighboring
package with a different Marionette dependency. `--project` defaults to the current
directory.

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

## Inspect a target release before migrating

Keep the application's installed version separate from the proposed target.
First record the current dependency name and resolved version from its manifest
and lockfile, including any npm alias. A v4 application may use
`backbone.marionette`; the helper searches for `marionette`, so “No installed
marionette found” does not mean the application has no Marionette dependency.

Download the exact target into a temporary directory without installing it in the
application. This example inspects `5.0.0-rc.1`; set `migration_target_version` to
the exact release selected for your migration, not `latest` or `next`. Downloading
requires npm registry access and publication of the selected version; before
publication, use the certified candidate tarballs described in the
[release-candidate guide](./beta.md). Reading the extracted docs requires Node 24 or later.
Run these commands in the same shell:

```sh
migration_target_version="5.0.0-rc.1"
migration_target_dir="$(mktemp -d)"
npm pack "marionette@$migration_target_version" --ignore-scripts --pack-destination "$migration_target_dir"
tar -xzf "$migration_target_dir/marionette-$migration_target_version.tgz" -C "$migration_target_dir"
node "$migration_target_dir/package/dist/agent-skill/scripts/docs.mjs" --package-root "$migration_target_dir/package" --list
node "$migration_target_dir/package/dist/agent-skill/scripts/docs.mjs" --package-root "$migration_target_dir/package" --page docs/migration-from-v4.md
node "$migration_target_dir/package/dist/agent-skill/scripts/docs.mjs" --package-root "$migration_target_dir/package" --page upgradeGuide.md
```

These commands leave the application's dependencies and lockfile unchanged.
Check that the helper reports the selected target version, and record its source
revision, `sourceDirty`, and content digest as **target documentation evidence**.
They do not describe the installed v4 runtime or prove migration success. Continue
to use the current version's matching docs and public APIs when investigating
existing behavior.

To install only the optional skill before upgrading, use
`$migration_target_dir/package/dist/agent-skill` as the source directory in the
[skill installation steps](#install-only-the-consumer-skill). Keep the extracted package
available and pass its explicit `--package-root` when reading target docs; copying
the skill does not change what `--project` resolves.

Use the [migration guide](./migration-from-v4.md) and
[upgrade guide](../upgradeGuide.md) to plan the change. Discover what the
application's wrappers and routing integrations own, then verify that behavior
against the target contract. Record application-specific findings in the
application; the generic skill is not a complete migration plan. After an
approved dependency change, resolve the installed package with `--project` again
and verify the migrated behavior with the application's tests.

## Record the application decisions

Adapt the [application instruction template](./application-agent-template.md).
Record actual integration choices, initialization points, resource owners, and
working test commands. Keep those decisions in the application. The library's
maintainer `AGENTS.md` describes changing Marionette itself and should not be
copied into a consumer application.

## Connect the optional documentation MCP

The public, read-only endpoint is `https://mcp.marionettejs.com/mcp`. The portable
plugin and Claude Code plugin each declare it; confirm that your installed client
actually connects. The skill also declares the connection in `agents/openai.yaml`;
OpenAI clients that honor this metadata can offer the MCP dependency when the skill
is installed alone. Clients using a copied skill may require explicit Streamable
HTTP configuration. No server login or API key is required. Follow the website's
[MCP setup guide](https://marionettejs.com/docs/mcp/) for client configuration and
the optional local stdio server. Installing the npm package or copying only the
skill does not guarantee an active MCP connection across clients.

1. Read the `marionette://catalog` resource and compare its
   `provenance.packageVersion` and `provenance.sourceRevision` with the installed
   documentation manifest. A matching version label alone is insufficient.
2. Pass the exact installed `version` to retrieval calls. The server rejects
   unsupported versions, including `latest` and `next`; do not upgrade the
   application to match the server.
3. For an API question, prefer `search_sections` and pass the returned heading IDs
   to `get_sections`. Read their ancestry and inspect `omitted` entries; request
   any needed sections separately. Batch related sections within the advertised
   limit instead of loading several complete references.
4. For a complete guide, use a `search_docs` result's `id` as `get_doc.path` and
   follow `nextOffset` until it is `null`. For an example, use its catalog `id` as
   `get_example.name` and retrieve all chunks before parsing the recipe JSON.

The section `maxCharacters` budget counts UTF-16 code units, not tokens, excludes
metadata, and never truncates a section. Use paginated `get_doc` for a section too
large for the budget or when full context matters. Section selection is lexical
search, not dependency analysis: read linked ownership, setup, or cleanup contracts
when they are needed to apply the excerpt. A Lit rendering excerpt alone does not
explain how a [framework host](./hosting-views.md) attaches the View.
Use the exact tool limits advertised by the connected server. Older snapshots may
not expose section tools; document retrieval remains sufficient in that case.

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
