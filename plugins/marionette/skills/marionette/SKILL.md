---
name: marionette
description: Find installed Marionette guidance for application development, debugging, and v4 migration.
---

# Marionette applications

Run `node <skill>/scripts/locate.mjs --project <application-directory>`, replacing
`<skill>` with this skill directory. It reads package metadata without importing
application code. Use `--package-root <physical-directory>` for an external store.

Read the returned `skillPath` and follow that installed skill. Use its scripts and
package-relative documentation, so instructions match the application version.
The plugin version identifies this loader, not the framework release. For framework
changes, follow that repository's guidance.

If the result identifies `backbone.marionette` 4.x, preserve its v4 contracts while
working on the existing application. For an upgrade, choose an exact v5 target and
read that target's packaged migration guide; do not interpret v5 instructions as
v4 APIs. Older releases require their own version-specific guidance. If both packages are installed, determine which entrypoint the feature
imports before selecting its guidance. Do not install or upgrade dependencies just
to obtain a skill unless the task authorizes it.

If an installed release has no packaged skill, use its own documentation or obtain
its exact release/source revision. For a new project, select the intended release
before loading guidance. Do not substitute this repository's current docs.

The plugin also connects the hosted documentation MCP. Read `marionette://catalog`
and compare its package version and source revision with the installed artifact.
Use installed documentation when they differ. Where present, the installed
`docs/tooling.md#hosted-documentation-mcp` explains the request identity protocol.
