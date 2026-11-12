---
name: marionette
description: Find installed Marionette guidance for application development, debugging, and v4 migration.
---

# Marionette applications

Run `node <skill>/scripts/locate.mjs --project <application-directory>`; `<skill>` is this skill directory. It reads metadata without importing application code. External stores use `--package-root <physical-directory>`.

Follow the returned `skillPath` for the package the feature imports; check imports when both packages are installed. The plugin version identifies the loader, not the framework.

The project lookup also returns independently versioned `companionPackages`. Read
`@mnjs/html`'s `guide.md` and `LIT_DIFFERENCES.md`, and `@mnjs/router`'s `readme.md`
and `DESIGN.md`, through the returned installed `documentation` paths. These are
files, not JavaScript imports. Check each companion's version; do not substitute
current repository docs. `missingDocumentation` identifies files absent from that
installed version. The core docs helper does not search companion packages.
`--package-root` selects only the explicit core/legacy package; use `--project`
for companion discovery from the application's dependency resolution context.

Keep `backbone.marionette` 4.x on v4 contracts; older releases need their own docs. Migration uses an exact v5 target's packaged guide. Do not install/upgrade merely to obtain guidance without task authorization.

No installed package: choose the intended release first for a new project. Missing skill: use that release's docs or exact source revision, never current repository docs.

If using hosted MCP, read `marionette://catalog` before querying and match package version AND source revision to the installed artifact. Dirty, unknown or mismatched identity means use local docs. Follow the catalog's `requestIdentity`; installed `docs/tooling.md#hosted-documentation-mcp` explains the protocol where available.
