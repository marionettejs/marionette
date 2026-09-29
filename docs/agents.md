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
| Migrate an existing v4 application | [Migration guide](guides/migration.md), [optional adapters](packages/adapters.md) |
| Test interaction, readiness, or teardown | [Consumer testing](guides/testing.md), [application tooling](tooling.md) |
| Choose ownership and lifetimes | [Architecture](architecture.md), [API index](api.md) |
| Handle a local control or edit | [Local editing](guides/local-editing.md), [View responsibilities](api/view.md#local-interaction-and-feature-coordination), [View bindings](api/shared/view-bindings.md) |
| Prepare, start, stop, or refresh a feature | [Application](api/application.md), [ownership and lifetimes](architecture.md) |
| Refresh while retaining a draft or shell | [Retained refresh](guides/retained-refresh.md), [Application](api/application.md#restart-and-retained-ui) |
| Enhance existing markup | [Existing HTML](guides/existing-html.md), [View](api/view.md) |
| Embed a feature in another UI | [Existing UI](guides/existing-ui.md), [Region](api/region.md) |
| Connect URLs and destination lifetimes | [Navigation](guides/routing.md), [Application composition](api/application.md#child-applications) |
| Show, replace, or retain child UI | [Region](api/region.md), [View Regions and existing elements](api/view.md) |
| Render, filter, or sort repeated children | [Lists](guides/lists.md), [CollectionView](api/collection-view.md) |
| Share observable data and state | [state](api/shared/state.md), [data providers](api/providers/data.md), [optional @mnjs/data](packages/data.md) |
| Connect events and clean up subscriptions | [Events](api/shared/events.md), [child and entity bindings](api/shared/view-bindings.md) |
| Connect channels and request/reply handlers | [Radio](packages/radio.md), [class Radio bindings](api/shared/common.md#declarative-radio-bindings) |
| Configure a renderer or another data layer | [Optional adapters](packages/adapters.md), [Runtime configuration](api/runtime.md), [DOM providers](api/providers/dom.md), [data providers](api/providers/data.md) |
| Write typed options, handlers, or lifecycle hooks | [TypeScript guide](guides/typescript.md), [application tooling](tooling.md) |
| Check types, lint, or diagnose a failure | [Application tooling](tooling.md), [errors and diagnostics](api/errors.md) |
| Integrate an imperative control | [Widgets](guides/widgets.md), [Behavior](api/behavior.md) |
| Check keyboard, focus, or rendering safety | [Accessibility and rendering](guides/accessibility-rendering.md), [DOM providers](api/providers/dom.md) |
| Build and deploy an application | [Production](guides/production.md), [application tooling](tooling.md) |
| Apply the concepts in a composed feature | [Records lesson](records.md) |
<!-- task-routes:end -->

## Make changes at the right boundary

Use the [architecture guide](architecture.md) to choose the owner of the behavior you are changing. A View can handle local interaction, including saving its own model when the selected data layer provides that method. Feature readiness, shared decisions, and work that survives panel replacement need an owner with the corresponding lifetime. The presence of an asynchronous call alone does not determine the class.

Check the configured data provider before using persistence methods. `@mnjs/data` supplies observable Models and Collections, but is incomplete as an application data solution: fetching and persistence require an API layer or another provider. It does not supply `Model.save()`.

Verify the changed behavior at that boundary: observable updates for data changes, replacement and teardown for composition, and failure or cancellation for asynchronous work. A successful build checks a different property from successful user interaction. The [API index](api.md) identifies reference coverage that is still being completed.

## Choose an agent installation

The installed package includes `skills/marionette`. The skill routes to that application's installed docs and includes an offline lookup helper. Reading `SKILL.md` directly also works.

For a Codex project, copy the complete folder to `.agents/skills/marionette` in your application and invoke `$marionette`. Keep the scripts with the entrypoint. For other clients, use their documented skill location and invocation support. See [Codex skill installation](https://learn.chatgpt.com/docs/build-skills).

The `marionette` plugin is distributed through repository marketplaces, separately from the npm package. To use it, obtain a source checkout matching the installed package version and its manifest's `sourceRevision`; use the corresponding working checkout for a dirty candidate. Otherwise, copy the skill delivered with the package. The plugin combines that checkout's skill with the hosted documentation MCP connection. In a Codex client supporting local marketplaces, add the matching checkout with `codex plugin marketplace add /absolute/path/to/checkout`, then install Marionette from that marketplace using the client's plugin interface. See [OpenAI plugin installation](https://developers.openai.com/plugins/build/plugins). The repository includes Claude Code and Cursor marketplace manifests; their client installation and activation must be verified in those clients.

Choose the copied skill for local lookup without MCP. A plugin-capable client can use the bundled skill and hosted connection together, but installation does not make the hosted corpus match your package. The next section explains that check.

### Local contract lookup

Run the helper from your application directory, replacing `<skill>` with the copied directory:

```sh
node <skill>/scripts/docs.mjs --list
node <skill>/scripts/docs.mjs --search 'prepareStart'
node <skill>/scripts/docs.mjs --page docs/api/application.md
```

Use `--section` with an ID returned by search to read a single section. For a package in an external store, pass `--package-root` with its physical directory. The helper verifies the bundled manifest and content hashes, and reports the installed version and source revision with its results. These checks establish which documentation was read; they do not prove that an implementation follows it.

## Optional hosted documentation MCP

The plugin's connection is `https://mcp.marionettejs.com/mcp`. Before searching it, read the `marionette://catalog` resource. Compare both `provenance.packageVersion` and `provenance.sourceRevision` with the application's installed package and `docs-manifest.json`. A matching version alone does not establish the same contract, including when the hosted catalog serves a development candidate. Follow the catalog's `requestIdentity` field for required tool arguments. Pass the exact `version`; for a development candidate, also pass the matching `sourceRevision` on search and read calls, including `search_docs`, `search_sections`, and retrieval of their returned IDs. Do not use a latest-version alias.

A reused prerelease version can contain different contracts. A manifest with `sourceDirty: true` includes changes beyond that revision, so its local docs remain authoritative. If either revision is unavailable, the identities differ, or the service is unavailable, use installed Markdown and the local helper. Hosted results do not override the installed artifact's contract. Copying the skill alone requires no hosted connection; disable the bundled server only through your client's supported settings if using the plugin without MCP.
