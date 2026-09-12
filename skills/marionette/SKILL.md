---
name: marionette
description: Build or debug Marionette v5 applications using version-matched docs. For changes to the library itself, use its repository guidance.
---

# Build with Marionette

Use the application's installed contract and preserve compatible integration
choices. This skill does not authorize dependency upgrades.

## Locate matching docs

Resolve the package from the application workspace, not the copied skill directory
or a neighboring monorepo package. The read-only helper requires Node 24 or later:

```sh
node /path/to/marionette/scripts/docs.mjs --project /path/to/application --list
node /path/to/marionette/scripts/docs.mjs --project /path/to/application --page docs/agents.md
```

These are lookup options, not a required sequence. `--list` returns provenance and
available page paths; `--page` reads one source path. The helper checks packaged
documentation hashes and version without executing project code or using a network.
For installations without `node_modules`, supply `--package-root` with the physical
package directory obtained from that application's package manager.

If packaged docs are absent, use the exact release or known source commit and
installed exports/declarations. Do not silently substitute current website docs,
`master`, or another workspace's package. An alpha version alone does not establish
source identity; `sourceDirty: true` is not an immutable release. Documentation
hashes do not prove a custom runtime matches them; test uncertain runtime behavior.

## Select the relevant contract

Read the task's page using its source path from the manifest or returned local path:

| Task | Packaged page |
| --- | --- |
| New application | `docs/development.md` for the typed starter; `docs/choosing-integrations.md` for integration decisions |
| Application architecture or unfamiliar ownership | `docs/agents.md` |
| Rendering or screen replacement | `docs/marionette.view.md`, `docs/marionette.region.md`, `docs/view.lifecycle.md` |
| Changing lists or observable records | `docs/marionette.collectionview.md`, `docs/data.api.md` |
| Async features or navigation | `docs/marionette.application.md`, `docs/routing.md` |
| State ownership or framework error | `docs/marionette.state.md` or `docs/diagnostic-catalog.md` |
| Skill setup or optional documentation MCP | `docs/agent-tools.md` |

Follow relevant links rather than loading an overview and every reference. For MCP,
read the retrieval rules in `docs/agent-tools.md` before remote use: exact version
and source must match. Installed Markdown remains sufficient. For v4 applications,
use matching migration material and installed APIs; this skill is not an upgrade plan.

DataApi, StateApi, renderer, DomApi, EventDelegator, and router are independent
choices; a Backbone router does not require Backbone data. Register configuration
before consumers. Use templates, named Regions, and public lifecycle APIs; domain
records belong in data sources, not child View traversal. For application design,
including personalized examples, use `docs/agents.md`.

## Completion

The requested application behavior works against the installed package, preserves
unrelated edits/focus and ownership, and has evidence for the affected interaction
and cleanup boundary. Use the application's checks; browser interactions require
browser evidence. Report actual results and untested boundaries. Record changed
integration decisions in the application's notes, keeping API details in the docs.
