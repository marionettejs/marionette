# @mnjs/html: installed-version reference

For template syntax, directives and Marionette integration, first read the version
in `node_modules/@mnjs/html/package.json`, then that installation's
`node_modules/@mnjs/html/guide.md` and `node_modules/@mnjs/html/LIT_DIFFERENCES.md`.
Resolve the package from the application being edited; a hoisted or workspace
installation may not be directly below its working directory. The plugin locator
reports the resolved companion root and existing documentation files without
importing its runtime.

These independently released files take precedence over the HTML snapshot bundled
with core.
Preserve the application's compatible renderer and version; HTML is recommended
for new applications, not required by Router.

If installed documentation is unavailable, use the [bundled HTML guide](../../packages/html/guide.md)
only after checking its version against the application's dependency. Otherwise
consult the source tag matching the installed HTML release rather than silently
substituting current core documentation. The [setup guide](../integrations/setup.md)
covers integration choices; the [routing guide](../guides/routing.md) shows a
routed HTML feature.
