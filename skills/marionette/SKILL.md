---
name: marionette
description: Build and debug applications using Marionette v5 with the installed version's documentation, independent integration choices, and lifecycle-aware validation. Use for application work involving Marionette Views, Regions, CollectionViews, Application, state, or adapters; library maintenance follows its own repository instructions.
---

# Build with Marionette

Use the application's installed contract. This skill does not select a package
version, authorize an upgrade, or replace the application's existing decisions.

## Find the contract

Inspect the application's manifest, lockfile, and runtime configuration. Resolve
paths relative to the application being edited, including its workspace directory
in a monorepo. Do not use the skill's own directory as the application root.

Run the bundled helper with Node 24 or later (replace both absolute paths):

```sh
node /path/to/marionette/scripts/docs.mjs --project /path/to/application --list
node /path/to/marionette/scripts/docs.mjs --project /path/to/application --page docs/agents.md
```

The helper reads files only. It finds the installed `marionette` package without
executing project code, checks the packaged documentation's version and hashes,
and reports provenance. Use its returned paths to read further pages. It does not
search the internet or run a package manager. For an installation without a
`node_modules` tree, supply `--package-root /physical/path/to/marionette` obtained
from that project's package manager. Do not substitute a different workspace's
package just because it is available.

If the installed artifact has no `dist/docs`, inspect its exports and declarations
and obtain docs from that package's exact release or known source commit. An alpha
version string alone does not establish a source match. Report missing provenance;
do not silently use `master`, current website docs, or another project's package.
A hash check detects inconsistent documentation files, not whether a custom build's
JavaScript actually matches those docs. Validate uncertain behavior against the
installed runtime. A `sourceDirty: true` manifest describes local changes, not an
immutable release.

## Read only what the task needs

Start with packaged `docs/agents.md`, then use these source paths from the manifest:

- New application: `docs/development.md` for the executable typed starter;
  `docs/installation.md` and `docs/choosing-integrations.md` for setup decisions.
- UI ownership and replacement: `docs/marionette.view.md`,
  `docs/marionette.region.md`, and `docs/view.lifecycle.md`.
- Changing lists: `docs/marionette.collectionview.md` and `docs/data.api.md`.
- Asynchronous features or routing: `docs/marionette.application.md` and
  `docs/routing.md`.
- State or a diagnostic: `docs/marionette.state.md` or
  `docs/diagnostic-catalog.md`.

If the client already has the Marionette documentation MCP configured, consult
the `marionette://catalog` resource before searching. Use remote documents only
when version and source match this installation. Pass the exact installed
`version` to every tool and follow `nextOffset` until it is `null` to retrieve the
complete page or example.
Setup instructions: https://marionettejs.com/docs/mcp/. A URL in these instructions
does not install an MCP connection. Keep the installed docs when the catalog is
unsupported or the service is unavailable. Website WebMCP only controls its own
examples, not this application.

The manifest is the available-page index. Follow direct links for the selected
task instead of loading the whole reference. For v4 work, use matching migration
material and installed APIs; these v5 instructions are not an upgrade plan.

## Make the application decision

Preserve a compatible established integration. For a new application, use built-in
behavior when it supplies the capability; select an observable source when updates
need observation. Choose DataApi, StateApi, renderer, DomApi, EventDelegator, and
router independently. A Backbone router does not require Backbone data or state.
Register configuration before creating its consumers; use an isolated runtime only
when independent configurations must coexist.

Make the first draft idiomatic: templates for ordinary content, named Regions for
composition, `ui` for controls, `triggers` for semantic View events, and `events`
when the handler needs the DOM event. Domain records belong in data sources;
CollectionView children are their presentation, not a record store. For a new
observable list, start with `@mnjs/data` and configure DataApi before construction.
Native Collection `toArray()` returns plain attributes; iteration yields Models.
Do not assume Backbone/Underscore methods.
Update the smallest responsible View so unrelated drafts, focus and child identity
survive. Cover every displayed or calculated field in data subscriptions, and let
CollectionView reconcile membership without an extra whole-list render handler.
Do not replace focused inputs in response to their own edits.
Native DOM access belongs at boundaries such as focus or a widget.

For a personalized app, connect a real user preference to both the interaction and
visual design. Choose a specific visual direction before coding; preserve readable
hierarchy, spacing, contrast, labels and narrow layouts. Do not force a line count
that collapses independent owners into one View. Keep teaching/test controls out of
the app itself. The website's optional personal-app brief supplies its own starter;
it does not authorize browsing private sources for personalization.

Name the owner and cleanup operation for Views, subscriptions, widgets, and async
work. Use public lifecycle APIs. Check stale work before committing side effects;
framework cancellation cannot undo arbitrary writes by application code. Consult
the current reference for exact return and readiness behavior rather than inferring
it from a method name.

Use the application's own test commands. Exercise the requested behavior and its
relevant boundary: stale navigation, surviving edits/focus, rerendered event
handlers, or resource cleanup. For observable records, change a source directly and verify all interested Views,
not just the clicked row. Check repeated attachment for attachment-bound work.
Browser behavior needs a browser check; visual quality needs rendered inspection
at desktop and narrow widths. Report
commands actually run and untested boundaries; a successful build is not proof of
those interactions. Record changed integration decisions in the application's own
instructions without copying the library's maintainer policy.
