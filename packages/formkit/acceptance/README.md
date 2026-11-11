# Verification inputs

This directory retains two reproducible inputs:

- `experimental/composition-prototype.ts` and its README: an unexported experiment
  still used by unit tests, type checks, lint and canonical coverage.
- `known-core-file-equality.spec.mjs` and its note: a strict failing dependency
  diagnostic, kept separate from passing adapter gates.

Current production regressions live in `test/unit/formkit*.spec.js`; installed
consumer and optional Pro fixtures live in `test/fixtures/`. Follow
[OWNERSHIP.md](../OWNERSHIP.md) for commands and
[compatibility.md](../compatibility.md) for limits.

The 500-file historical snapshot is recoverable from
[immutable public commit 9b031550](https://github.com/marionettejs/marionette/tree/9b031550bb2737f052896ee0a0bfe032a54d5b55/packages/formkit/acceptance).
Its byte-for-byte archive and manifest were verified before removing 496 duplicated
logs, lock/coverage dumps, screenshots and older exploratory receipts from this
checkout. History was not purged. Historical source/version claims do not certify
the current dependency graph.
