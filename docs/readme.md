# Marionette v5 documentation

These guides target **5.0.0-rc.2**. This prerelease is being verified as local candidate tarballs. Use the docs bundled with the candidate you installed. The reference and learning paths below can be read independently. Remaining API coverage is identified in the reference index.

## Start here

1. [Install and render a View](quick-start.md).
2. [Choose ownership and lifetimes](architecture.md): Applications, Views, Regions, shared state, and asynchronous work.
3. [Build the records feature](records.md): apply those concepts to preparation, selection, retry, and close/reopen.

For agent-led work, use the [agent workflow](agents.md) to find version-matched guidance and verify a change.

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
