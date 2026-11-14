# Package architecture and integration

`@mnjs/formkit` follows the repository's named-export optional packages: ESM
`dist/index.js`, CommonJS `dist/index.cjs`, and separate `dist/types/esm` and
`dist/types/cjs` declaration scopes. The CommonJS declaration scope has its own
`package.json` with `type: commonjs`. `./components` follows the same contract;
only these entries and `./package.json` are exported. All eight directly imported
FormKit dependencies are pinned to 2.5.0. Marionette is a peer dependency so
consumers retain control of their framework instance.

`src/index.mjs` gives the runtime View its stable `FormKitView` public name and
exports mount, FormKitApplication, defaultConfig and bindings. `src/components.mjs`
exports portable helpers. These are package entry points, not duplicate runtime
implementations. The build consumes the existing runtime graph without changing
its files. Source maps retain the free-source provenance; package licenses include
the upstream FormKit notice. React, Vue, experiment tests, archives, keys and
licensed Pro vendor packages are absent from the packed file whitelist.

The build currently consumes runtime from
`experiments/formkit-react-patterns/core`. This is an explicit source-layout
transition, not an installed-package dependency: Rollup bundles that graph into
package outputs and keeps only FormKit and Marionette external. When the runtime
owner relocates the source, update the two public entry re-exports. Do not keep a
second copied runtime implementation or overwrite the runtime owner's edits.

`types/*.d.ts` defines the package facade independently of the current JavaScript
runtime's untyped internals. Core node/config/plugin/schema types remain the
upstream public definitions. `check:types` validates actual exported ESM and CJS
types, without skipLibCheck or wildcard any declarations. Public declaration
changes belong here; the runtime owner must report any changed return, option or
lifecycle contracts for alignment.

Vitest tests import `@mnjs/formkit` and its exported components entry. Package-local
aliases point those names at source entries, so test has no hidden build. They
exercise supported DOM/Core input, value/errors/reset, Region and Application
ownership, retained fields and factory update/destruction. The package checker
separately extracts a newly packed artifact into a consumer, checks actual export
resolution and encapsulation in both module systems, exercises form behavior,
then compiles both type fixtures. Local external dependencies are symlinked
read-only to avoid a registry requirement; this is an artifact-resolution and
behavior check, not a fresh registry-install claim.

Lint and coverage discover production files from Rollup's actual import graph.
Lint uses the repository configuration and rejects all warnings. It does not
ignore active production source under experiments. Coverage includes that same
external-to-package graph, with an explicit V8 report; the small facade suite
is not a comprehensive runtime coverage claim. No thresholds are silently
relaxed to make this source transition pass.

## Ownership and required shared edits

This lane stages only `packages/formkit/**`. Runtime modules, root scripts,
lockfile and CI workflows remain unchanged. A separate root integration patch
adds the workspace and command entry points, preserving unrelated root scripts.
The integrator must regenerate the root lockfile after workspace/dependency
integration and route CI to the new package checks. Existing core tarballs are
not FormKit evidence; `test/tmp/package-result.json` identifies the actual new
FormKit candidate and integrity.

The frozen base is 0078606d. Newer master and the reported d664 promotion head
must be reconciled by the integration owner; those refs are unavailable in this
isolated Git repository. In particular, do not replace or remove newer
`docs:prepare-html` integration merely because this frozen package.json lacks it.
Apply/reconcile specific shared hunks, then rerun the current root checks.
The package-local build intentionally does not need changes to the shared
`build/declarations.mjs` package whitelist.

## Evidence boundaries and confirmed runtime blockers

The default-visibility peer probe matches current frozen behavior: ordinary
text inputs show no required message initially and show one after actual
focus/blur, without an own validationVisibility prop. Bindings default ordinary
inputs to blur and checkboxes to dirty when no inherited configuration supplies
a mode. Historical live-default wording is stale; it is not a current runtime
divergence to preserve.

Explicit override removal is distinct. The adapter's declaration-ownership
logic clears its own prior value to restore inheritance, while preserving later
plugin/onNode/runtime replacements. The adapter ownership regression passes;
the default-visibility peer probe is not a blanket parity proof for removal.

The independent defaults review approves the scoped optional type/name correction
at 0078606d. Its combined-tree verdict remains hold: effective raw name/key
mapping can disagree with outlet lookup when raw explicit props override a
bound bag. A second independent review confirms that native dynamic-list child
schemas looping over list-provided $items allocate no row inputs/validators and
can accept an empty required row through native DOM submission. This is a
specific missing scoped-list mode; it is not evidence that all native lists
are absent. Both are runtime correctness blockers for this frozen package.

Before a release can be represented as ready:

- Fix and revalidate native dynamic-list row scope, validator allocation and
  native submission across the affected initial/update cases.
- Fix raw explicit name/key projection-to-outlet identity mapping while retaining
  literal raw values and declaration precedence.
- Resolve the active runtime's strict lint findings with its sole owner.
- Integrate runtime fixes and any source relocation, aligning public types.
- Reconcile the current branch/base and regenerate its workspace lockfile.
- Add FormKit to intended release/artifact/CI inventories through their owners.
- Run the combined package, root, installed and applicable browser checks.

No publication, deployment, merge or automated Mac testing is part of this lane.
