# Set up an agent

Use the installed package's documentation and a small application instruction file
first. For migration planning before installing the target, use the
[pre-migration path](#inspect-a-target-release-before-migrating) below. The optional
Marionette skill helps an agent select those documents and
apply their lifecycle and integration rules. None of these resources requires an
account, network access, hosted model, or shared API key to read.

For everyday work, use [Read documentation for a task](./agent-retrieval.md).
It covers direct page lookup, local search, focused sections, and matching MCP
results. Use the [task table](./agents.md#read-for-the-task) to select a guide.
Plugin installation is optional and only needs doing once per client setup.

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

After the RC.2 release tag is published, add its repository marketplace and
install the plugin with the Codex CLI:

```sh
codex plugin marketplace add marionettejs/marionette --ref v5.0.0-rc.2 \
  --sparse .agents/plugins --sparse plugins/marionette
codex plugin add marionette@marionettejs
```

This command pins the marketplace to the intended immutable release tag;
preparing these files does not create that tag. Until then, test the candidate's
packaged skill using [the local-copy instructions](#install-only-the-consumer-skill).

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

## Choose an optional service only for a specific need

| Resource | Useful for | Boundary |
| --- | --- | --- |
| Packaged Markdown and manifest | Reading the contract shipped with an installed package | Available offline; verify custom runtime provenance separately. |
| Website Markdown and `llms.txt` | Discovering pages and reading a published snapshot | An index is a set of links, not automatic instruction installation. Check version and source metadata. |
| Documentation MCP | Structured search, full-document retrieval, and example discovery | Follow the [MCP workflow](./agent-retrieval.md#read-matching-docs-over-mcp). Check catalog version/source and follow pagination. It does not inspect or test your application. |
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
