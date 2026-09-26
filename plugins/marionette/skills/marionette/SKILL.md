---
name: marionette
description: Build or debug Marionette v5 applications, or migrate from v4, using version-matched docs. For changes to the library itself, follow its repository guidance.
---

# Build with Marionette

Use the application's installed contract and preserve compatible integration
choices. This skill does not authorize dependency upgrades.

## Locate matching docs

Reuse the application's recorded package and integration facts until dependencies,
configuration, or workspace change. Resolve new facts from the application
workspace, not a neighboring package. Use matching installed Markdown or MCP;
plugin setup and reading both sources are unnecessary for routine work.

The local read-only helper requires Node 24 or later. From an application with
`node_modules/marionette`, read a known page or search an unfamiliar symbol:

```sh
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --page docs/quick-start.md
node node_modules/marionette/dist/agent-skill/scripts/docs.mjs --project . --search getUI
```

For a copied skill, the same helper is `scripts/docs.mjs` relative to this
`SKILL.md`; keep `--project` pointed at the application. Search returns section
IDs, sizes, and ancestry; use `--section '<returned-id>'` for a complete section.
Use `--list` only when the page path is unknown. Installed Markdown is also
readable directly; earlier packages may not have the helper or section index.

For hoisted packages, missing docs, custom artifacts, or MCP configuration, consult
`docs/agent-retrieval.md` in the matching package/source. With no physical
`node_modules`, the helper accepts `--package-root` for the actual package directory.
Keep the exact release/source identity: current website docs, `master`, and an
equal prerelease version label do not establish a match. Missing docs do not
authorize upgrading the application.

## Select the relevant contract

Use a source path below with `--page`. This table is generated from the canonical
application task guide; read one guide before following links for open questions.

<!-- task-routes:start -->
| Task | Packaged page |
| --- | --- |
| Build a first screen | `docs/quick-start.md` |
| Start a new project | `docs/development.md` |
| Edit and save a form | `docs/forms-and-accessibility.md` |
| Render a changing list | `docs/list-composition.md` |
| Show or update a piece of UI | `docs/view.rendering.md` |
| Replace part of a screen | `docs/marionette.region.md` |
| Navigate between screens | `docs/routing.md` |
| Own asynchronous feature work | `docs/application-effects.md` |
| Refresh data without restarting a feature | `docs/application-refresh.md` |
| Choose an integration | `docs/choosing-integrations.md` |
| Host a screen in another framework | `docs/hosting-views.md` |
| Add local or shared state | `docs/marionette.state.md` |
| Handle DOM or child events | `docs/dom.interactions.md`, `docs/events.md` |
| Own a widget or subscription | `docs/resource-cleanup.md`, `docs/task-recipes.md` |
| Diagnose a framework error | `docs/troubleshooting.md` |
| Migrate from v4 | `docs/agent-tools.md`, `upgradeGuide.md` |
<!-- task-routes:end -->

For one unfamiliar API, prefer `--search` and `--section` over a complete
reference. Stop discovery once setup, updates, and cleanup are clear; use an
interaction check to identify what to read next.

DataApi, StateApi, renderer, DomApi, EventDelegator, and router are independent
choices; a Backbone router does not require Backbone data. Register configuration
before consumers. Use templates, named Regions, and public lifecycle APIs; domain
records belong in data sources, not child View traversal. For application design,
use `docs/agents.md`; for teaching or personalized examples, use the corresponding
section of `docs/development.md`.

## Completion

Complete the requested behavior against the installed package and continue through
failures caused by the change within the authorized scope. Use the application's
checks for the affected interaction and ownership boundaries. Exercise focus,
events, editable state, replacement, or cleanup when the change depends on them;
use a real browser for browser-dependent behavior. Reproduce uncertain contracts
through public package APIs. A read-only review stays read-only.

Report actual results and untested boundaries. Record changed integration decisions
in the application's notes, keeping API details in the docs.
