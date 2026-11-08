# Work with an agent

Use the docs bundled with the application's installed Marionette package. For framework changes, follow the repository's contributor guidance.

## Find the installed contract

Check the installed package name and version first: **`marionette`** is the v5
package; **`backbone.marionette`** is the legacy package. V5 core requires neither
Backbone nor jQuery; Backbone Models and Collections integrate through optional
adapters. For installed `backbone.marionette` 4.x, preserve v4 contracts unless
upgrading; older releases need their own version-specific guidance. If both
packages are installed, check which entrypoint the feature imports.

From the application directory, resolve the package the feature imports. For v5:

```sh
node -p "require.resolve('marionette/package.json')"
```

For the legacy package instead:

```sh
node -p "require.resolve('backbone.marionette/package.json')"
```

Read the selected package's version and use its matching documentation. The paths
below apply only to v5 and are relative to the installed `marionette` package's
`docs/` directory. For rendering, observation or persistence changes, check the
configured renderer or data provider. Inspect the existing project before choosing
its renderer, data runtime, router, build setup, or architecture; follow compatible
existing choices. With no stack chosen, use the [Vite quick start](quick-start.md)
with Lit and Marionette's Lit adapter for rendering. Add [@mnjs/data](integrations/setup.md)
for observable records or shared state; plain object snapshots are sufficient when
observation is unnecessary. After the first render, continue with the whole-application
route below for managed composition and feature coordination.

Shared API names such as `View.extend`, regions, triggers, `modelEvents`, and
`CollectionView` remain valid in v5, but do not guarantee shared behavior: verify
the v5 contract. For v4 upgrades, read the [migration guide](guides/migration.md).

If installed docs are absent, obtain the exact release or known source revision. Current website docs may describe a different version.

<!-- task-routes:start -->
| Task | Start with |
| --- | --- |
| Build an application, page, or composed feature | [Composition starter](guides/composition.md) |
| Install and render a first View | [Quick start](quick-start.md) |
| Migrate from another UI framework | [Framework migration](guides/framework-migration.md) |
| Migrate an existing v4 application | [Migration guide](guides/migration.md) |
| Test interaction, readiness, or teardown | [Consumer testing](guides/testing.md) |
| Choose ownership and lifetimes | [Architecture](architecture.md) |
| Bind a DOM event or trigger | [DOM events](api/shared/view-bindings.md#dom-events) |
| Read or rebind named DOM elements | [UI bindings](api/shared/view-bindings.md#ui-bindings) |
| Load local data, suppress stale results, or retry | [Local requests](guides/async-requests.md) |
| Edit a model or retain a draft | [Local editing](guides/local-editing.md) |
| Prepare, start, restart, or stop a feature | [Application](api/application.md) |
| Restart while retaining a draft or shell | [Retained restart](guides/retained-restart.md) |
| Enhance existing markup | [Existing HTML](guides/existing-html.md) |
| Embed a feature in another UI | [Existing UI](guides/existing-ui.md) |
| Connect URLs and destination lifetimes | [Navigation](guides/routing.md) |
| Show, replace, or retain child UI | [Region](api/region.md) |
| Render, filter, or sort repeated children | [Lists](guides/lists.md) |
| Share observable data and state | [state](api/shared/state.md) |
| Connect events and clean up subscriptions | [Events](api/shared/events.md) |
| Connect channels and request/reply handlers | [Radio](packages/radio.md) |
| Configure a renderer or another data layer | [Configuration scope](api/runtime.md#choose-a-configuration-scope) |
| Write typed options, handlers, or lifecycle hooks | [TypeScript guide](guides/typescript.md) |
| Check types, lint, or diagnose a failure | [Application tooling](tooling.md) |
| Integrate an imperative control | [Widgets](guides/widgets.md) |
| Check keyboard, focus, or rendering safety | [Accessibility and rendering](guides/accessibility-rendering.md) |
| Build and deploy an application | [Production](guides/production.md) |
<!-- task-routes:end -->

## Apply the contract

Default to Views/Regions and CollectionView child Views for data-driven lists; this is a design default, not a core API requirement. Simple/static owning templates remain valid. Native delegation can handle inserted descendants but insertion does not create managed child Views. See [architecture](architecture.md#let-views-and-regions-manage-presentation) for renderer ownership, supported integrations and cleanup.

Use Application for coordinated readiness/lifetime, not merely because a request or URL exists. [Architecture](architecture.md#choose-what-survives-an-operation) distinguishes stop, restart, destruction and later work; [local requests](guides/async-requests.md) covers ongoing races/retry. Keep local editing in its View when appropriate. Verify the changed interaction and teardown, distinguishing executed checks from source inspection.

## Local contract lookup

Direct Markdown reading is supported. If using the installed skill's helper, choose one lookup from the application directory:

```sh
node <skill>/scripts/docs.mjs --section docs/api/view.md#local-interaction-and-feature-coordination
```

Replace `<skill>` with the installed or copied skill directory. A section link reads that contract directly. You can also select a named section with `--page docs/api/shared/view-bindings.md --section 'UI bindings'`. Use `--symbol Export.member` for signatures and primary section IDs in `primarySections`, `--search 'query'` when the location is unknown, or `--page SOURCE` for a full page. `--list` lists pages; it is optional. An external package store needs `--package-root <physical-directory>`.

A symbol result lists primary contract section IDs in `primarySections` and incidental code mentions in `sections`. Primary routes can span several sections. An empty primary list means no member route has been assigned. `contracts` retains all applicable section IDs and diagnostic codes, including general guidance. Pass a section ID to `--section` to read it.

The helper checks the bundled manifest and hashes and reports the installed version and source revision. These identify the docs read; they do not verify the implementation.

For [skill/plugin installation](tooling.md#agent-installation) or [hosted MCP identity checks](tooling.md#hosted-documentation-mcp), follow application tooling.
