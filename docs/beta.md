# Try Marionette v5 beta

`5.0.0-beta.2` is prepared for application trials. Registry installation requires
a published release; use certified tarballs before publication. Release promotion
sets npm `latest` to the current prerelease until stable v5. A matching version
string alone does not prove that a locally built artifact matches a release.

## What beta means

The intended architecture is ready for application trials: named core imports,
View and Region ownership, synchronous UI lifecycle, Application asynchronous
coordination, optional data/state providers, and first-party package declarations.
Use those documented public contracts. Beta feedback can still change an API before
stable; record any change in migration guidance and the release notes.

This beta makes no comparative agent-effectiveness claim. The public corpus remains
an unscored prototype. This candidate includes consumer lint, a compact contract reference, source maps,
and a typed starter with browser tests; those tools do not establish agent effectiveness.

Core is `marionette`. The companion packages are `@mnjs/utils`,
`@mnjs/radio`, `@mnjs/data`, and `@mnjs/adapters`. Keep all package
versions aligned; install optional providers only when needed. See
[the migration ledger](./migration-from-v4.md) and [upgrade guide](../upgradeGuide.md).
The historical registry alpha is an older implementation and is not this beta's API.

## Start an application

Follow the [TypeScript starter instructions](development.md) for either a
published npm package or this unpublished candidate. The npm-distributed starter
pins matching runtime dependencies; a candidate kit instead supplies exact local
tarballs and a complete lockfile. Both include application agent instructions,
typecheck, consumer lint, unit tests, build, and a browser-test command.

The registry path requires beta.2 to be published first. Beta.1 has its
own older starter and documentation; it does not contain this candidate's tools.

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
Move the selected npm tag (`latest` before the first stable v5) only to a verified compatible prior release; if beta.1 is the first one,
there is no earlier beta to select. Preserve exact artifacts and failure evidence.
See [release recovery](https://github.com/marionettejs/marionette/blob/master/docs/release-promotion.md#recovery-and-rollback).
