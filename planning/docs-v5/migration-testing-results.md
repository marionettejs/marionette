# Migration and runnable consumer testing

2026-09-30. Slice based on `595fce75`, on `docs/v5-reset`.

## Delivered

- [Migrate from v4](../../docs/guides/migration.md) gives a common upgrade sequence:
  installation, explicit integrations, View/Behavior changes, feature readiness
  and ownership, then behavior checks. Claims use actual v4.1.3 source rather than
  treating v5 prerelease changes as v4 APIs. Existing Backbone consumers can keep
  their persistence through the optional adapter; native data remains optional
  and incomplete for API transport/persistence.
- [Test a consumer application](../../docs/guides/testing.md) supplies a runnable
  four-file recipe with five tests: local editing, Region replacement/cleanup,
  successful readiness/teardown, failed readiness, and superseded startup.
  Its Application uses direct fetch, controlled by test-local mocks.
- Navigation, installed lookup, and canonical agent routes include both guides.
  The multi-file test recipe has a dedicated validator; every JavaScript fence is
  extracted and executed together instead of being treated as independent snippets.

## Verification

`npm run docs:check` checks 31 packaged consumer pages, 37 independent examples,
11 TypeScript examples, 20 declaration fixtures, and seven tooling checks, plus
all five tests from the new recipe. The consumer installation supplies pinned
JSDOM; the validator executes the documented test command with installed framework
imports. A deliberate unmanaged Model subscription fails exactly the replacement
case (four tests pass, one fails); the restored recipe passes again.

The documentation site validates 77 HTML files and 979 internal links. Six agent
retrieval tests pass. Scoped lint and whitespace checks pass. The public contract
inventory remains consistent at 48 documented groups and eight partial groups;
these are not completeness scores. No runtime implementation changed.

The [migration audit](evidence/migration-guide-audit.md) records source backing and
187 passing existing contract tests across eight files. The
[testing audit](evidence/consumer-testing-guide-audit.md) explains its assertions
and why unchanged DOM alone would miss an unmanaged callback. The
[installed report](evidence/migration-testing-installed.json) identifies tested
artifacts. The full runtime and browser suites were not rerun for this slice.

## Claude review and changes

Claude received both guides, the dedicated validator, migration source audit, and
our ownership/verification goals. It found no definite API errors and requested
changes to runtime setup clarity and common migration details. We clarified that
this recipe configures its own classes and that real tests must initialize their
application after the DOM preload. The guide now explicitly names its required
packages, covers `ui`/query and Behavior changes, and identifies the new v5
Application methods. The mutation check now requires exactly one failing test.

We retained the public render spy and explained its purpose: a destroyed View can
ignore a leaked callback without visibly changing DOM. Existing link/install checks
cover those review suggestions. Repeating destruction in a test cleanup remains a
safe fallback if an earlier assertion fails; it does not prescribe double disposal
in application code. The final artifacts were verified after these corrections;
Claude's original review is not a review of the revised artifact.

## Strengths, limits, and next work

The new material addresses two common reader needs independently of the records
lesson. Migration changes have source evidence, and the testing recipe demonstrates
checks that actually reject a cleanup defect. It adds no production injection seam
or compatibility shim.

The migration guide is a common path, not a completed migration of a real consumer
or an exhaustive ledger of specialized overrides. JSDOM does not establish browser
focus, navigation, layout or accessibility. Neither authoring tests nor review prove
reader effectiveness. Those remain separate tasks on a frozen common runtime.

Next reader priorities are practical TypeScript, external hosting/routing,
production behavior, and accessibility/rendering trust boundaries. The coverage
inventory retains those gaps and the unresolved runtime decisions. A controlled
comparison should evaluate independent reader requirements, including tasks where
upstream currently has stronger coverage.
