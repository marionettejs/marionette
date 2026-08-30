# Diagnostic catalog

Marionette uses one machine-readable catalog to identify framework invariants across
runtime diagnostics, static analysis, development and test tooling, documentation,
and the public agent benchmark. The catalog is stored in
`config/diagnostics/catalog.json`, and its executable contract is
`config/diagnostics/catalog.schema.json`.

The catalog is static project metadata. Production entrypoints must not import the
catalog, and the catalog is not part of the production package surface. Runtime
diagnostics may embed a compact catalog code, but they must not load the full catalog.
Schema version 2 adds explicit retired identities without restoring their emissions.

## Runtime error contract

Framework invariant failures use the public `MarionetteError` class:

```javascript
import { MarionetteError, Region } from 'marionette';

try {
  new Region({ el: [] });
} catch (error) {
  if (error instanceof MarionetteError && error.code === 'MN0002') {
    // Handle the invalid Region element configuration.
  }
}
```

`MarionetteError` extends the native `Error` class and exposes `name`, `code`,
`message`, `stack`, and the existing `url` property. The code is the stable lookup
key for the repository-generated diagnostic reference. Error names preserve useful
framework categories such as `ViewError`, `RegionError`, and `CollectionViewError`.
Messages and legacy URLs are explanatory prose and are not machine contracts.

Production errors copy only supported Error fields and the compact code. They do not
import the catalog or perform runtime catalog lookup. Engines with
`Error.captureStackTrace` use it; other engines retain the native fallback stack.

## Entry contract

Every entry has these fields:

- `code`: an opaque identifier in the form `MN0001`. The number does not encode the
  diagnostic category, object, severity, or implementation order.
- `slug`: a unique lowercase kebab-case name used by tools and people.
- `status`: `defined` before the code is emitted, `active` once a supported surface
  emits it, `deprecated` after it has a replacement, or `retired` after the
  diagnostic is removed without a replacement. Retired entries remain cataloged
  permanently but cannot be emitted.
- `category`: the kind of contract involved: `configuration`, `communication`,
  `dom`, `lifecycle`, or `ownership`.
- `severity`: `error`, `warning`, or `info`, following the model below.
- `objects`: the public Marionette objects involved in the invariant.
- `remediation`: concise guidance for correcting the violation. This is human prose
  and may improve without changing the diagnostic identity.
- `docsAnchor`: the permanent version-neutral documentation route. It is always
  `/errors/<code>/`.
- `surfaces`: the places that report the diagnostic, or historically reported it
  for a retired entry: `runtime`, `lint`, `development`, `test`, or `benchmark`.
- `benchmarkCategory`: the public benchmark category used to classify the violation.

A deprecated entry also has `replacementCode`, which must identify another catalog
entry. Defined, active, and retired entries cannot declare a replacement.

### Severity model

- `error` means the invariant is violated and the requested operation cannot safely
  continue. Runtime surfaces throw; lint and validation surfaces fail their check;
  benchmark runs count the violation as incorrect.
- `warning` means execution can continue but the usage is unsafe, deprecated, or
  likely unintended. Tools report it without changing runtime control flow; release
  evidence must explicitly approve or eliminate it.
- `info` records deterministic context or guidance without indicating incorrect
  behavior. It does not fail an operation, check, or benchmark result by itself.

For a retired entry, the stored severity and surfaces retain the diagnostic's
historical classification. The generated reference labels those values as historical
for display only. The `retired` status is authoritative: the entry is not a current
error, warning, informational report, or supported-surface mapping.

## Stability policy

Codes and slugs are unique and are never reassigned. The numeric portion of a code is
allocated monotonically, gaps are allowed, and entries are never renumbered to close
a gap. Deprecation retains both the catalog entry and its `/errors/<code>/` route and
names the replacement. Retirement retains the identity and route without implying a
replacement. Deletion and reuse are not supported.

Before stable v5, defined catalog fields may be revised through reviewed changes.
After stable v5, active, deprecated, and retired entries follow these rules:

- adding a diagnostic or deprecating one is a minor change;
- retiring an active diagnostic changes supported behavior and requires
  major-version review;
- clarifying remediation without changing its meaning is a patch change;
- changing the meaning of a machine-readable field or the schema is a breaking
  change and requires a new schema version and major-version review;
- deleting or reusing a published code, slug, or diagnostic route is prohibited.

Messages are deliberately not catalog identifiers. Human-readable runtime messages
may improve while the code and slug remain stable.

## Surface mappings

Runtime diagnostics declare their catalog identifier as a literal `code` property.
Custom ESLint rules under `eslint-rules/` default-export an object literal whose
`meta` object declares exactly one literal `diagnosticCode`. Benchmark and test
results record the same code rather than copying the diagnostic meaning into a
second identifier.

Runtime diagnostic options and lint-rule metadata cannot use computed keys, spreads,
or duplicate mapping properties. This keeps the emitted code statically decidable.
A `defined` entry must move to `active` in the same change that first emits it.
A retired entry cannot be emitted or mapped by a supported surface.

`npm run check:diagnostics` derives the shipped source graph from the production
Rollup inputs, rejects runtime codes or lint-rule mappings that are not in the
catalog, and rejects a lint rule without a mapping. Documentation routes are
generated from the catalog and then checked by `npm run docs:check`; they are not
maintained as a second hand-written list.

## Initial scope

The initial active entries describe only deliberate errors already thrown by the
framework. Retired entries reserve identities that were formerly active; they do not
reserve codes for planned validation. Defined entries likewise are not placeholders
for incidental JavaScript exceptions or benchmark hypotheses. New invariants receive codes when their
behavior and remediation are implemented and reviewed.

The generated [diagnostic reference](/errors/) lists the current catalog directly
from the machine-readable source. A shared invariant has one code even when more
than one framework object reports it.
