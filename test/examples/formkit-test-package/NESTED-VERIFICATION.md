# Verified nested FormKit consumer checkpoint

Measured 2026-10-12 after the coherent baab checkpoint was committed as
`07ddd1a8eb439ca598bb5418aad4fc07c1687b3f`. Helper production source remains
unchanged and Marionette remains canonical stable 5.0.0. The earlier
[baab verification](VERIFICATION.md) and source scaffold are preserved.

## Verified migration

Accepted the exact source-only delta from
`baab5619fcf207eb2ec1139d367dcea09c67acd2` to
`11a3f8305402b9cdda7fd9918daeb9a9ad9d1fc3`, runtime commit
`f2c8e62267e6619b7e3a712eb1fcbfaa2a65781a`. The ZIP was 226,453 bytes, SHA-256
`65ee9218edc0033d164cdbbd72e76b36d546b367e885673877012eebf156e5b3`;
manifest was 17,634 bytes, SHA-256
`f9a061b27e7cb1b59e170532d4117585b8c59a675e0c34fc02404e6daedd89f5`.
All 28 archive members matched byte counts and SHA-256, and all 24 committed
files matched Git blob IDs. The bundle requires unavailable full archived base
objects; no whole patch or bundle was applied to canonical HEAD.

In a fresh scoped consumer build, each selected replacement first matched its
baab before hash: two production modules, package readme/rows guide, and two row
suites. The unchanged eight-case oracle was added separately. All nine final
production hashes match the verified delta plus unchanged base inventory.
Canonical repository-wide API inventories, root configuration and release
inventory were preserved; FormKit production source remains in the scoped
consumer scaffold rather than added to the canonical shipping package set.

Fresh ESM/CJS runtime and declarations were built from those sources. Package
version remains unpublished `@mnjs/formkit@5.0.0-rc.2`. Fresh artifact: 189,771
bytes, SHA-256
`5cba8348876631d6eb3bc58eacd2fb5e5e88dd65da2d22f1118fc3b2883d8964`.

## Current measurements

| Gate | Result |
| --- | --- |
| Frozen public oracle | Exact SHA-256 `8c37b04cfd7a61eb779ec503bfdf6ff403a25616a4e4fb50566e8875dd366edb`; 8/8 fail on preserved baab source, 8/8 pass on candidate, unchanged assertions. |
| Compiled public graph | 336 tests across 23 suites pass with installed published Marionette/@mnjs/data 5.0.0; private source-only experiment suite excluded. |
| Focused source coverage | 384 tests across 24 suites pass; nine production modules plus private experiment each 100% statements/branches/functions/lines, no exceptions or skips. Totals: 1,900 statements, 1,445 branches, 410 functions, 1,449 lines. |
| Isolated artifact consumer | All 11 stages pass; 24 JSDOM cases comprise nine helper cases, seven unchanged independent application cases and eight frozen nested cases. No source aliases or workspace links. |
| ESM/CJS runtime | Unchanged owner fixture passes six nested and twenty schema/composed lifecycle cycles, keyed rows, schema/view registrations and normalization checks. |
| Strict declarations | Helper consumers and unchanged ESM/CJS row fixtures pass without skipLibCheck. |
| Browser | Nine helper cases and unchanged FLOW-NESTED native two-level journey pass in existing Chromium 154.0.8037.57; focused Vite 8.3.3 nested example build passes. |

Node 24.19.0, npm 11.17.0, Vitest/Browser/coverage-v8 5.0.3, Playwright 1.63.0,
JSDOM 30.1.2 and exact FormKit 2.1.2. The isolated generated dependency lock is
retained and repeated by npm ci in the attempt. It does not freeze future
transitive registry resolution.

The original composed browser fixture and other example pages were absent from
this source-only delta. The full transferred test file and nested example were
kept unchanged; only FLOW-NESTED was selected. Local glue exports public Core
getNode, with explicit focused Vite and Playwright configuration. First harness
attempt selected no tests and warned about an input path. A corrected attempt
then failed the registry lookup. Adding the lazily imported Core entry to initial
optimization made the unchanged native test pass. Both failed attempts remain
preserved; no failed assertion was removed. A prebundle instance/reload explanation
is an inference, not a proved runtime defect. Vite documents dependency scanning
and explicit includes in its [optimization options](https://vite.dev/config/dep-optimization-options).

Independent static runtime review found no new supported-workflow defect. The
cached foreign-form guard and lineage/default retirement regressions were retained.
Retirement now scans retained baseline/exclusion records by ancestor keys; only the
measured two-level scope is claimed. The helper has no new runtime behavior.

## Retained evidence and limits

Verified source, scoped configuration, captured dependency lock, per-suite hashes,
actual per-file coverage and source/artifact manifests are retained at
`/workspace/scratch/mnjs-formkit-nested-build-11a3f830/`.
`nested-focused-replay-report.json` binds the focused runs; the final isolated
consumer report, logs, lock and executed configuration bodies are retained at
`/workspace/scratch/mnjs-formkit-nested-consumer-core-entry/`.
The executable private replay harness is
`/workspace/scratch/verify-nested-formkit-consumer.mjs`. Transfer receipt is
`/workspace/scratch/mnjs-formkit-nested-inline/consumer-receipt.json`.

This is a current focused stable-v5 consumer checkpoint, not the historical
2,491-test/169-file checkout result, full example browser inventory or arbitrary
depth certificate. Pinned browser/Cypress availability, Firefox/WebKit/AT, licensed
Pro, customer hosts and existing strict File/shared-Vue investigations remain
outside the measured gate. Website remains unchanged with its previously recorded
MCP timeout. No publication, push, PR, merge, deployment or customer source.
