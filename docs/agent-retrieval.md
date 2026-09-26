# Read documentation for a task

Use the [task table](./agents.md#read-for-the-task) to choose one starting guide.
For a first screen, read the [quick start](./quick-start.md); for an API question,
look up its exact name with `--symbol`. Once imports, setup, updates, and cleanup
are clear, implement and check one public interaction before broadening the search.

Reuse the package identity and integrations recorded in the application's
instructions until its dependencies, configuration, or workspace change.
Installed Markdown works offline. Choose it or matching MCP retrieval for the
task; checking both is not a prerequisite. [Agent setup](./agent-tools.md) covers
installing a plugin or copying the skill if needed.

## Read matching docs locally

The installed package includes a read-only helper requiring Node 24 or later.
From the application directory containing `node_modules/marionette`, run it
directly; copying or activating a skill is unnecessary:

```sh
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --page docs/quick-start.md
```

The helper lives at `dist/agent-skill/scripts/docs.mjs` inside the package, not
`scripts/docs.mjs` at its root. For a hoisted dependency, use the actual installed
package path for the executable and keep `--project` pointed at your application.
A copied skill has the same helper at `scripts/docs.mjs` relative to its `SKILL.md`.
The helper locates matching docs without importing application code or using a
network. It adds no server, registry, or production dependency.

For an unfamiliar symbol or task, search the installed section index:

```sh
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --search 'getUI'
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --search 'childViewEvents arguments'
```

Search returns at most five section IDs, headings, ancestry, sizes, and matched
terms. Pass a returned ID to `--section` to read that complete section and its
subsections. IDs identify source line positions in this exact snapshot; do not
construct them or reuse them after a dependency update. For example, replace
`<returned-id>` below with an actual result:

```sh
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --section '<returned-id>'
```

Read the returned ancestry and linked setup/ownership rules. Search is lexical;
an excerpt is not guaranteed to contain every contract a task needs. Section
lookup requires an artifact containing `docs-sections.json` (starting with RC.2).
For earlier installed artifacts, use `--page` and search that local Markdown file.
The helper never substitutes another package or the hosted corpus.

For a known public name, look it up exactly instead of searching prose:

```sh
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --symbol View
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --symbol Region.detachView
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --symbol prepareStart
```

`--symbol` accepts an export name, `Export.member`, or a member name alone. An
export returns its entrypoint, declared signature, member names, and reviewed
contracts. A member returns its signature and up to five sections on its contract
pages that use it in code, with the count omitted. Each contract lists its owning
sections and diagnostic codes. Pass any section ID to `--section`. Names match
exactly and case-sensitively; `matches: []` means this installed package has no
such public export or member. Signatures come from the installed declarations'
contract inventory, not a type checker; consult the declarations for full types.
Symbol lookup requires an artifact containing `docs-symbols.json`.

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

## Read matching docs over MCP

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

