# Public contract inventory

This is the compact contract record for core, utils, Radio, native data and every
adapter entrypoint. The existing guides remain the canonical explanations.
The JSON is documentation metadata, packaged under `dist/docs/config/api-contracts/`;
it is never imported by production modules.

- [inventory.json](../../config/api-contracts/inventory.json) derives exports, signatures, inherited public
  methods, constructor options, child-query protocols and emitter sites from the
  authored TypeScript that generates the package declarations. `kind` distinguishes
  runtime values from type-only exports. `callableInstanceMembers` supports static
  tooling without guessing from signature strings. `toolingEntrypoints` records
  explicitly separate development exports such as `marionette/eslint`.
- [semantics.json](../../config/api-contracts/semantics.json) records result, timing, ownership, mutation,
  repeat-call and destruction boundaries, diagnostic codes, public event arguments,
  and exact guide headings and behavioral tests. Export-wide profiles describe
  composition; profiles with `members` refine the named operations. Multiple
  profiles apply together. `operationContracts` resolves those profiles for each
  callable static/instance member. Inherited Events and helper methods use the same
  contracts as their standalone exports.

[The compact consumer reference](../../docs/compact-reference.md) is generated from
selected reviewed semantic profiles, public exports, and diagnostics. It links to
the canonical examples and introduces no second set of API facts. The same checker
rejects edits or stale output in that page; update the reviewed profile or generator
and regenerate it. Consistency does not establish measured agent usefulness.

Signatures are generated; semantics are deliberate review decisions. Emitter
sites retain dynamic expressions because event forwarding, native provider event
names and application-defined events cannot be represented as a closed literal
list. They are implementation evidence, not an extra public event vocabulary.
The explicit `events` records describe framework lifecycle notifications.

## Check and update

From the source repository with its pinned dependencies installed:

```sh
node scripts/api-contracts/check.mjs
node --test test/tooling/api-contracts.test.mjs
```

A changed export, signature, implementation, semantic profile, diagnostic mapping,
canonical guide or cited fixture invalidates the record. The source digest is
intentionally conservative: even an implementation-only edit requires a deliberate
review. The checker validates actual test declarations, including shared DOM case
registrations; it does not merely check that a filename exists. It hashes whole
cited fixtures because changes to setup or helper behavior also matter.

After reviewing the changed contract and running its behavioral tests, update the
semantic record where necessary and regenerate the derived record:

```sh
node scripts/api-contracts/check.mjs --write
```

Review that diff before committing. `--write` is not behavioral validation.
The checker establishes inventory consistency, not correctness of arbitrary
callbacks or exhaustive coverage of every argument combination. Execute the exact
cited test files, the public test-boundary check, and declaration/installed-consumer
checks appropriate to the change. Declaration builds remain responsible for
matching generated ESM/CommonJS artifacts to their authored source.

## Accepted boundaries

Synchronous callbacks and valid adapters must complete successfully. Exceptions
abort construction, registration, rendering or teardown without rollback,
attempt-all cleanup or an automatic retry promise. Application readiness and
cancellation follow their separately recorded asynchronous contract. No contract
record authorizes a new runtime guard, ownership mechanism or API.

This inventory records the public API and available behavioral evidence. It does
not establish real-world adoption, measured agent improvement, or stable-release
readiness; those remain separate roadmap decisions.
