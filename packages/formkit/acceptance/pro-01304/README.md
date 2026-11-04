# Pro 0.130.4 compatibility preparation — 2026-11-04

The tested fixture source is `665df3084ef674be59f953889ea9d47a93467658`, on
`codex/formkit-master-integration-20261103`. Adapter production source is
byte-for-byte unchanged from `b557f86b9804143628345b4069504d142fec33e1`.
Later documentation/evidence commits do not change the source attributed to
these executions. This receipt does not certify actual Pro 0.130.4 controls.

## Published release evidence

`verified-archives.json` records exact tarball URLs, SHA-512 integrity, SHA-1 and
SHA-256 for Pro 0.130.3/0.130.4 and drag-and-drop 0.5.3/0.6.3. All four archives
matched registry metadata. File ledgers record every package file. Four of Pro's
35 files change; CSS and control subdirectories do not. Static imports remain
framework-neutral. The new drag-and-drop range is ^0.6.3; Core/inputs/utils peers
remain ^2.0.0. The fixture intentionally retains exact 2.1.2 rather than upgrading
Core based on the live documentation badge.

The declaration and manifest diffs are retained. No full vendor bundle or
proprietary customer source is republished. The source assessment is
[PRO-01304.md](../PRO-01304.md). Public git-head lookup returned 404, so unavailable
repository history is not used as behavioral evidence.

## Clean installed checks

`validation/receipt.json` records the canonical Node 24.19.0/npm 11.17.0 run:
full build/declarations/documentation packaging, public-test boundary check,
and independent native/Vue/React preparations all passed. Each consumer has
its own exact lock, successful locked reinstall, root Pro ESM/CommonJS imports,
strict TypeScript 6.0.3 declarations and Vite 8.3.0 production build.
The native fixture uses freshly packed local Marionette/FormKit artifacts.
All Core-family packages, including nested runtime copies, resolve to 2.1.2;
Pro resolves to 0.130.4 and drag-and-drop to 0.6.3. Native and React
contain no Vue or @formkit/vue packages. The Vue reference intentionally contains
Vue 3.5.44; React uses 19.2.0. Their preparation is not a browser comparison.

A preliminary successful run used npm 11.9.0 because the preceding session's
pinned npm lived in /tmp and was absent after environment restart. It is retained
under `preliminary-npm11.9/` and is not treated as the canonical toolchain result.
After explicitly preparing npm 11.17.0, all stages were repeated on the same clean
source; the driver checks exact Node/npm before running. No repository configuration
was weakened or changed to accommodate the default toolchain.

A second preparation at clean `411ae68a`, using npm 11.17.0, exposed a separate
reference-graph problem: Vue/React wrapper ranges admitted several FormKit 2.2.1
packages and nested Core copies, despite root Core/Themes remaining 2.1.2. Native
was already consistent. These passing-but-mixed preparations are preserved under
`mixed-reference-graph/`; they are not treated as equivalent 2.1.2 comparisons.
`runtime-graph-red.json` records 13 mismatches per reference. The follow-up pins
every declared FormKit sibling used by the reference wrappers and rejects any
nested runtime version other than 2.1.2. No npm override or Core upgrade is used.
Fresh preparation of the corrected graph is separately recorded at 665df308.
`validation/runtime-graph-green.json` retains the corrected maps: eight native
and ten packages per reference, all 2.1.2, with no nested mismatches. Independent
Astra re-review confirmed every prior mismatch was resolved.

## Browser boundary and regression targets

The native keyless collector and release collector use installed cloud Chromium
154.0.8037.57 and Playwright 1.64.1. No browser download or Mac browser was used.
The normal collector checks the native core fixture and records blocked Pro
bootstrap. The release collector must report blocked bootstrap and zero cases
when no approved project key is present; this cannot be called Pro acceptance.
Final numeric outcomes and exit statuses are in the execution receipt.

The opt-in `?mode=pro&scenario=release-01304` fixture covers the five upstream
release targets in eight grouped checks: currency presentation/precision and
edit/replacement/reset; live mask presentation without model replay; selected
labels when options arrive late; real duplicate-row dragging before and after
replacement; transfer-list target search without option serialization; and
public submission/reset/destruction. Public node props and state are used.
No synthetic move-up/down operation substitutes for a drag. The collector checks
selected label presentation, not text elsewhere in the option list.

Independent Astra source review first caught four harness problems—an incorrect
multi-select matcher, an incorrect target-list ID, an overbroad label assertion
and an unbounded settlement await. All four were corrected before the clean
fixture commit. Source re-review found no remaining publication-blocking issue.
This static review does not establish that the new collector's positive paths
or actual Pro behavior pass. Those require the authorized vault QA run.

## Preserved earlier evidence and next step

`baseline-01303-coverage/` retains the exact b557 canonical coverage rerun:
2,740 tests plus one expected failure, all 182 files and existing thresholds passed.
The earlier successful run and subsequent timeout remain in the preceding
coverage receipt; the new pass does not prove those intermittent timings absent.
`baseline-01303-vault-report.json` is explicitly coordinator-reported evidence:
137/137 on Pro 0.130.3 with the permanent base/Pro Genesis imports. It is not a
writer execution or a Pro 0.130.4 result. Online license validation remained
unverified, and direct Destroy-button reachability under an open panel was not
established; public-bridge teardown passed.

The existing authorized vault QA should rebuild/prepare this published fixture
revision with its approved bootstrap, retain the prior 107+30 assertions, and run
`capture-release-01304.mjs <output> <actual-port> native` (and a separately prepared
reference stack when diagnosing a mismatch). Capture exact source/dependencies,
real outcomes and unexpected page errors. No new key, account or security change
is requested. No actual Pro 0.130.4 control, full parity, performance improvement,
online license validation or release readiness is claimed by this receipt.

The native core collector passed **15/15**; Pro bootstrap was blocked, so its
overall exit was **1**. The release collector likewise exited **1**, reporting
blocked bootstrap, **zero executed cases**, and no captured page/runtime errors.
Its eight positive scenarios are pending vault QA. All owned writer browser
contexts and the private fixture server were closed after capture.
