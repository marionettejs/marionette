---
name: marionette
description: Build, debug, review, or test Marionette v5 applications using version-matched docs, including v4-to-v5 migration and @mnjs integrations. For changes to the library itself, follow its repository guidance.
---

# Build with Marionette

Use the application's installed contract and preserve compatible integration
choices. This skill does not authorize dependency upgrades.

## Locate matching docs

Resolve the package from the application workspace, not the copied skill directory
or a neighboring monorepo package. The read-only helper requires Node 24 or later.
Its path is `scripts/docs.mjs` relative to the directory containing this `SKILL.md`:

- In the npm package, that directory is `<package-root>/dist/agent-skill/`.
- After copying the skill, it is the copied directory, such as
  `/path/to/application/.agents/skills/marionette/`.

Replace `/path/to/skill-directory` with that directory's absolute path and
`/path/to/application` with the application's absolute path. These commands work
from any working directory:

```sh
node "/path/to/skill-directory/scripts/docs.mjs" --project "/path/to/application" --page docs/quick-start.md
node "/path/to/skill-directory/scripts/docs.mjs" --project "/path/to/application" --search getUI
```

Read a known task page directly; listing every page is unnecessary. `--search`
returns up to five section IDs with sizes and ancestry; pass a returned ID to
`--section` for its complete text. `--list` discovers page paths when needed.
Search/section lookup requires the index shipped starting with RC.2; earlier
artifacts can be read with `--page` or searched as local Markdown files.
All modes verify hashes and version without executing project code or using a
network. With no physical `node_modules`, supply `--package-root` from the
application's package manager.

If packaged docs are absent, use the exact release or known source commit and
installed exports/declarations. Do not silently substitute current website docs,
`master`, or another workspace's package. An alpha version alone does not establish
source identity; `sourceDirty: true` is not an immutable release. Documentation
hashes do not prove a custom runtime matches them; test uncertain runtime behavior.

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
interaction check to identify what to read next. Reuse recorded package and
integration facts until dependencies, configuration, or workspace change.

Read `docs/agent-retrieval.md` for local lookup and optional MCP retrieval rules.
Remote version and source must match the installed artifact. Installed Markdown
is sufficient; plugin or MCP setup is not part of every task.

DataApi, StateApi, renderer, DomApi, EventDelegator, and router are independent
choices; a Backbone router does not require Backbone data. Register configuration
before consumers. Use templates, named Regions, and public lifecycle APIs; domain
records belong in data sources, not child View traversal. For application design,
including personalized examples, use `docs/agents.md`.

## Completion

The requested application behavior works against the installed package, preserves
unrelated edits/focus and ownership, and has evidence for the affected interaction
and cleanup boundary. Reproduce uncertain contracts through public package APIs.
Use the application's checks; exercise actual clicks, focus, hover boundaries,
replacement and cleanup with the selected adapters. Browser interactions require
browser evidence. Report actual results and untested boundaries. Record changed
integration decisions in the application's notes, keeping API details in the docs.
