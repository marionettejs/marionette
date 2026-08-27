# Diagnostic reference

Marionette diagnostic codes identify framework invariants consistently across
runtime errors, tooling, documentation, tests, and benchmark evaluation. The
machine-readable source is `config/diagnostics/catalog.json`; the field contract and
stability policy are documented in `docs/diagnostic-catalog.md`.

Each diagnostic has a permanent version-neutral route under `/errors/<code>/`. Codes
and slugs are never reused. A deprecated diagnostic keeps its route and identifies
its replacement.

See the [development documentation](/next/) for current framework behavior. Runtime
errors will adopt the currently `defined` catalog codes in the Phase 1 diagnostics
work; generated pages show whether a code is defined, active, or deprecated.
