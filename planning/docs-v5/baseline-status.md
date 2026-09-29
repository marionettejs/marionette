# Committed baseline

2026-09-29. Integration branch: `docs/v5-reset`. These commits preserve work in progress; they do not establish release readiness or documentation effectiveness.

- `e306ca7b`: native destruction releases incoming subscriptions after final notifications, with regression tests and changelog guidance.
- `0173d44f7`: rebuilt consumer reference, concepts, setup, records lesson, runnable example, and the existing documentation/skill reset. The two DOM declaration-test comments clarify the existing contract without changing assertions.

The docs rely on the preceding destruction cleanup. Keep that dependency explicit when reviewing or moving these commits.

## Verification at commit time

- 73 tests passed across destroy-listener-cleanup, mixins/destroy, behavior-lifecycle, region-lifecycle, and destroying-views.
- `npm run check:types` passed.
- ESLint passed for the six changed runtime files and the new cleanup regression suite.
- All 33 consumer documentation and example files matched the hashes in `evidence/concepts-package.json` before committing. One trailing blank line was then removed from `docs/api/common.md`; no other consumer content changed in the baseline commit.
- Whitespace checks passed for the runtime and consumer-doc commits.

The earlier installed candidate package check recorded 12 reference examples, 16 declaration fixtures, production builds, and 51 browser checks. Those are historical results tied to that report's hashes, not freshly rerun checks. The full unit suite and production documentation pipeline were not rerun here. The earlier full unit result includes ten missing-document failures in docs-integrations-examples; production documentation tooling still needs migration to the replacement corpus.

## Latest effectiveness result

Stringent's `docs/docs-v5-20260929-navigation-v2-results.md` records the completed schedule for frozen bundle `ebb4d89be7ec4fac400fa9a9cff75079d5ee2f2aa8789c04ed193d23676c4b6a`. Evidence remains in that repository under `runs/docs-v5-20260929-navigation-v2-live/` and its separate architecture-review directory.

Three of six trajectories were valid, leaving one complete reference/guided pair. The other three hit the Claude session limit; their starter snapshots are not documentation failures. All three valid trajectories failed architecture acceptance at both checkpoints. The valid guided candidate passed all browser checks and read the records lesson and example, but made its root View own feature loading and shared-state coordination. No measured `read_document` call opened the architecture guide; shell tracing is incomplete.

This does not establish reliable improvement from the guidance. Inspect the saved traces before spending more model allowance. Changes to docs or interpretation require a new frozen condition; preserve the original run and findings. No further live run is authorized by these commits.

## Next review boundary

Future focused PRs target `docs/v5-reset`. Record the question each change addresses and the evidence needed to assess it. Keep correctness checks, architectural judgments, and teaching effectiveness separate. The existing results documents describe their historical stages; this page records the status when the baseline was committed.
