---
name: marionette
description: Build, debug, review, or test Marionette v5 applications using their installed, version-matched documentation.
---

# Marionette applications

Use this skill for application work. For changes to Marionette itself, follow its repository guidance.

## Find the application's documentation

From the application workspace, locate `marionette/package.json` with Node's `require.resolve` and read its version. Open `docs/agents.md` or `docs/readme.md` beside that file. Check the application's renderer and data setup before choosing APIs. If packaged documentation is missing, obtain the exact release or known source revision; do not substitute a different version's contracts.

The paths below are relative to the installed package, not this skill directory. Start with the relevant task and follow its canonical references. A narrow API change does not require reading the whole corpus.

<!-- task-routes:start -->
| Task | Packaged page |
| --- | --- |
| Install and render a first View | `docs/quick-start.md`, `docs/integrations/setup.md` |
| Choose ownership and lifetimes | `docs/architecture.md`, `docs/api.md` |
| Handle a local control or edit | `docs/api/view.md`, `docs/api/shared/view-bindings.md` |
| Prepare, start, stop, or refresh a feature | `docs/api/application.md`, `docs/architecture.md` |
| Show, replace, or retain child UI | `docs/api/region.md`, `docs/api/view.md` |
| Render, filter, or sort repeated children | `docs/api/collection-view.md` |
| Share observable data and state | `docs/packages/data.md`, `docs/api/shared/state.md`, `docs/api/providers/data.md` |
| Connect events and clean up subscriptions | `docs/api/shared/events.md`, `docs/api/shared/view-bindings.md` |
| Connect channels and request/reply handlers | `docs/packages/radio.md`, `docs/api/shared/common.md` |
| Configure a renderer or another data layer | `docs/api/runtime.md`, `docs/api/providers/dom.md`, `docs/api/providers/data.md` |
| Apply the concepts in a composed feature | `docs/records.md` |
<!-- task-routes:end -->

## Apply the contract

Use `docs/architecture.md` when deciding ownership or lifetimes. Keep local interaction in a View when that fits the task; coordinate feature readiness and shared work at the lifetime that owns it. An asynchronous call alone does not require an Application. A View may save its own model if the configured data layer supplies that operation; `@mnjs/data` does not supply persistence or `Model.save()`.

Use the relevant reference for method arguments, event payloads, and cleanup. Verify the changed behavior, including replacement or cancellation when those are part of the task. Distinguish executed checks from conclusions based only on source inspection.

## Optional lookup helper

Run `node <skill>/scripts/docs.mjs --list` from the application directory, replacing `<skill>` with this skill's directory. Use `--search 'query'`, `--page docs/api/view.md`, or `--section <id>` returned by search. For an external package store, pass `--package-root <directory>`.

The helper reads the installed package and verifies its documentation manifest and hashes. Reading the same Markdown files directly is also supported. See the installed `docs/agents.md` for the full discovery workflow.
