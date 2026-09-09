# Local desktop baseline: September 9, 2026

[Raw samples and provenance](report.json) record five warmups and 25 retained
samples per workload in headless Chromium 151. Every retained sample passed its
public behavior and cleanup assertions.

| Workload | Median | p95 |
| --- | ---: | ---: |
| Native-data list mutations (250 rows) | 8.50 ms | 9.20 ms |
| Application lifecycle (25 cycles) | 0.30 ms | 0.40 ms |
| State mount/destruction (40 cycles) | 0.70 ms | 0.90 ms |

Cypress and concurrent repository builds/tests were stopped. Spotlight and
endpoint-security background activity remained. These are local desktop samples,
not dedicated-host measurements or evidence of a cross-host speed advantage.
Timing is report-only; successful teardown is not proof of garbage collection.

The report records the isolated worktree's original commit `84ca6d4`. Its
performance slice is integrated at `e8daa7c8`, an ancestor of this branch. Every
recorded source/fixture/package/lock input hash was checked against that integrated
commit, and every measured built-runtime hash matches the combined candidate.
The original report bytes are preserved. Reproduction starts from `e8daa7c8`
and the report's pinned toolchain; use the exact fixture and runner settings and
record host activity again.

Report SHA-256: `d6ee423df41b3fd346c901b67f2d002650647357aa75adaa1ca0e0a252c03f72`.
