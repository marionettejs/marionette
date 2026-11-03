# Pro interaction repair — 2026-11-03

Tested source: `8f78cea2ae614f2676918266e46c583f39cc541d` on
`codex/formkit-adapter-repair-20261026`, repository `marionettejs/marionette`.
The evidence commit following this source revision adds receipts only.

## Scope and failure-first evidence

The separate authorized vault QA task reported two failures with actual Pro
0.130.2 controls at `4176ab070ee66989833dc4d6d75e2b74731a2dbe`:
repeater rendering overflowed the stack, and pointer reopening of a selected
datepicker failed while Enter worked. The writer reproduced both underlying
native adapter mechanisms using public APIs without executing licensed controls.

1. A custom group forwarding `$slots.default` reproduced the same
   `RangeError: Maximum call stack size exceeded` through FormKit
   `parseLogicals`, `evaluate`, `compile`, and adapter `schema.ts:59`.
   This ran before the source repair at `4176ab07`; see `slot-red.log`.
   Receiving context overwrote the lexical slot map, selecting the same slot
   recursively. The repair retains lexical slot bindings while supplying ordinary
   receiving-node context and loop data. Caller-provided root slots and explicit
   application overrides remain available. Four permanent runtime cases cover
   default/named forwarding, root bindings, removal, editable list rows,
   replacement and reset; packed ESM/CommonJS consumers exercise row forwarding.
2. A real Chromium pointer test focused an input, then clicked a sibling SVG
   icon. Blur queued a schema update before pointer-up. The button stayed mounted,
   but comparing serialized `innerHTML` against self-closing authored SVG caused
   its SVG descendant to be replaced: **0 clicks, 1 blur, retained=false**.
   The test ran with repository head `d15c5627`, distribution built at `ec56f38b`;
   their production source is identical. See `icon-pointer-red.log` and the
   extracted interaction record in `verification.json`.
   The repair compares authored markup with the last applied markup, resetting
   that record when the binding is removed. The browser now verifies three
   consecutive successful pointer activations with the original SVG retained.
   A unit regression verifies changed markup, removal/re-addition, and null.
   Unchanged trusted HTML bindings retain their subtree, including imperative
   descendant changes; this behavior is documented.

The coordinator subsequently reported an independent actual Pro baseline trace
using consumer `4176ab07` and helper `d15c5627`, plus a retained-SVG observation:
the SVG disconnected 6 ms after pointer-down while the original button remained
connected and retained identity. That timing is a coordinator-reported supplemental
measurement; the older helper alone does not track SVG subtree removals. The writer
has not inspected the raw vault instrumentation.
No click followed; the picker stayed closed after 1.8 seconds, and Enter reopened
it. The trace omitted sensitive data and passed its credential scan. This
corroborates the cause on actual Pro; repaired-control acceptance remains pending.

The standalone `test/fixtures/formkit-pro/trace-datepicker.mjs` helper observes
expanded state, pointer/focus events, original-button and pointer-target
connectivity, and icon-subtree mutations. It reads no key, field values, text,
or URLs. `stop()` removes its subscriptions and observer. It is available for
independent vault QA; it does not bootstrap Pro or certify license validation.

## Independent review

Two independent Astra reviewers, `repeater_diagnosis` and
`datepicker_diagnosis`, cleared the final source changes and focused tests.
Their first review caught a lost root-slot fallback; a public regression failed
against that intermediate change, then passed after the explicit lexical fallback
was added. Both reviewed the SVG cache lifetime and trusted-HTML boundary.
One independently checked the exact published calendar SVG with the public
renderer: the original 665-character SVG serializes to 689 characters, and the
repaired renderer retains it on an unchanged update. These were source and
public native-API reviews, not independent live Pro QA.

## Verification and limits

All **436 unit tests**, the **full build and type checks**, isolated **packed
ESM/CommonJS runtime and declaration checks**, and **15 Chromium tests** passed.
Final check results, artifact hashes and source hashes are in `verification.json`.
Logs preserve the commands' actual results with trailing whitespace normalized;
`rawSha256` identifies the original local logs. The toolchain is Node 24.19.0,
npm 11.17.0, Vitest 5.0.3, Playwright 1.63.0, installed Chromium 154.0.8037.57,
FormKit core 2.1.2 and @mnjs/formkit 5.0.0-rc.2.

Commands from the repository root:

```sh
node_modules/.bin/vitest run test/unit/formkit*.spec.js --maxWorkers=2
npm_config_cache=/tmp/formkit-npm-cache npx --yes npm@11.17.0 run build
npm_config_cache=/tmp/formkit-npm-cache npx --yes npm@11.17.0 run test:formkit-package
MNJS_TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm_config_cache=/tmp/formkit-npm-cache npx --yes npm@11.17.0 exec -- playwright test --config test/formkit/playwright.config.mjs --project chromium
```

GitHub returned no commit statuses or Actions runs for source `8f78cea2`. The
repository CI triggers on master pushes and pull requests; no hosted CI pass is
claimed for this branch, and no workflow was manually dispatched.

The actual Pro repeater/full fixture and datepicker still require separate vault
QA on this revision. Its development project key stayed in that environment;
no credentials, premium registration bypass, or private consumer source were
used by the writer. The earlier vault result (72/75 assertions) belongs to the
parent's baseline report, not this revision. A blocked runtime network request
means that successful bootstrap or interaction alone does not establish online
license validation. This receipt does not certify all Pro inputs, full Vue/React
parity, Firefox/WebKit, mobile Pro behavior, or performance.

No PR was created or retried; the earlier PR denial remains in force. No merge,
release, npm publication, deployment, security change, or Mac test occurred.
