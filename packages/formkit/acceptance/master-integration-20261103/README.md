# Master integration and Pro 0.130.3 compatibility — 2026-11-03

The scoped FormKit integration is published on
`codex/formkit-master-integration-20261103`. This receipt is evidence of the
checks below, not release readiness or full Pro/Vue/React parity.

## Source attribution

- Integration base: master `c83a9f255692291eb62dc05a6d4073424afb7dfe`.
- Integrated source: `ad08f4b6008e15cbb931503f11adf6e3590737ee`.
- Pro 0.130.3 fixture/assessment: `605f1f1aaccb63f9195f15e26f64e8f1d00f409c`.
  This commit changes no production module or root dependency.
- Focus-order test follow-up: `8c70a88dff4b59e423774c7540bc5719d8273c53`;
  two new public cases, no production changes.
- Preserved original repair: `16aa74fe1160c15e0a3121839e4ab9e576d0c19d` on
  `codex/formkit-adapter-repair-20261026`.
- The integration initially retained all nine adapter modules and 27 unit suites
  byte-for-byte. The follow-up adds two cases to one suite; adapter source stays unchanged.
  Master's shared runtime, helper 0.2.0 and other package source remain unchanged.
  See [source hashes](source-receipt.json).
- Remote master subsequently advanced to
  `09990a586cbef59f0c268bd075af7f55c18c3888`: three commits affecting only
  Dependabot and two unrelated consumer fixtures. Those changes are not included
  in this tested base. No conflicting FormKit/runtime edits were identified.

The artifact commit containing this directory is later than the tested revisions.
Receipts retain their actual source SHAs; they do not automatically certify later
source or dependency changes. [manifest.json](manifest.json) hashes each retained
artifact other than itself.

## Executed checks

| Check | Result and exact scope |
| --- | --- |
| Full serial units, `ad08f4b6` | 2,737 passed plus one intentional expected failure, 182 files; includes 439 FormKit assertions in 27 suites. The expected failure verifies helper cleanup. |
| Build, declarations and public contracts, `ad08f4b6` | Full build, source/dist consumers, strict declarations, API inventory, zero-warning lint, package ownership, diagnostics and workflow checks passed. All nine preexisting API entrypoints remain unchanged. |
| Packed adapter, `ad08f4b6` | Clean isolated install, repeat locked install, ESM/CommonJS runtime and strict type consumers passed. [Report](packed-report.json) records artifacts and hashes. |
| Current helper integration, `ad08f4b6` | Both the master helper consumer and helper/FormKit consumer passed, using helper 0.2.0. |
| Native browser, `ad08f4b6` | 16/16 Chromium tests; no skipped, unexpected or flaky tests. Includes mounted placement, keyboard/invalid focus, hidden ancestors, grouped/nested rows, pending submission, ignored repeater actions and pointer-target retention. [Report](browser-report.json), [portable attachments](browser-artifacts/). |
| Documentation, `ad08f4b6` | 57 executable recipes, 20 declaration fixtures, seven export tests, 89 built pages, 90 checked HTML files/1,193 internal links, and 45 packaged consumer pages passed. Installed-package stage passed on an isolated retry with its unchanged 120-second wrapper limit. |
| Affected tooling, `ad08f4b6` | 32 API/public-test-boundary tests passed. This is not a full tooling-coverage receipt. |
| Pro dependency compatibility, `605f1f1a` | Fresh Pro 0.130.3/Core 2.1.2 native consumer, locked reinstall, no Vue packages, direct Node ESM/CommonJS imports and Vite build passed. [Receipt](pro-01303/receipt.json), [lock](pro-01303/package-lock.json). |
| Native comparison collector, `605f1f1a` | 14/14 core checks passed, with no page/runtime errors. Includes two actual `requestSubmit()` attempts producing one pending callback. Collector exit 1 correctly records the missing-key Pro bootstrap. No actual Pro control was rendered. [Receipt and screenshots](pro-01303/browser/). |

Runtime: Node 24.19.0, npm 11.17.0, Vitest 5.0.5, JSDOM 30.1.3,
TypeScript 6.0.3, Rollup 4.67.2, Playwright 1.64.1 and installed cloud
Chromium 154.0.8037.57. The release browser profile's Chromium 156, Firefox 157
and WebKit 27.2 were not executed. No browser was downloaded or Mac used.

The adapter tarball SHA-256 is
`d4d0d2fcf1dffe0bcf76556f1d9781b71fef50db0dfc97e59b57dba5e1a4acac`
in both the packed adapter test and Pro 0.130.3 consumer. The Marionette archive
hash differs between those runs because packaged documentation metadata was
refreshed for `605f1f1a`; shared production source did not change.

## Retained failures and incomplete gates

Initial parallel FormKit execution passed 434 assertions and timed out five;
serial uninstrumented execution then passed all assertions with unchanged
timeouts. Initial installed-documentation execution timed out in its 120-second
wrapper; the isolated retry passed unchanged. Logs retain both outcomes.

Full V8 coverage is **not cleared**. The first serial instrumented run timed out
three nested-row cases and one existing jQuery case. A focused instrumented run
passed all eight nested-row and ten jQuery assertions but, as a partial suite,
failed the full-repository coverage thresholds. It does not cover SCHEMA-01.
The subsequent full run and metrics are recorded in
[coverage-result.json](coverage-result.json) and
[the complete log](logs/coverage-retry.log). No timeout, threshold or coverage
exception was relaxed. Passing uninstrumented assertions does not prove the
cause of instrumented timeouts or certify production performance.

The full retry passed 2,732 assertions plus one expected failure and timed out
five (four nested-row cases and SCHEMA-01). Its one additional uncovered branch
was DOM-order comparison for invalid controls. The focused follow-up adds two
public cases for external Regions created in either document order. All 20
hardening cases pass under V8 coverage, including both comparator outcomes.
The partial run still exits 1 against full-repository thresholds; it does not
clear the full coverage gate. See [focus-order-result.json](focus-order-result.json).

No hosted Actions runs existed for `605f1f1a` when checked. PR creation remains
previously denied and was not retried. No merge, release or npm publication was
performed.

## Review findings and Pro boundary

Two independent Astra tracks reviewed source/integration and evidence. They
cleared the bounded source and historical-evidence corrections, retaining the
execution limits above. Reviewers inspected artifacts/source and screenshot
pixels; this was not independent live browser QA. Details of the supplied review
categories and findings are in [review-findings.json](review-findings.json).
The full external Claude review was unavailable; only the coordinator's listed
categories were evaluated. No speculative performance refactor was made.

The [release assessment](../PRO-01303.md) records the verified upstream bundle
changes: active-option scrolling and popover resize handling. No undeclared Vue
import remains in either 0.130.2 or 0.130.3. Prior new-integration 0.130.2 import
and build evidence is preserved in [pro-01302/](pro-01302/).

Actual Pro 0.130.3 controls on this integrated runtime remain **pending separate
authorized vault QA**. This writer environment has no `FORMKIT` binding. The
existing approved key must stay in that isolated environment; no new key or
production-license purchase is required. The fixture contains no credential.
Run the seven-control journey plus the release-specific scrolling/resize checks
described in the [fixture instructions](../../../../test/fixtures/formkit-pro/README.md).

The historical independent 107/107 actual-Pro result applies only to source
`1d8e1680f416ea182873c9120315ec24970225c9`, Core 2.1.2 and Pro 0.130.2.
It does not certify this master integration or Pro 0.130.3. Online license
validation was unverified there because of `net::ERR_TUNNEL_CONNECTION_FAILED`.
No new network-validation result, full parity, all-control, performance or private
customer-application certification is asserted here.
