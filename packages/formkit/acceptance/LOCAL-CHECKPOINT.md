# Local checkpoint after shared-schema fixes and cleanup

This is the historical `262945b5` measurement. Use
[GOAL-STATUS.md](GOAL-STATUS.md) for current acceptance and application ownership.
The later error-default recommendation and missing-source statements below are
superseded by that reconciliation and [NEXT-CONTRACTS.md](NEXT-CONTRACTS.md), while
the original measurements and strict failed outcomes remain preserved. New reset
baselines remain a broader open requirement. The later explicitly authorized
two-level custom RowView extension is measured separately in
[NESTED-ROWS.md](NESTED-ROWS.md); historical measurements below retain their scope.

Runtime checkpoint: `262945b5dd34439e1d715f918e7bd2e64ed8aaf2` on
`feat/mnjs-formkit-composed-views`. This is unpublished local work. Full transfer
artifacts preserve the approved archival base and commits; applying to canonical
stable v5 remains a separate integration step.

## Passed at this source

- Repository verify: build, declarations, API/profile/public-test/workflow checks,
  zero-warning lint, and2473 tests in166 files.
- Full configured coverage: nine production FormKit modules and the isolated
  manifest experiment have100% statements, lines, functions and branches.
  Thresholds and exceptions are unchanged. The relocated experiment keeps its
  unchanged48 tests, type/lint checks and explicit coverage inventory.
- Chromium10/10: representative composed flows plus native decimal preservation,
  authoritative pending-value replacement, focus and cleanup. Firefox/WebKit and
  assistive-technology speech are unverified.
- Clean installed ESM/CommonJS: seven runtime exports,20 schema/composed lifecycle
  cycles, keyed borrowed-schema/custom View routes, strict declarations, content
  and dependency checks. No experimental declaration, source fallback or runtime
  Vue/React/Pro dependency is shipped.
- Source/distribution checks, docs examples/installed quickstart and420 tooling
  tests. Docs validate85 HTML files and1118 internal links;55 recipes and20
  declaration fixtures execute.
- Actual normally installed MN/Vue shared JSON:16/16 assertions across eight cases
  per adapter. Root versus nested/row values, inherited methods, scoped fallback,
  validation, errors during reorder, focus, callbacks, reset and external updates
  agree at the explicitly wired root-data boundary. No automatic alias is added.

These passing measurements do not make the strict failures below pass, and the
complete stronger shared-lifetime gate remains blocked. Exact source/artifact,
JSON/oracle hashes, logs, all attempts and independent reviews are retained in the
local composed-views-evaluation handoff. Earlier G1–G5/G4 evidence retains its
original checkpoint and scope.

## Strict failed outcomes retained

Core2.1.2 treats two distinct Files as equal when name, size, type and lastModified
match, even if bytes differ. Public Core input retains the first File; the same
strict reference replacement fails through MN and genuine Vue model updates.
Thus a complex form replacing an upload with matching metadata can retain the
previous File and later submit its old bytes. File-reference copying and ordinary
uploads with distinguishable metadata remain tested; guaranteed same-metadata
replacement is not supported. This is a reproduced shared dependency limitation,
not an MN-only regression. The unchanged strict test body and original exact file
are retained; no blank-write/metadata/vendor workaround or assertion weakening
was used. See KNOWN-CORE-FILE-EQUALITY.md.

The stronger independent shared-slot cleanup probe exposed another upstream Vue
limit: after real app.unmount destroys/unregisters a native input, dispatching an
input event on the retained disconnected control reads null node context and
throws. A minimal genuine Vue text input reproduces it without custom wrappers.
Mounted slot/root/graph/focus outcomes and MN borrowed caller receivers pass
before that hard failure. The strict red and minimal baseline remain recorded;
they are not rescored or removed. This concerns retained controls receiving events
after terminal unmount, not an observed ordinary mounted-edit failure. MN cleanup
passes its retained-control checks. P12's stronger shared outcome is not certified.

Frozen matched author CHANGE remains MN11/11 clean versus Vue8/11 with10 unhandled
errors in that submitted consumer. No repaired or favorable rerun replaces it.
This is a bounded comparison, not a broad productivity claim.

## Recommended follow-up contracts, not implemented features

Recommend explicit `resetForm(values?)` adoption of a complete authoritative
baseline: ordinary setValues never rebases; reset adopts supplied values, clears
interaction/server state and aborts pending effects. A subsequent no-argument
reset returns to that adopted baseline. Empty/nested/keyed snapshots need explicit
semantics and tests. Application/actor ownership decides when a server snapshot is
accepted; the form performs no host I/O or actor reset.

Recommend nested custom RowViews through existing parent/rowKey wiring, with keys
unique per owned list and full ancestor-key lifetime/error/reset addressing.
Reorder preserves descendants; outer removal destroys inner resources, including
detached placements. Replace the current array-ancestor restriction only after
that addressing and its two-level tests are implemented. No second form root or
new generic composition facade is required.

Recommend native FormKit auto-clear defaults for imperative errors: field errors
clear on that field's next changed commit, root errors on a changed root, with
preserveErrors retaining them through edits. Validation remains rule-owned;
declarative errors/inputErrors replace or withdraw only their owner source. Reset
and explicit retry semantics across pinned/declarative owners require full tests.
A broad configurable error-policy matrix needs an actual host use case.

These remain required capabilities/open application mappings, not accepted
exclusions. The genuine host questions are when to adopt a server baseline and
whether engine diagnostics must survive programmatic projection. Missing actual
host/shared forms/services prevents certifying those application contracts.
Actual licensed Pro bootstrap is also unavailable; React runtime, SSR/StrictMode,
all plugins and arbitrary raw graph mutations remain unverified. These limits block
claiming a complete migration/roadmap; they do not prevent delivery of the bounded
initial package and the reviewed local cleanup.
