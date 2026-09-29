# Radio, onboarding, and validation migration

2026-09-30; working tree based on `59a62504f04270392cc1eb905595644fc04917d6`.
This follows [delivery and native data](delivery-data-results.md). Three parallel
tracks had separate file ownership; package generation and final integration
checks ran serially. No runtime/declaration implementation changed.

## Delivered

- [Radio reference](../../docs/packages/radio.md): registry scope, complete event
  and request/reply entrypoints, cleanup, logging, exports, and types. Core owner
  bindings remain in their shared reference. Navigation, agent routes, package
  README, and executable checks point to that canonical page.
- [Onboarding](../../docs/quick-start.md): concrete source-to-tarball instructions
  and a first UI without optional data. Default runtime configuration precedes
  isolation. Generic provider contracts stay in core; native provider details
  belong to the optional data package. Redundant renderer configuration is removed.
- Contract validation now targets current headings and generates only maintainer
  metadata. All source signatures, diagnostics, event mappings, and existing test
  anchors remain checked. Two inaccurate Region statements were corrected against
  source and existing tests: allowed missing targets can make `show()` return
  `undefined`; an empty live Region can still clear unmanaged contents.
- Coverage statuses report **34 documented / 22 partial semantic groups**. These
  dispositions account for the old profiles; they are not API completeness
  percentages. The second audit reduced the initial documented count instead of
  filling every historical edge case into consumer prose.
- Eighteen fixtures tied to removed samples were retired with explicit
  [dispositions](evidence/legacy-docs-fixture-migration.md). Current package
  discovery and first-UI fixtures now execute installed documentation. Independent
  native [browser checks](evidence/legacy-docs-browser-migration.md) preserve
  interaction, form delegation, and iframe behavior. There are 27 remaining
  registered installed fixtures; this slice did not run all 27.

## Verification

| Check | Result and limit |
| --- | --- |
| `npm run build` | Passed, including package/declaration builds and documentation staging. |
| `npm run test:unit` | 2,125 tests passed in 138 files. |
| `npm run test:tooling` | 380 tests passed; full run preceded final review wording and additional example assertions. Relevant checks were rerun afterward. |
| `npm run check:api-contracts`; `node --test test/tooling/api-contracts.test.mjs` | Passed; 10 tests include drift mutations and invalid/missing coverage states. Separate existing Region suites passed 31 tests. |
| `npm run docs:check` | Passed: 24 actual reference/setup fences, 20 declaration fixtures, 9 TypeScript examples, 22 packaged pages, 68 HTML files and 839 internal links; manifest integrity and fresh consumer discovery verified. |
| Migrated `docs-package` and `docs-quick-start` installed fixtures | Passed against local candidate tarballs. Discovery checked 314 packaged relative links. First UI verified render, replacement, destruction and absence of optional data. Exact artifact reports are linked below. |
| Quick-start shell/build smoke | Passed actual package/install/init/configuration commands and Vite build in a fresh consumer; optional data installed separately. Root `npm ci` was not rerun in this dirty checkout. Source acquisition requires the checkout containing these docs. |
| Browser migration | 39 checks passed: 13 cases across Chromium, Firefox and WebKit. This is a focused selection, not the full browser suite. |
| `npm run lint:ci`; workflow, release-profile and browser-profile checks | Passed. Generated example/fixture `dist` directories are excluded from lint; three pre-existing shadowed callback names in documentation probes were renamed. |
| `npm run check:public-tests` | **Fails** on 24 private-member references in unchanged `test/unit/destroy-listener-cleanup.spec.js`. Runtime tests pass, but this policy failure still prevents a clean whole-repository verification claim. |

Evidence: [installed documentation](evidence/validation-radio-installed-package.json),
[package fixture](evidence/docs-package-migration.json),
[first UI fixture](evidence/docs-quick-start-migration.json),
[browser package identities](evidence/validation-radio-browser-candidate.json),
and [Radio member audit](evidence/radio-reference-audit.md).

The installed runner executes ESM and CommonJS Radio identity checks, reset
argument behavior, representative registry forwarding, all current reference
fences, and the setup guide's actual JavaScript. Site link validation includes
anchors. The standalone fixture's relative-file link check is not represented as
an anchor check.

## Claude review and disposition

The [bounded review](evidence/validation-radio-claude-review.json) received the
current Radio/onboarding pages, validation approach, migration dispositions,
selected checker/fixture code, goals and known gaps. It did not receive the whole
repository or every existing test. Verdict: **accept with changes**, with no
release-readiness claim.

Applied: removed internal renderer-member inspection advice; broadened StateApi
wording to all state owners; made errors/diagnostics gaps visible; clarified
submit-event cancellation; updated actual migration results; distinguished
product integration gaps from retired teaching samples. Added installed CJS/ESM
Radio identity/reset/forwarding assertions and execution of setup-guide fences.
Removed an unnecessary exact command-count assertion while retaining required
lookup-mode checks.

Some concerns were missing review context: quick-start installation/build had
already run, site links already checked anchors, invalid coverage states already
had mutation tests, and the plan/results were being updated concurrently. Those
were verified against evidence rather than accepted as new failures. Final fixes
were checked locally; Claude did not review the revised final artifact.

## Strengths, limits, and next work

**Strengths:** supported contracts are easier to find without the records lesson;
package boundaries match optional ownership; the ordinary installed path is
exercised; tests now identify the behavior they actually prove. Validation no
longer depends on restoring retired examples. The existing peer-informed
reference/guide separation remains; no new peer runtime ranking was performed.

**Limits:** this does not demonstrate better independent reader outcomes. Full
release validation, live website import/publication, exact-symbol retrieval,
utilities, errors, adapters, TypeScript, and several practical guides remain
unfinished. A successful metadata check permits explicit documentation gaps.

External-host/managed-Lit composition and combined list subscription accounting
remain integration verification gaps independent of writing a guide. Routing
history combinations need consumer evidence when claimed. Removed custom save,
refresh, pagination, and widget samples contribute no current acceptance credit.

Next: close the independent integration gaps and existing public-test policy
failure; complete utilities/errors and consumer-tooling instructions; then add
small guides for local editing, retained refresh and existing markup. Verify each
against installed packages. Resume reserved independent lookup/build/extension
checks once their required contracts are present; do not tune these docs to an
exposed benchmark or expand the records lesson to cover every task.
