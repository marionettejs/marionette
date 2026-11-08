---
name: marionette
description: Build, debug, review, or test Marionette v5 applications using their installed, version-matched documentation.
---

# Marionette applications

For API details, use the docs shipped with the installed package.

With no stack chosen, use the Vite quick start with `@mnjs/html`; add `@mnjs/data` for observable records/shared state. Plain snapshots remain valid.

<!-- task-routes:start -->
| Task | Packaged page |
| --- | --- |
| Build an application, page, or composed feature | `docs/guides/composition.md` |
| Install and render a first View | `docs/quick-start.md` |
| Render, filter, or sort repeated children | `docs/guides/lists.md` |
| Show, replace, or retain child UI | `docs/api/region.md` |
| Choose ownership and lifetimes | `docs/architecture.md` |
| Bind a DOM event or trigger | `docs/api/shared/view-bindings.md#dom-events` |
| Connect URLs and destination lifetimes | `docs/guides/routing.md` |
| Load local data, suppress stale results, or retry | `docs/guides/async-requests.md` |
<!-- task-routes:end -->

Use `docs/agents.md` for the full task index and optional local search/section/symbol lookup. Direct Markdown reading is supported.

Compose managed UI with Views and Regions. Default to CollectionView with child Views for data-driven lists. Update the smallest appropriate owner, preserving retained children.

Do not manually assemble and insert application HTML outside the configured renderer and managed child lifecycle. The native View rendering pipeline supports HTML-string output; see `docs/architecture.md` for scoped integration exceptions.

Prefer View `events`/`triggers`/`ui`. With native selector delegation, `event.delegateTarget` is the matched descendant; `event.target` may be nested.

Choose Application for coordinated readiness and start/stop/restart lifetime; a URL or local request alone does not require it. `stop()` keeps the Application reusable; `destroy()` ends its lifetime. Startup cancellation and later-request handling are separate; see `docs/architecture.md`.
