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
configured renderer or data provider. Choose one starting page or use an exact API
lookup; follow additional references when the task needs their contract.

Shared API names such as `View.extend`, regions, triggers, `modelEvents`, and
`CollectionView` remain valid in v5, but do not guarantee shared behavior: verify
the v5 contract. For v4 upgrades, read the [migration guide](guides/migration.md).

If installed docs are absent, obtain the exact release or known source revision. Current website docs may describe a different version.

<!-- task-routes:start -->
| Task | Start with |
| --- | --- |
| Install and render a first View | [Quick start](quick-start.md) |
| Migrate from another UI framework | [Framework migration](guides/framework-migration.md) |
| Migrate an existing v4 application | [Migration guide](guides/migration.md) |
| Test interaction, readiness, or teardown | [Consumer testing](guides/testing.md) |
| Choose ownership and lifetimes | [Architecture](architecture.md) |
| Bind a DOM event or trigger | [DOM events](api/shared/view-bindings.md#dom-events) |
| Read or rebind named DOM elements | [UI bindings](api/shared/view-bindings.md#ui-bindings) |
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
| Apply the concepts in a composed feature | [Records lesson](records.md) |
<!-- task-routes:end -->

## Apply the contract

Keep local interaction in its View when that fits the task. An asynchronous call alone does not require an Application. A View may save its own model when the configured data layer supplies that operation. `@mnjs/data` supplies observable Models and Collections; fetching and persistence require an API layer or another provider. It does not supply `Model.save()`.

Use Application preparation for feature readiness and `restart()` to repeat it while retaining active UI. Apply the current result in `onStart`; construct retained shells once. Coordinate shared decisions and work that survives panel replacement at the lifetime that owns them. Read [architecture](architecture.md) when deciding that ownership.

Read method signatures, event payloads and cleanup for the APIs you change. Verify the affected interaction, including replacement, cancellation or teardown when relevant. A successful build does not establish those outcomes.

## Local contract lookup

Direct Markdown reading is supported. If using the installed skill's helper, choose one lookup from the application directory:

```sh
node <skill>/scripts/docs.mjs --section docs/api/view.md#local-interaction-and-feature-coordination
```

Replace `<skill>` with the installed or copied skill directory. A section link reads that contract directly. You can also select a named section with `--page docs/api/shared/view-bindings.md --section 'UI bindings'`. Use `--symbol Export.member` for signatures and primary section IDs in `primarySections`, `--search 'query'` when the location is unknown, or `--page SOURCE` for a full page. `--list` lists pages; it is optional. An external package store needs `--package-root <physical-directory>`.

A symbol result lists primary contract section IDs in `primarySections` and incidental code mentions in `sections`. Primary routes can span several sections. An empty primary list means no member route has been assigned. `contracts` retains all applicable section IDs and diagnostic codes, including general guidance. Pass a section ID to `--section` to read it.

The helper checks the bundled manifest and hashes and reports the installed version and source revision. These identify the docs read; they do not verify the implementation.

For [skill/plugin installation](tooling.md#agent-installation) or [hosted MCP identity checks](tooling.md#hosted-documentation-mcp), follow application tooling.
