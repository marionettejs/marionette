# Marionette v5 documentation

These guides target **5.0.0-rc.2**. This prerelease is being verified as local candidate tarballs. Use the docs bundled with the candidate you installed. The reference and learning paths below can be read independently. Remaining API coverage is identified in the reference index.

## Start here

1. [Install and render a View](quick-start.md).
2. [Choose ownership and lifetimes](architecture.md): Applications, Views, Regions, shared state, and asynchronous work.
3. [Build the records feature](records.md): apply those concepts to preparation, selection, retry, and close/reopen.

## Look up a contract

- [API index](api.md): classes, shared contracts, and current coverage.
- [Application](api/application.md): feature readiness, child Applications, root ownership, and restart.
- [View](api/view.md): rendering, bindings, child Regions, and lifecycle.
- [CollectionView](api/collection-view.md): repeated children, sorting, filtering, and empty presentation.
- [Region](api/region.md): showing, replacing, retaining, and destroying Views.
- [Behavior](api/behavior.md): reusable host interactions and lifecycle.
- [MnObject](api/mnobject.md): nonvisual state, communication, and cleanup.
- [Events](api/events.md), [state](api/state.md), and [common methods](api/common.md).
- [Runtime configuration](api/runtime.md), [rendering/DOM providers](api/dom-providers.md), and [data/state providers](api/data-providers.md).
- [Renderer and data setup](setup.md): the Lit integration and the `@mnjs/data` APIs used here.

The [records source](../examples/records/src/main.js) is included for reading alongside the lesson. Its [README](../examples/records/README.md) explains the repository development commands.

## Find these docs from an installed package

From your application's directory:

```sh
node -p "require.resolve('marionette/package.json')"
```

Open `docs/readme.md` beside that package.json. Follow the relative Markdown links to the reference or lesson you need. This works without a documentation server or framework-specific retrieval tool.
