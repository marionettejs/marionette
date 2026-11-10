---
name: marionette
description: Find installed Marionette guidance for application development, debugging, and v4 migration.
---

# Marionette applications

Run `node <skill>/scripts/locate.mjs --project <application-directory>`; `<skill>` is this skill directory. It reads metadata without importing application code. External stores use `--package-root <physical-directory>`.

Follow the returned `skillPath` for the package the feature imports; check imports when both packages are installed. The plugin version identifies the loader, not the framework.

Keep `backbone.marionette` 4.x on v4 contracts; older releases need their own docs. Migration uses an exact v5 target's packaged guide. Do not install/upgrade merely to obtain guidance without task authorization.

No installed package: choose the intended release first for a new project. Missing skill: use that release's docs or exact source revision, never current repository docs.

If using hosted MCP, read `marionette://catalog` before querying and match package version AND source revision to the installed artifact. Dirty, unknown or mismatched identity means use local docs. Follow the catalog's `requestIdentity`; installed `docs/tooling.md#hosted-documentation-mcp` explains the protocol where available.
