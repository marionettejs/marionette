# Verification and limits

## Source identity

- Commit: `b6f23c5953793d5cef1cb51dbc675420214ffd01`.
- Package version in the checkout: `5.0.0-rc.2`.
- Node: `v24.19.0`.
- Relevant source, direct unit tests, package metadata, and Vitest configuration were unchanged from that commit when inspected.
- Existing staged documentation removals and user changes were preserved. No old/current/generated documentation or documentation fixtures were read.

## Checks executed during Stage 1

The first command passed **229 tests in 12 files**:

```sh
npm test -- test/unit/application-preparation.spec.js test/unit/application-lifecycle.spec.js test/unit/application-child-lifecycle.spec.js test/unit/application-root-view.spec.js test/unit/application-ownership.spec.js test/unit/application-state.spec.js test/unit/application-state-events.spec.js test/unit/state-owner.spec.js test/unit/runtime/state-api.spec.js test/unit/region-lifecycle.spec.js test/unit/region-adoption.spec.js test/unit/collection-view/collection-view-lifecycle.spec.js
```

The source review then identified specific rendering and collection identity claims needing these additional checks. They passed **250 tests in 5 files**:

```sh
npm test -- test/unit/view.child-views.spec.js test/unit/collection-view/collection-view-reconciliation.spec.js test/unit/collection-view/collection-view-children.spec.js test/unit/mixins/view.spec.js test/unit/view-ownership.spec.js
```

Before Claude review: **479 passing tests across 17 distinct suites**. Logs: `evidence/verification-results.txt`. Vitest aliases resolve framework and workspace package imports to source.

A focused source-level probe filled a gap in the existing test assertions:

```sh
node planning/docs-v5/probes/readiness-probe.mjs .
```

Passed: completed-start preparation signal stays un-aborted after stop and destroy; pending-start preparation is aborted by stop, its start resolves false, and it cannot activate after late preparation completion. The probe redirects workspace imports to source, rather than relying on previously built distribution files. Result: `evidence/verification-results.txt`.

## Review-driven verification

Claude identified additional claims and integration choices to verify. This command passed **63 tests in 3 additional files**:

```sh
npm test -- test/unit/application-prepared-view.spec.js test/unit/application-start-region.spec.js test/unit/backbone-adapter.spec.js
```

Total existing-unit coverage executed during Stage 1: **542 passing tests across 20 distinct suites**. The added checks validate prepared roots, start-time Region binding, and the available Backbone adapter. Log: `evidence/verification-results.txt`.

A second source-level probe ran successfully:

```sh
node planning/docs-v5/probes/composition-probe.mjs .
```

It verifies the selected visible-shell/required-child startup order, parent stop during pending child preparation, explicit required-child failure cleanup, and `prepareStart` returning false as result data rather than a startup veto. Log: `evidence/verification-results.txt`. This probe uses JSDOM and source aliases; it is not a browser E2E test or the future consumer teaching example.

## What this establishes

These checks establish specific API behavior used by the brief and rubric. They do not validate the architecture of the test applications, helpers, probes, or future teaching example. The application recommendations require a separate design assessment against feature requirements, ownership, lifecycle, and a follow-up change. Test quantity is not evidence of architectural quality. The source notes include additional inspected tests that were not executed; only the commands above count as fresh execution evidence.

## What remains unverified

No runnable teaching slice, installed-package discovery test, deliberate-defect evaluation harness, browser E2E check, or independent agent effectiveness run has been built or executed in this stage. JSDOM tests do not prove browser focus behavior. No claims about learning improvement, success rates, or generalization follow from these checks.

The first slice proposes an Application-owned current refresh controller. The user selected `@mnjs/data` for state and collections; the scaffold will configure its StateApi and DataApi. The request policy in `slice-decisions.md` remains untested end to end until the runnable slice. Renderer/build/test dependency pinning remains next-stage work. Stage 1 does not implement or propose new framework APIs.

## Repository transfer

The files were initially authored and reviewed in a temporary directory. They are now stored here with portable probe commands. The 542-unit-test result above is retained execution evidence from Stage 1, not a rerun during the file transfer. Existing staged deletions and other user edits remain unchanged.

After transfer, both portable probe commands above were executed successfully from the repository root. Markdown index links, excluded-name checks, JSON parsing, and source hashes were also checked.

The `@mnjs/data` selection was confirmed against its current exports and API implementation. No runtime tests were rerun for this documentation preference change. Historical Backbone test results above remain historical checks, not evidence for choosing the first example’s data implementation.
