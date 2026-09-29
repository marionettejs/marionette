# Utilities and errors reference audit

## Scope

Added canonical references for the supported `@mnjs/utils` exports and the core `MarionetteError` constructor. Shared Events, class methods, and binding lifetimes remain linked to their existing references. The new pages do not prescribe application structure or add example-only helper implementations.

## Source checks

- `packages/utils/src/index.ts` defines the runtime and type export inventory.
- `packages/utils/src/get-value.ts`, `get-option.ts`, `merge-options.ts`, and `normalize-methods.ts` establish receiver, fallback, copying, and handler-resolution behavior.
- `packages/utils/src/bind-events.ts` establishes standalone normalization and the event-map diagnostic; common reference remains the owner of binding cleanup guidance.
- `packages/utils/src/extend.ts` establishes function-constructor forwarding, explicit construction for native classes, property copying, and extension types.
- `packages/utils/src/build-event-args.ts`, `call-handler.ts`, `once-wrap.ts`, `unique-id.ts`, `is-string.ts`, and `set-property.ts` establish standalone argument and result contracts.
- `packages/utils/src/error.ts` and `test/unit/modules-error.spec.js` establish native Error identity, construction, metadata, stack behavior, and URL formatting.
- `skills/marionette/scripts/docs.mjs` and `config/diagnostics/catalog.json` establish actual local diagnostic output. The page describes status/remediation metadata rather than promising a richer troubleshooting narrative than the catalog supplies.

## Executable evidence

`test/docs/utils-reference-checks.mjs` checks four actual documentation JavaScript fences: component binding/cleanup and hook ordering, value/handler resolution, standalone helpers and once-failure behavior, and native error identity/formatting/metadata. One TypeScript fence exercises typed callback results, event maps, and unknown-value narrowing. The root reference runner must import these checks; its integrated report is the authority for execution outcomes.

Focused source tests: utilities, MarionetteError, getOption, mergeOptions, and normalizeMethods. Command: `npm exec -- vitest run test/unit/utils test/unit/modules-error.spec.js test/unit/common/get-option.spec.js test/unit/common/merge-options.spec.js test/unit/common/normalize-methods.spec.js`. Result: 107 tests passed across 13 files.

## Coverage limits

Updated only utility/error semantic profiles whose documented contracts are now covered. Shared owner profiles remain separate and are not marked complete merely because a standalone utility reference exists. This work establishes reference accuracy and executable examples; it does not establish reader effectiveness, search quality, or complete framework documentation.
