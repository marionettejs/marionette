# Optional adapters reference audit

## Scope and contracts

`docs/packages/adapters.md` documents the five public adapter subpaths, configuration scope, optional peers, provider methods, source ownership, DOM preservation, and exported types. The page links the canonical runtime and provider contracts; it does not replace the setup guide or promote an optional data provider to the framework default.

Checked `packages/adapters/package.json`, all five adapter source modules, and the private keyed-snapshot implementation used by XState. The internal helper is not presented as a public export. Backbone/XState state ownership and collection observation were checked against their unit and provider-acceptance tests. Lit/Morphdom lifecycle claims were checked against the shared DOM adapter contract suite; jQuery operations against its direct source and tests.

The package declares Backbone, jQuery, Morphdom, and Lit optional peers and separate optional declaration peers for Backbone/jQuery. XState is structurally typed and has no runtime import or declared peer; the reference states the supported v5 integration range already documented by the package. The repository tests use XState 5.33.2.

## Executable examples

`test/docs/adapters-reference-checks.mjs` adds outcome checks for the page's actual fences:

1. Backbone model updates and listener release, preserving source usability.
2. XState snapshots updating a View; destruction leaves a borrowed actor active.
3. Lit and Morphdom repeated rendering retains root and matching contents.
4. jQuery query shape and detached-handler preservation.
5. TypeScript adapter imports/options, typed jQuery results, and model-only actor API shape.

Fresh installed-package execution requires the optional peers used by these examples. The root runner owns that verification; the checks do not silently resolve missing peers from a global installation.

## Verification

Focused command: `npm exec -- vitest run test/unit/backbone-adapter.spec.js test/unit/xstate-adapter.spec.js test/unit/jquery-dom-api.spec.js test/unit/dom-adapters.spec.js test/unit/provider-acceptance.spec.js`.

Result: **61 tests passed across 5 files**. The assertion module also passed `node --check`.

The integrated reference/installation report is the authority for compiled and executed documentation examples. This audit does not establish reader effectiveness or architecture transfer.
