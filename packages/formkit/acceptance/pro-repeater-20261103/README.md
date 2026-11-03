# Repeater update-loop repair — 2026-11-03

Tested source: `1d8e1680f416ea182873c9120315ec24970225c9` on
`codex/formkit-adapter-repair-20261026`, repository `marionettejs/marionette`.
Evidence commits after that revision change receipts only. This continues the earlier
interaction repair; it does not replace its versioned evidence.

## Actual Pro baseline and scope

The coordinator's separate vault QA on `8f78cea2` reported **71 passing assertions
across six isolated controls**, including **12/12 datepicker assertions** and
pointer reopening with retained SVG identity. The isolated repeater missed its
10-second readiness limit, and the full fixture missed DOMContentLoaded after
15 seconds with approximately 100% renderer CPU and no page exception. Repeater
interaction and lifecycle acceptance remained unverified.

The coordinator additionally reported a bounded CPU profile: 2,178 samples over
2.496 seconds, with overlapping inclusive stacks through renderer update (87.0%),
reconciliation (86.5%), expression evaluation (48.0%) and Core compilation (29.4%).
This supports repeated rendering but does not independently identify its trigger.
The writer did not inspect raw vault instrumentation or access its project key.

## Failure-first proof and repair

Public native fixtures reproduced the cause without importing or executing Pro:

- An ignored button directly inside a synchronized list was created **28 times**
  during a bounded microtask drain; one stable control was expected.
- An explicitly indexed ignored control repeatedly displaced a real row, causing
  **27 row creations** instead of one.
- The browser fixture mounted the same public native structure and could not
  reach its first timer; Playwright timed out after 10 seconds. It used the
  existing distribution built at `8f78cea2`, before rebuilding the repair.
- Independent review found an adjacent recovery case: after public Core node
  destruction and refresh, an ignored input without an explicit value displayed
  `[object Object]` containing a real row's value. This failed against the first
  attachment-only guard, then passed after the value fallback was corrected.

Official button initialization makes the node ignored and parentless. The native
adapter nevertheless treated it as a missing list attachment, destroyed and
recreated it, then wrote the unchanged list snapshot back. That write scheduled
another render. The repair uses the effective `node.props.ignore` in two places:
ignored controls neither participate in synchronized-row attachment recovery nor
inherit a row's value when recreated. Normal row recovery, including existing
nonsynchronized-list value fallback, remains intact.

Three public unit regressions cover creation count, retained control/row identity,
canonical values, explicit index, and destroyed-node recreation. Packed ESM and
CommonJS consumers now exercise an ignored Add action with generated callbacks.
The native Chromium journey verifies timer readiness, append/edit/remove,
controlled replacement, reset, exactly one retained Add action, and teardown.
These are native fixtures. The subsequent actual Pro retest is recorded below.

## Independent actual Pro retest

The coordinator reported independent vault QA on exact source
`1d8e1680f416ea182873c9120315ec24970225c9`: **107/107 assertions passed**, with
**zero page errors and zero timeouts**. The repeater passed **12/12**, including
add/edit/remove, controlled replacement, reset, disabled state, submission,
server errors and destruction. The full seven-control form became ready in
**649 ms**, and its combined journey passed **21/21**. All six other isolated
controls passed, including datepicker pointer reopening and retained SVG identity.

Versions: Core **2.1.2**, Pro **0.130.2**, adapter **5.0.0-rc.2**, Chromium
**154.0.8037.57**. The credential scan passed. These results come from the
separate vault QA task, as relayed by the coordinator; the writer did not rerun
Pro or inspect the raw vault artifacts. No key or private field values are
included in this report. The readiness timing is one observed run, not a benchmark.

This establishes acceptance for the tested local development bootstrap and
control journeys. **Online license validation remains unverified** because its
request failed with `net::ERR_TUNNEL_CONNECTION_FAILED`. Successful local
rendering and interactions do not establish successful network validation.

## Review and verification

Both independent Astra reviewers, `repeater_diagnosis` and
`datepicker_diagnosis`, cleared the final two-condition source repair and tests.
The second reviewer independently verified that destroyed ignored inputs recover
blank without replacing the real row or altering canonical values.

Final **439/439 serial unit tests**, **full build/type checks**, **packed ESM/CommonJS
checks**, and **16/16 Chromium tests** passed.
Final results, source/artifact hashes and interaction records are in
`verification.json`. Logs preserve command results with trailing whitespace
normalized; `rawSha256` identifies the original local logs.

An initial full unit run, concurrent with the build, passed 438 tests but timed
out one existing nested-row test at its unchanged five-second limit. The focused
rerun passed in 1.248 seconds. The final full run is serial and retains the same
timeouts. Both the initial failure and retest evidence are preserved.

Toolchain: Node 24.19.0, npm 11.17.0, Vitest 5.0.3, Playwright 1.63.0,
installed Chromium 154.0.8037.57, Core 2.1.2, adapter 5.0.0-rc.2.

```sh
node_modules/.bin/vitest run test/unit/formkit*.spec.js --maxWorkers=1
npm_config_cache=/tmp/formkit-npm-cache npx --yes npm@11.17.0 run build
npm_config_cache=/tmp/formkit-npm-cache npx --yes npm@11.17.0 run test:formkit-package
MNJS_TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm_config_cache=/tmp/formkit-npm-cache npx --yes npm@11.17.0 exec -- playwright test --config test/formkit/playwright.config.mjs --project chromium
```

The bounded actual Pro 0.130.2 repeater/full-fixture retest passed. No full
Pro/Vue/React parity, online license validation, performance improvement,
Firefox/WebKit or mobile Pro certification is claimed. No credential, licensing,
security, core/router, PR, merge, release, deployment or Mac-test action occurred.
The prior PR-creation denial remains respected.
