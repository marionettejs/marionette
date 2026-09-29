# Practical TypeScript results

2026-09-30. Slice based on `83bfbc0b`, on `docs/v5-reset`.

## Delivered

[Practical TypeScript](../../docs/guides/typescript.md) provides four independent
examples: constructor/instance types and initializer options; local DOM interaction
and state; preparation data versus lifecycle completion; and typed optional Model
sources. It uses runtime narrowing and shared domain types without casts, `any`,
non-null assertions, or new helper abstractions.

The guide explains the actual boundaries: general View sources remain opaque after
provider registration, UI queries may be absent, native event targets need narrowing,
and event-name annotations do not guarantee payloads. API response validation stays
separate from compile-time checking. Application owns readiness; local controls use
Views. Native data remains optional and incomplete for API access/persistence.

Navigation, API index, tooling and agent routes now find the guide. The runtime
reference's stale claim that utility/error references were missing was corrected.

## Verification

`npm run docs:check` passes all 41 independent executable fences, including the four
new examples. It compiles 15 TypeScript examples and 20 declaration fixtures against
installed public exports. The installed test also compiles the four guide files
under the documented strict browser/Bundler configuration, with no emit and library
checking enabled. Six invalid edits must fail with a diagnostic in the expected file:

- missing required initializer options;
- incorrect initializer property type;
- reading input properties without DOM target narrowing;
- treating optional Model attributes as required values;
- treating the generic View model as a typed native Model;
- assigning lifecycle completion to a preparation-data Promise.

Restoring the examples compiles successfully. Runtime assertions check local click
and input delivery, state separation, displayed readiness results, invalid response
rejection, and cleanup. The [author audit](evidence/typescript-guide-audit.md) records
source evidence and local execution; the [installed report](evidence/typescript-installed.json)
identifies packaged content and compiler outcomes. The five-test consumer recipe
and seven tooling checks continue to pass.

Ten API-inventory and six retrieval tests pass, along with focused lint and whitespace
checks. The reviewed type-shapes documentation gap is closed; metadata now records
49 documented groups and seven partial groups. These are reviewed dispositions,
not an API completeness score or release acceptance. No runtime or declaration
implementation changed. Full runtime/browser suites were not rerun in this slice.

## Review and corrections

An independent source audit checked option/state inference, source opacity, native
DOM matching, lifecycle signatures, and native class initialization. It corrected
wording about custom delegators and prompted an explanation of empty typed
initializer hooks. Those hooks declare constructor options without artificial setup.

Claude received the guide, outcome assertions, browser-config compiler validator,
and source audit. It supported the architecture and requested clearer wording about
preparation results and state inference, stronger negative checks, and a less brittle
compiler-exit assertion. We clarified that preparation data reaches the completion
hook, removed a broad claim about per-instance state inference, reused the explicit
Summary shape, and added the missing-options, DOM and Model checks. Compiler rejection
requires nonzero exit plus the expected diagnostic and file; no-emit is explicit.

The installed checks passed while review was running, resolving its pending-evidence
concern. We retain the user's explicit optional/incomplete data description. We do
not claim TypeScript correlates every overridden hook or event payload automatically.
Existing lifecycle/consumer tests cover abort during pending readiness; the new guide
checks signal forwarding and response validation. The final revised artifacts were
checked independently; Claude's review describes the supplied earlier snapshot.

## Strengths, limits, and next work

The guide follows current declarations and exposes their limits without forcing an
application architecture or hiding errors with casts. Both usable code and rejected
mistakes are checked from actual documentation in an isolated installed consumer.

It is common application guidance rather than an advanced generic/provider tutorial.
Compiler success does not establish browser interaction quality, ownership design,
or reader effectiveness. Public declaration hover examples also deserve a future
consistency pass; this slice does not edit source declaration comments.

Next reader priorities are external hosting/routing, production behavior, and
accessibility/rendering trust boundaries. A real migration and controlled reader
comparison remain separate from these technical checks.
