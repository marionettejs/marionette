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

Production modules now live in `packages/formkit/src/runtime`. The 16 active
modules move without byte changes; relative imports within that directory remain
unchanged. Public entries refer locally to `./runtime`. The production graph is
18 source files, all inside this package; package lint fails if it escapes that
source boundary. Experiment harnesses remain development fixtures and explicitly
import the package source. No forwarding modules or second implementation remain
at the old production paths.

The bindings extractor lives in `scripts/extract-bindings.mjs`; it verifies the
package-owned adapted output against the separately pinned React reference
installation. React remains development-only reference material and is absent
from runtime imports and the packed whitelist.

`types/*.d.ts` defines the package facade independently of the current JavaScript
runtime's untyped internals. Core node/config/plugin/schema types remain the
upstream public definitions. `check:types` validates actual exported ESM and CJS
types, without skipLibCheck or wildcard any declarations. These are hand-maintained declarations; successful consumer fixtures do not
prove complete agreement with every implementation signature. Full source-derived
declaration verification remains open. Public declaration changes belong here; the runtime owner must report any changed return, option or
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
ignore active production source. Coverage includes that same package-owned
graph, with an explicit V8 report; the small facade suite
is not a comprehensive runtime coverage claim. No thresholds are silently
relaxed to make this source transition pass.

## Ownership and required shared edits

The original architecture lane stages only `packages/formkit/**`; its frozen
artifact and supplemental documentation patch remain preserved. The separate
root/CI integration branch now registers the workspace, normally regenerates
its lockfile and adds packed-consumer verification to root verification and the
required core CI lane. Existing master docs:prepare-html routing is preserved.
The five-package same-version publication inventory is unchanged. Existing core
tarballs are
not FormKit evidence; `test/tmp/package-result.json` identifies the actual new
FormKit candidate and integrity.

The architecture originated at `0078606d`. The approved combined behavior
reference is `5fa30f06624c4c3a3e35ff5361ecf91a42df91e9`, incorporating
`c353a4d6` correctness, `cb9db280` formatting/extraction, `b4e2a3b8` lint,
`ab9703f0` controller cleanup and `22ed1209` dependency pruning. The existing
feature history is retained as ordinary descendants. Only FormKit paths and
necessary root wiring are ported; current-master HTML preparation and optional
package compatibility checks are preserved by the synthetic PR integration.
No merge commit or unrelated master files are part of the feature patch.
The package-local build does not change the shared declaration whitelist.

## Evidence boundaries

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
at 0078606d. Its combined-tree verdict was hold: effective raw name/key
mapping can disagree with outlet lookup when raw explicit props override a
bound bag. A second independent review confirms that native dynamic-list child
schemas looping over list-provided $items allocate no row inputs/validators and
can accept an empty required row through native DOM submission. This is a
specific missing scoped-list mode; it is not evidence that all native lists
are absent. Both were historical correctness blockers. Scoped schema reviews and the
comprehensive independent `5fa30f06` review approve their corrections and the
combined package integration. Root lint is now zero errors and warnings;
106 acceptance and 138 reference cases pass. These checks do not certify every
nested peer-reset sequence or real-browser behavior.

Before a release can be represented as ready:

- Establish applicable real-browser behavior and separately licensed Pro coverage;
  this candidate has zero exact-source Pro tests.
- Keep the Core receipt-history limitation explicit: 73 inert slots versus 41
  baseline, independently of bounded active subscriptions and adapter metadata.
- Keep optional-package verification separate from the unchanged five-package
  publication inventory; justify version and coverage policy before release wiring.
- Revalidate any later runtime/source-layout changes with public types, package,
  root and installed-consumer checks.

No publication, deployment, merge or automated Mac testing is part of this lane.

## Relocation integration order

Apply the sole runtime writer's independently reviewed schema identity fix first.
Then run the mechanical relocation recipe on that clean approved checkpoint,
recording hashes of its current 16 modules. Do not overwrite them with baseline
`8f0c03fc` bytes. Replay only the structure/docs/history support changes and rerun
extraction, public package/packed/type checks and maintained peer fixtures.
Independent review is required before publication. No runtime semantic change is
part of this checkpoint. Production lines up to 769 characters remain unchanged;
formatting belongs in a separate proof-backed checkpoint.

Historical generated receipts and inactive checkpoints remain accessible at the
immutable published `8f0c03fc` tree, linked from the experiment's `HISTORY.md`.
The referenced baseline comparator and every maintained fixture remain runnable.
Exact-head release grouping/build-transfer/HTML preparation tooling remains in
place: the preceding hosted failure proved those prerequisites are necessary.

## Deterministic package regression gates

`check:package` invokes compiler-count, dynamic-scope and dependency-lifetime guards
after existing packed behavior and strict type consumers. Root `test:formkit`
and the required Core CI job therefore execute them. The count guard bundles the
public source entry with Rollup and intercepts only the actual layout compiler
import/outlet updates in a temporary test bundle. It asserts one instrumentation
match, zero repeated identity compiles and all200/800schema outlet updates, plus
distinct direct-field controls. It does not collect elapsed times. Dynamic scope
and lifetime guards execute the actual extracted tarball entry. Previous success
reports are removed before attempts; guard failures propagate and cannot leave a
new passing package report. No runtime test hook is shipped.
