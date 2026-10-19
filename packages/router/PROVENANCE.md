# Router source provenance

This private development package was extracted from RoundingWell/app-frontend
`feature/mnjs-router` at **0c730dceffc60bb5c85ceb31be2ee49f6956dcff**, specifically
`packages/router`. It starts from that JavaScript Navigation API/URLPattern
implementation, not the earlier Marionette History API prototype.

The receiving branch starts at Marionette master
**909890031209404fd8a375447abf51cc3a35ebfe**. The existing prototype branch
`codex/mnjs-router-prototype` at
**950e4c6dc67ca3e6e378267a95845dc6965eeaa4** was inspected as a comparison only.
No commits from it are merged here. app-frontend's separate
`feature/routing-composition` work is not the package source.

## Deliberate changes

- Authored TypeScript, generated ESM/CommonJS declarations and distributions,
  repository Vitest/public-entrypoint tests. The matcher remains internal.
- A callable MnObject-based outlet constructor supports Marionette `.extend()`
  and constructor delegation. Required owner subscriptions precede `initialize`;
  destruction does not depend on an overridable `onDestroy` hook.
- Reuse checks child instance identity, registration name and structural key.
  Retained owner restart preserves selection, including a restart begun during
  the first `start` notification. A child-owned restart is left running
  when its superseded initial selection resolves undefined. Owner stop/destroy still cancels selection.
- Router-local cancellation produces `false` after outstanding handler/redirect
  work settles. A `back()` request carries its own redirect/readiness chain
  through the queued traversal event, correlated by destination entry key.
- Canonicalizing aliases obey the redirect limit; already-vetoed/aborted events
  do not execute redirect planning.
- Named URL generation rejects route/parameter round-trip conflicts. Explicit
  state validates the documented plain-object contract rather than flattening
  Date/Map/Set values.

`restart: true` still reconstructs the selected child (stop/start), as in the
source package. Renaming that operation to distinguish it from retained
`Application.restart()` remains a maintainer decision. There is no compatibility
alias or second implementation. An adopting app must update its option name
alongside any eventual package rename.

## Evidence and release boundaries

The source's `UPSTREAM.md` and `docs/router-migration.md`, and the six October 17
reviews, are historical analysis. The untouched pinned package was independently
run locally on Node 24.19.0: **276 tests passed**. Current branch checks are separate
from that baseline; the commands are in [the package readme](readme.md), with results reported for each branch revision.

The earlier WebKit finding concerns redirect forwarding of traversal destination
state. Ordinary committed traversal reads the current entry and can retain state.
This branch does not change the driver to guess missing destination state and has
no fresh native-browser, Safari, focus/scroll, or app-frontend Cypress certification.

The source package manifest declared MIT, but its extraction proposal explicitly
left the license notice/copyright provenance unresolved. This package stays
`private: true`; it does not invent a copyright notice or license grant. Resolve
source rights, the release version/lockstep dependency plan, native-browser evidence,
and release-tooling integration before any public extraction or publication.
