# Work with an agent

Use the same version-matched documentation whether you are writing code yourself or working with a coding agent. This page routes application tasks to the relevant guides and contracts. For changes to Marionette itself, follow the repository's contributor guidance.

## Find the installed contract

From the application's directory, locate its package:

```sh
node -p "require.resolve('marionette/package.json')"
```

Read the version in that file and open `docs/readme.md` beside it. The installed documentation, declarations, and configured renderer/data providers describe the contract available to this application. When documentation is absent, obtain it from the exact release or known source revision. Current website documentation may describe a different version.

Start with the task below, then follow links to the exact class or provider reference. Read the composed records lesson when you need an end-to-end example; individual API lookups do not require it.

<!-- task-routes:start -->
| Task | Read |
| --- | --- |
| Install and render a first View | [Quick start](quick-start.md), [renderer and data setup](integrations/setup.md) |
| Choose ownership and lifetimes | [Architecture](architecture.md), [API index](api.md) |
| Handle a local control or edit | [View responsibilities](api/view.md#local-interaction-and-feature-coordination), [View bindings](api/shared/view-bindings.md) |
| Prepare, start, stop, or refresh a feature | [Application](api/application.md), [ownership and lifetimes](architecture.md) |
| Show, replace, or retain child UI | [Region](api/region.md), [View Regions and existing elements](api/view.md) |
| Render, filter, or sort repeated children | [CollectionView](api/collection-view.md) |
| Share observable data and state | [@mnjs/data](packages/data.md), [state](api/shared/state.md), [data providers](api/providers/data.md) |
| Connect events and clean up subscriptions | [Events](api/shared/events.md), [child and entity bindings](api/shared/view-bindings.md) |
| Connect channels and request/reply handlers | [Radio](packages/radio.md), [class Radio bindings](api/shared/common.md#declarative-radio-bindings) |
| Configure a renderer or another data layer | [Runtime configuration](api/runtime.md), [DOM providers](api/providers/dom.md), [data providers](api/providers/data.md) |
| Check types, lint, or diagnose a failure | [Application tooling](tooling.md), [errors and diagnostics](api/errors.md) |
| Apply the concepts in a composed feature | [Records lesson](records.md) |
<!-- task-routes:end -->

## Make changes at the right boundary

Use the [architecture guide](architecture.md) to choose the owner of the behavior you are changing. A View can handle local interaction, including saving its own model when the selected data layer provides that method. Feature readiness, shared decisions, and work that survives panel replacement need an owner with the corresponding lifetime. The presence of an asynchronous call alone does not determine the class.

Check the configured data provider before using persistence methods. `@mnjs/data` supplies observable Models and Collections, but is incomplete as an application data solution: fetching and persistence require an API layer or another provider. It does not supply `Model.save()`.

Verify the changed behavior at that boundary: observable updates for data changes, replacement and teardown for composition, and failure or cancellation for asynchronous work. A successful build checks a different property from successful user interaction. The [API index](api.md) identifies reference coverage that is still being completed.

## Optional local skill

The package includes `skills/marionette`. Copy that directory into the skill location supported by your coding client, or read its `SKILL.md` directly. It routes to this documentation and includes a local lookup helper; a hosted service is not required.

Run the helper from your application directory, replacing `<skill>` with the copied directory:

```sh
node <skill>/scripts/docs.mjs --list
node <skill>/scripts/docs.mjs --search 'prepareStart'
node <skill>/scripts/docs.mjs --page docs/api/application.md
```

Use `--section` with an ID returned by search to read a single section. For a package in an external store, pass `--package-root` with its physical directory. The helper verifies the bundled manifest and content hashes, and reports the installed version and source revision with its results. These checks establish which documentation was read; they do not prove that an implementation follows it.
