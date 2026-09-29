# Practical TypeScript guide audit

Date: 2026-09-30

## Scope and intent

`docs/guides/typescript.md` adds four independent examples for common consumer boundaries: inferred constructor options/custom state, local delegated DOM interaction, Application readiness results, and typed optional native data. It expands framework-wide guidance beyond the records example. No runtime, declaration, or records-example change is required.

The guide uses actual public exports with strict checks; it contains no `any`, type assertions, non-null assertions, custom metatype helper, persistence shim, or renderer wrapper. The optional data example names its incomplete transport capabilities explicitly. Runtime response validation stays distinct from compile-time shape checking.

## Source evidence

- `src/modules/view.ts`: `initialize`-based constructor inference, `ViewInstance` options, `model`/`collection` as unknown, `getUI` query-or-undefined result.
- `src/modules/application.ts`: awaited preparation-result inference and lifecycle operations returning `Promise<boolean>`.
- `src/runtime/event-delegator.ts`: optional `delegateTarget`, native selector matching, nested event targets.
- `src/mixins/view-events.ts`: string event maps do not prove callback payload types.
- `packages/data/src/model.ts`: partial attributes and typed `get` returning attribute-or-undefined.
- `test/types/presentation.mts`, `test/types/application.mts`: checked consumer contracts for initializer options, factory state, queries, and preparation results.
- `docs/tooling.md`: browser/bundler configuration is separate from this runner's NodeNext execution configuration.

The independent declaration audit also verified native class fields run after parent initialization and provider registration does not narrow generic View sources. These limitations are stated near the relevant guidance.

## Author checks

The four actual Markdown TypeScript fences were extracted into a disposable consumer folder with links to built public package exports, compiled with TypeScript 6.0.3 (`strict: true`, NodeNext, ES2024, `skipLibCheck: false`, no ambient package types), then executed with JSDOM using `test/docs/typescript-guide-checks.mjs` assertions. All four compiled and passed their observable outcome checks.

Outcome checks cover:

1. Required initializer label, custom method/state types, click delivery, independent factory states, and destruction.
2. Narrowed delegated input handling, safely displayed text, input identity/caret retention, focus, and handler cleanup.
3. Lifecycle boolean result, displayed readiness result, lifecycle signal forwarding, stop cleanup, invalid response rejection, and destruction.
4. Typed borrowed Model data, model-event updates, safely displayed text, missing-attribute fallback, and observation cleanup without source destruction.

The assertion module passed focused ESLint. These author checks use local built exports. Root integration separately verifies installed artifacts, browser-tooling configuration, negative compiler mutations, links, discovery, and any browser evidence. Do not label author checks as installed-package or real-browser evidence.

## Limits

Compilation and outcome assertions prove the shown contracts and behavior in the checked setup. They do not establish that new readers can discover the correct boundary or implement unseen tasks. Reader-effectiveness comparison remains a separate controlled evaluation. The guide is practical rather than an exhaustive TypeScript language or every-provider reference.
