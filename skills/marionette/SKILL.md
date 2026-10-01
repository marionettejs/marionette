---
name: marionette
description: Build, debug, review, or test Marionette v5 applications using their installed, version-matched documentation.
---

# Marionette applications

For application work, locate `marionette/package.json` with Node's `require.resolve` from the application workspace and read its version. For rendering, observation or persistence changes, check the configured renderer or data provider. For framework changes, follow repository guidance.

Choose one task or exact API section below directly from the installed package. Documentation paths are relative to that package, not this skill. Follow additional references when the task needs them. If docs are absent, obtain the exact release or known source revision; do not substitute current website contracts.

<!-- task-routes:start -->
| Task | Packaged page |
| --- | --- |
| Install and render a first View | `docs/quick-start.md` |
| Migrate an existing v4 application | `docs/guides/migration.md` |
| Test interaction, readiness, or teardown | `docs/guides/testing.md` |
| Choose ownership and lifetimes | `docs/architecture.md` |
| Bind a DOM event or trigger | `docs/api/shared/view-bindings.md#dom-events` |
| Read or rebind named DOM elements | `docs/api/shared/view-bindings.md#ui-bindings` |
| Edit a model or retain a draft | `docs/guides/local-editing.md` |
| Prepare, start, restart, or stop a feature | `docs/api/application.md` |
| Restart while retaining a draft or shell | `docs/guides/retained-restart.md` |
| Enhance existing markup | `docs/guides/existing-html.md` |
| Embed a feature in another UI | `docs/guides/existing-ui.md` |
| Connect URLs and destination lifetimes | `docs/guides/routing.md` |
| Show, replace, or retain child UI | `docs/api/region.md` |
| Render, filter, or sort repeated children | `docs/guides/lists.md` |
| Share observable data and state | `docs/api/shared/state.md` |
| Connect events and clean up subscriptions | `docs/api/shared/events.md` |
| Connect channels and request/reply handlers | `docs/packages/radio.md` |
| Configure a renderer or another data layer | `docs/api/runtime.md#choose-a-configuration-scope` |
| Write typed options, handlers, or lifecycle hooks | `docs/guides/typescript.md` |
| Check types, lint, or diagnose a failure | `docs/tooling.md` |
| Integrate an imperative control | `docs/guides/widgets.md` |
| Check keyboard, focus, or rendering safety | `docs/guides/accessibility-rendering.md` |
| Build and deploy an application | `docs/guides/production.md` |
| Apply the concepts in a composed feature | `docs/records.md` |
<!-- task-routes:end -->

## Apply and verify

Local interaction can stay in a View. An asynchronous call alone does not require an Application. A View may save its own model if the configured data layer supplies it; optional `@mnjs/data` supplies observation, with fetching and persistence provided separately, and does not supply `Model.save()`.

Application preparation establishes readiness. Use restart to prepare new data while retaining a running feature; commit the prepared result in onStart and construct retained UI once. Use explicit operations for ongoing work that has a separate lifetime. Coordinate shared decisions at their owning lifetime. Use `docs/architecture.md` when choosing ownership. Verify changed interaction, replacement, cancellation or teardown as relevant; distinguish executed checks from source inspection.

## Optional lookup

Read Markdown directly, or run `node <skill>/scripts/docs.mjs --section docs/path.md#heading-anchor` from the application directory. Replace `<skill>` with this skill directory and use a section link from the docs or a returned lookup ID. `--page SOURCE --section 'Heading'` reads a named section. Use `--symbol Export.member` for signatures, `--search 'query'` for an unknown location, or `--page SOURCE` for a full page. `--list` is optional page discovery. External package stores need `--package-root <physical-directory>`. The helper verifies installed documentation hashes and reports version/revision.

Only when using the plugin's hosted connection, follow the installed `docs/tooling.md#hosted-documentation-mcp` identity checks. Installed Markdown remains authoritative. The copied skill works without MCP.
