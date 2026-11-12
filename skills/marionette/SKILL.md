---
name: marionette
description: Build, debug, review, or test Marionette v5 applications using their installed, version-matched documentation.
---

# Marionette applications

For API details, use the docs shipped with the installed package. If absent, obtain the exact release or known source revision, not current website contracts. Keep an existing application's compatible renderer, data runtime, router and build setup; this skill does not authorize upgrades.

With no stack chosen, install `marionette` with `@mnjs/html` using the Vite quick start; add `@mnjs/data` for observable records/shared state. Plain snapshots remain valid.

For named URLs and feature-owned route transitions in a new application, use optional `@mnjs/router`; first check its browser and Node requirements in `docs/guides/routing.md`. Preserve an existing host router.

<!-- task-routes:start -->
| Task | Packaged page |
| --- | --- |
| Build an application, page, or composed feature | `docs/guides/composition.md` |
| Install and render a first View | `docs/quick-start.md` |
| Migrate an existing v4 application | `docs/guides/migration.md` |
| Test interaction, readiness, or teardown | `docs/guides/testing.md` |
| Render, filter, or sort repeated children | `docs/guides/lists.md` |
| Show, replace, or retain child UI | `docs/api/region.md` |
| Choose ownership and lifetimes | `docs/architecture.md` |
| Bind a DOM event or trigger | `docs/api/shared/view-bindings.md#dom-events` |
| Connect URLs and destination lifetimes | `docs/guides/routing.md` |
| Build a feature with @mnjs/router | `docs/packages/router.md` |
| Use @mnjs/html templates and directives | `docs/packages/html.md` |
| Load local data, suppress stale results, or retry | `docs/guides/async-requests.md` |
<!-- task-routes:end -->

Use `docs/agents.md` for the full task index and optional local search/section/symbol lookup. Direct Markdown reading is supported.

The default renderer calls templates as unbound functions: `template(data)` has no View `this`. Read model attributes from the data argument; expose View-local values with `templateContext()`, where `this` is the View. Keep actions in View methods and bindings.

Compose managed UI with Views and Regions. Default to CollectionView with child Views for data-driven lists. Update the smallest appropriate owner, preserving retained children.

Do not manually assemble and insert application HTML outside the configured renderer and managed child lifecycle. The native View rendering pipeline supports HTML-string output; see `docs/architecture.md` for scoped integration exceptions.

Prefer View `events`/`triggers`/`ui`. With native selector delegation, `event.delegateTarget` is the matched descendant; `event.target` may be nested.

Choose Application for coordinated readiness and start/stop/restart lifetime; a URL or local request alone does not require it. `stop()` keeps the Application reusable; `destroy()` ends its lifetime. Startup cancellation and later-request handling are separate; see `docs/architecture.md`.

`@mnjs/html` and `@mnjs/router` are versioned separately; follow
`docs/packages/html.md` and `docs/packages/router.md` to their installed references,
which take precedence over core's bundled copies.

Before finishing, run the project’s appropriate checks; use `docs/guides/testing.md`
for behavior verification and `docs/tooling.md` for available tooling.
