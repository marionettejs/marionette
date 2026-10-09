# Diagnostic reference

Marionette diagnostic codes identify framework invariants consistently across
runtime errors, tooling, documentation, tests, and benchmark evaluation. The
machine-readable source is `config/diagnostics/catalog.json`; the field contract is
`config/diagnostics/catalog.schema.json`. See the [error reference](/development/api/errors/)
for application-facing behavior.

Each diagnostic has a permanent version-neutral route under `/errors/<code>/`. Codes
and slugs are never reused. A deprecated diagnostic keeps its route and identifies
its replacement.

See the [development documentation](/development/) for current framework behavior.
Generated pages report each diagnostic's status; planned codes do not imply an
available runtime API.
