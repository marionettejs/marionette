# Marionette v5 documentation

These guides target **`marionette` 5.0.0-rc.2**, whose core is independent of
Backbone and jQuery. Choose the bundled guides for your installed package and
version; applications using legacy **`backbone.marionette`** need their own
contracts. When upgrading from v4, start with the [migration guide](guides/migration.md).

## Choose a starting point

- New project: [quick start](quick-start.md) for the first render; use the optional progression below as the feature grows.
- Existing application: choose a task or class reference below; follow additional contracts when needed.
- Agent work: [task routing and lookup](agents.md), with optional [skill/plugin setup](tooling.md#agent-installation).

### Learn as the feature grows

1. [Render a View in a Region](quick-start.md).
2. [Handle DOM events](api/shared/view-bindings.md#dom-events), then [edit local data](guides/local-editing.md). A View can save its own model when its data or API layer provides persistence.
3. [Add observable data](integrations/setup.md) and [compose Views with Regions](architecture.md#choose-a-responsibility), or [display a list](guides/lists.md). Optional `@mnjs/data` supplies observation; fetching and persistence require a separate API layer or another data solution.
4. When the feature needs readiness or an independent lifetime, [prepare and activate an Application](architecture.md#prepare-a-feature-then-activate-its-ui). [Retained restart](guides/retained-restart.md) repeats readiness while preserving the shell and local input. Child Applications are started or restarted explicitly. [Records](records.md) brings these pieces together.

## Common tasks

- [Migrate from another framework](guides/framework-migration.md): preserve journeys and design native ownership.
- [Migrate from v4](guides/migration.md): update configuration and lifecycle boundaries.
- [Test an application](guides/testing.md): run interaction, replacement, readiness and teardown checks.
- [Use TypeScript](guides/typescript.md): typed options, DOM handlers, state and lifecycle results.
- [Edit a View’s own model](guides/local-editing.md): live edits, local drafts, and API saves.
- [Restart readiness while retaining UI](guides/retained-restart.md): repeat preparation without rebuilding the shell or draft.
- [Add behavior to existing HTML](guides/existing-html.md): enhance existing markup and manage its lifetime.
- [Integrate with existing UI](guides/existing-ui.md): mount, communicate, and clean up under another UI owner.
- [Connect navigation](guides/routing.md): synchronous or asynchronous destinations, a retained shell, and browser subscriptions.
- [Work with lists](guides/lists.md): row identity, sorting, filtering, and empty presentation.
- [Integrate a control](guides/widgets.md): connect an imperative DOM API to View lifetime.
- [Accessibility and rendering](guides/accessibility-rendering.md): keyboard interaction, focus, and text/HTML boundaries.
- [Build and deploy](guides/production.md): installed packages, startup ownership, and production delivery checks.

## Core reference

- [API index](api.md): classes, shared contracts, and current coverage.
- [Application](api/application.md): feature readiness, child Applications, root ownership, and restart.
- [View](api/view.md): rendering, bindings, child Regions, and lifecycle.
- [CollectionView](api/collection-view.md): repeated children, sorting, filtering, and empty presentation.
- [Region](api/region.md): showing, replacing, retaining, and destroying Views.
- [Behavior](api/behavior.md): reusable host interactions and lifecycle.
- [MnObject](api/mnobject.md): nonvisual state, communication, and cleanup.

### Shared contracts and configuration

- [Events](api/shared/events.md), [state](api/shared/state.md), [common methods](api/shared/common.md), and [rendering/View bindings](api/shared/view-bindings.md) apply across classes.
- [Runtime configuration](api/runtime.md) explains setters and configuration scope.
- [Rendering/DOM providers](api/providers/dom.md) and [data/state providers](api/providers/data.md) define interfaces for supplying integrations.

## Companion packages and integration

- [@mnjs/data: Model and Collection](packages/data.md): an optional observable data layer with its own operations, events, identity, and disposal. Fetching and persistence require an API layer or another data solution.
- [@mnjs/radio: channels and requests](packages/radio.md): scoped communication, request/reply handlers, and cleanup.
- [@mnjs/utils](packages/utils.md): standalone component and object utilities.
- [@mnjs/adapters](packages/adapters.md): optional Backbone, XState, Lit, Morphdom, and jQuery contracts.
- [Renderer and data setup](integrations/setup.md): configure Lit and `@mnjs/data`.

The [records source](../examples/records/src/main.js) is included for reading alongside the lesson. Its [README](../examples/records/README.md) explains the repository development commands.

## Check and debug

[Application tooling](tooling.md) sets up lint and TypeScript checks and shows diagnostic lookup. Use [errors and diagnostics](api/errors.md) for the error contract.

## Find these docs from an installed package

From your application's directory:

```sh
node -p "require.resolve('marionette/package.json')"
```

Open `docs/readme.md` beside that package.json. Follow the relative Markdown links to the reference or lesson you need. This works without a documentation server or framework-specific retrieval tool.
