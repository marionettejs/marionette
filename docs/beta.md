# Try Marionette v5 beta

`5.0.0-beta.1` is intended for application trials. Install that exact version from
the registry when available, or use the certified candidate tarballs before
publication. A matching version string alone does not prove that a locally built
artifact matches a release.

## What beta means

The intended architecture is ready for application trials: named core imports,
View and Region ownership, synchronous UI lifecycle, Application asynchronous
coordination, optional data/state providers, and first-party package declarations.
Use those documented public contracts. Beta feedback can still change an API before
stable; record any change in migration guidance and the release notes.

This beta makes no comparative agent-effectiveness claim. The public corpus remains
an unscored prototype. Architecture lint, generated method metadata, development
inspection, and additional test helpers are separate work, not installed features.

Core is `marionette`. The companion packages are `@mnjs/utils`,
`@mnjs/radio`, `@mnjs/data`, and `@mnjs/adapters`. Keep all package
versions aligned; install optional providers only when needed. See
[the migration ledger](./migration-from-v4.md) and [upgrade guide](../upgradeGuide.md).
The current registry alpha is an older implementation and is not this beta's API.

## Start in an empty directory

After publication, install core and the optional native data package explicitly:

```sh
mkdir my-marionette-app
cd my-marionette-app
npm init -y
npm install marionette@5.0.0-beta.1 @mnjs/data@5.0.0-beta.1
cp -R node_modules/marionette/dist/docs/starter ./starter
cd starter
npm install marionette@5.0.0-beta.1 @mnjs/data@5.0.0-beta.1
npm test
npm run build
npm run dev
```

The starter README explains its files and trial steps. It is also available in the
[source tree](https://github.com/marionettejs/marionette/tree/master/test/fixtures/data-package-starter).
Copying uses a new directory and preserves existing application files. The commands
above use a POSIX shell; on Windows, copy the same folder using your file manager.

Before publication, replace each runtime install with one `npm install` invocation
containing all five absolute candidate tarball paths. The required companions are
not assumed to exist on npm. Use artifacts from the same `release-evidence.json`;
keep their SHA-512 checksums and source commit with your trial report. Do not use
`npm link`, a Git dependency, or source imports as proof of the published install path.

The starter has editable rows, asynchronous local selection, deliberate cancellation,
and teardown. It has no backend, persistence, or URL router. Connect its `navigate`
function to the application's chosen router when URLs are needed. See
[routing](./routing.md) for loader failure, navigation away, and stop/restart rules.
Use [TypeScript guidance](./typescript.md) when adding typed application code.

## Check a real feature

1. Edit a row title without opening it. Reverse rows; the draft should survive.
2. Open the slow first note, then immediately open the second. The second should remain.
3. Change a module during `npm run dev`. The old workspace should release its handlers.
4. Run `npm test` and `npm run build`. Add a regression for your application's behavior.
5. Test keyboard focus and selection in a real browser using the actual DOM adapter.
6. Install the [consumer agent skill](./agent-tools.md) if useful, then ask it to locate
   the installed docs and identify the component responsible for cancellation.

The installed-consumer fixture checks the starter outside the repository against
candidate tarballs. The browser release matrix checks its draft, focus, selection,
stale-load suppression, and handler cleanup in Chromium, Firefox, and WebKit.
Those checks do not establish accessibility for an entire application or a router's
history/deployment behavior.

## Report feedback

[Open a reproducible issue](https://github.com/marionettejs/marionette/issues/new/choose)
with the exact package versions/source revision, selected providers, browser and
bundler, expected behavior, actual behavior, and a minimal anonymous reproduction.
Prioritize installation problems, incorrect declarations, lost editable state,
late navigation commits, leaked subscriptions, and confusing documentation.
Do not include private application code or customer data.

## Before publication

A beta needs verified scope/publisher access for all five packages, a clean candidate
commit, and the full [exact-artifact validation](https://github.com/marionettejs/marionette/blob/master/docs/release-promotion.md#dry-run).
Review the beta notes, migration guidance and installed starter together. Record
known failures instead of claiming the beta is stable. Registry installation must
be checked immediately after publication; local tarball tests cannot prove npm
permission, propagation, or trusted-publisher configuration.

## If the beta fails in your application

Pin your previous working dependency versions and restore the matching application
code and lockfile. The old `marionette@5.0.0-alpha.2` is not an API-compatible rollback
for this candidate; there is currently no previous published matching five-package
release. Existing v4 applications should retain their pre-migration revision and
`backbone.marionette` lockfile until their beta trial succeeds.

Maintainers must not overwrite a published beta version. Withdraw its recommendation,
deprecate a broken version with a specific reason, and publish a corrected beta.
Move `next` only to a verified compatible prior release; if beta.1 is the first one,
there is no earlier beta to select. Preserve exact artifacts and failure evidence.
See [release recovery](https://github.com/marionettejs/marionette/blob/master/docs/release-promotion.md#recovery-and-rollback).
