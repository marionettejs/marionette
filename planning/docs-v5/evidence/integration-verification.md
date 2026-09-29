# Installed integration and public cleanup verification

## Changes

- Replaced private listener/Behavior storage assertions in
  `test/unit/destroy-listener-cleanup.spec.js` with public outcomes. Destroyed
  sources stop delivering callbacks, final notifications retain their order,
  surviving sources remain usable, and a surviving listener's `stopListening()`
  no longer visits a destroyed source's public `off()` method. Direct Behavior
  removal is checked by absence of later host notifications and duplicate cleanup.
- Extended the existing `dom-adapters-package` installed fixture. An external Lit
  renderer owns the host; a Region owns its Lit child. Host rerender, child
  detach/reattach, replacement and destruction preserve the other owner's
  subscriptions and release child DOM handlers.
- Added combined CollectionView accounting for public provider cleanup handles:
  structural collection observation, parent/row entity bindings, parent/row state
  bindings, and Lit directive subscriptions. Add/remove/reset verify retained or
  replaced child identity and exact live counts. Detachment releases Lit
  connections while preserving data/state observation. Destruction releases all
  acquired handles, leaves borrowed sources alive, stops later callbacks, and
  preserves an unrelated collection subscriber.
- The fixture runner now installs the frozen native data candidate for this
  existing fixture. No external dependency, lockfile, runtime, declaration,
  release-test inventory, or public documentation changes were needed.

## Results

- `vitest run test/unit/destroy-listener-cleanup.spec.js`: **25 passed**.
- `npm run check:public-tests`: **passed**; no suppression or private-name access.
- ESLint on all changed JavaScript and scoped `git diff --check`: **passed**.
- Installed `dom-adapters-package` fixture: **passed**, using all five explicit
  local tarball inputs. Both new integration scenarios ran for ESM and CommonJS;
  existing Lit/Morphdom scenarios and TypeScript 7/6 compilation also passed.
- [Machine-readable fixture evidence](integration-fixture.json) contains frozen
  artifact hashes, external dependency graph, exact installed package graph,
  validator output and status. The candidate overlay preserved the fixture's
  committed external dependency graph.

The candidate artifacts were packed from the parent's stable package snapshot
before parallel documentation changes. Core artifact SHA-256:
`f6e814de32cb0ffb4cbebb346035ed9f8fe8b85f20a0d02f764993e2377a25be`.

## Limits

The installed integration scenarios use JSDOM. They establish package-level
composition, subscription ownership, DOM identity and delivery behavior; they do
not establish real-browser focus behavior, garbage collection, documentation
teaching effectiveness, or the contents of a later rebuilt package candidate.
