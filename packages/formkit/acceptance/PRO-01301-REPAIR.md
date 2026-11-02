# Pro 0.130.1 adapter repair round — 2026-11-02

This round addresses the three independent Astra baseline reviews relayed by the
parent. It does not certify full Vue/React, Pro or Upperline TCM parity.
Subsequent parent re-review identified named-registration mounted ordering and
hidden-ancestor invalid-focus gaps. Those require the second repair round; this
receipt records the first round and is not final integration clearance.

Tested packed source: `3a170e5df1e3740bc164c303a2c34d896762e558`, clean when packed.
Production runtime is identical to `1bbe3e3c0ded3aaf54378ad79ca022ba751866eb`.
Baseline: `68ee900f08c3e7b6133a2d5c6ea931eea41709bc`. The original October repair
`c334d311d6886b9a2c976b476f8101192a7a8068` remains in the history.

## Repairs and regression proof

- Pending async rules now detect added root keys. The exact proposed rule captured
  an absent `root.value.other`, then schema added `other: 'bad'`; baseline wrongly
  submitted successfully. The repaired rule reruns and submission is invalid.
  Core's initial insertion of the validating node's own value is accounted for,
  so unchanged initial rules do not issue a redundant request.
- Input `mounted` runs after synchronous placement, once for each surviving node.
  Attached Regions and adopted forms support DOM lookup. Detached Views have their
  own DOM ready and do not reemit on attachment. Removed/replaced/destroyed nodes
  cannot receive a delayed mounted callback. External FieldView and SchemaView
  placement and retained rerenders have permanent regressions.
- Root IDs honor `formProps.id` or the View element's existing ID. Template roots
  now synchronize their DOM ID and emit mounted, allowing public Core `node.submit()`.
- Default submit inputs bind `submitAttrs` as component props. Classes, help,
  raw attributes, live replacements, and pending disabled state reach the official
  input schema. A real repeated submit still calls the native callback once.
- Owner disabled writes during pending submission survive settlement, including
  a repeated `true` write that Core does not emit as a changed prop event.
- Invalid-control focus includes connected owned external Regions in document
  order, skipping disabled, hidden and detached controls.
- Dynamic schema config updates mutate the existing node config. FieldView's
  documented prohibition on replacing config identity is unchanged.

The new cases first failed before source repair. An additional isolated rerun on
unchanged baseline production source with the final test files reproduced
**13 failures / 49 passes** across 62 cases: all 13 targeted regressions failed;
the genuine rejected-submit callback case and 48 older regressions passed.
See [baseline receipt](pro-01301-repair/baseline-red.json) and
[failure output](pro-01301-repair/baseline-red.log).

Final verification on Node 24.19.0 / npm 11.17.0 / FormKit 2.1.2:

- **426 unit tests passed**, Vitest 5.0.3, one worker and unchanged timeouts.
- Full build, generated declarations and declaration consumers passed.
- Packed ESM/CommonJS runtime, types, content and dependency boundaries passed.
  The installed tests cover the new mounted, ID, config/action, repeated-submit
  and external-focus behavior, plus earlier schema/custom-control and row cases.
- Focused ESLint and public-test boundary checks passed.
- **12 existing cloud Chromium tests passed**, Playwright 1.63.0 with installed
  Chromium 154.0.8037.57. No browser download or Mac test was used.

[Verification receipt](pro-01301-repair/verification.json),
[unit output](pro-01301-repair/unit.log), [build output](pro-01301-repair/build.log),
[package receipt](pro-01301-repair/package-report.json), and
[browser output](pro-01301-repair/browser-suite.log) preserve exact details.
The successful unit/build checks ran before commits with matching source bytes;
packed/browser receipts name the clean committed revision.

The first full-suite attempt exposed three initial-rule retries in the first
implementation; the own-value insertion correction resolved them. A concurrent
build/test run subsequently had nine five-second timeouts; the serial final run
passed without increasing timeouts. The initial example browser attempt was
stopped for missing local dependencies; `npm ci --ignore-scripts` supplied them.
The first new packed Core-submit assertion was premature and now awaits the public
invalid event. An isolated baseline run initially lacked generated `src/version.js`;
after supplying that ignored build file, its tests produced the recorded failures.

## Actual packed browser comparison

All three independent consumers installed Pro 0.130.1, captured/reinstalled locks,
imported ESM/CommonJS, and built with Vite 8.3.0. The native and React dependency
graphs contain no Vue packages. Reference frameworks are Vue 3.5.44 and React 19.2.0.
[The browser receipt](pro-01301-repair/receipt.json) includes source revisions,
package/lock hashes, all 42 core checks, and the actual second-submit trace.

| Outcome | Native | Vue/FormKit 2.1.2 | React/FormKit 2.1.2 |
| --- | --- | --- | --- |
| Explicit root ID / registry | Pass | Pass | Pass |
| Mounted lookup in attached host | Pass | Pass | Pass |
| Invalid submit, help and error associations | Pass | Pass | Pass |
| Controlled values retain DOM | Pass | Pass | Pass |
| Local class update and inherited classes | Pass | Pass | Pass |
| Omitted local class section clears stale class | Pass | Stale class retained | Stale class retained |
| Schema config updates existing control | Pass | Pass | Pass |
| `node.props.submitAttrs` replacement reaches component props | Pass | Class update timed out | Pass |
| Disable and restore controls | Pass | Pass | Pass |
| Pending action disabled; repeated programmatic submit suppressed | Disabled, 1 callback | Disabled, 2 callbacks | Disabled, 2 callbacks |
| Resolved callback sets associated server errors | Pass | Pass | Pass |
| 390px page overflow | None | None | None |
| Reset clears errors and restores values | Pass | Pass | Pass |
| Destroy clears registry and owned DOM | Pass | Pass | Pass |

These are route-specific observations, not generalized framework defect claims.
In particular, duplicate submission uses programmatic `requestSubmit()` while the
button is disabled; it is not a second pointer activation. The Vue submit-prop
probe writes the public Core node prop, not a reactive Vue component prop.
No upstream Vue/React fix is included. The comparison's server-error callback
resolves after setting errors; genuinely rejected callback recovery is separately
tested for the native adapter only. Unexpected page/runtime errors now fail the
collector, and none occurred. Its exit status remains **1** for the reference
differences and unavailable Pro bootstrap; it is not an all-parity pass.

Native [desktop](pro-01301-repair/native-core-desktop.png) and
[390px](pro-01301-repair/native-core-mobile.png) screenshots show real controls and
associated errors; the 390px image was also inspected directly. Reference screenshots
are alongside the receipt. The collector closed its own browser after capture.
Private cloud routes were native `localhost:5490`, Vue `:5491`, React `:5492`;
they are not cross-environment preview URLs. Reviewers elsewhere can use the
[portable fixture](../../../test/fixtures/formkit-pro/README.md) and these artifacts.

## Remaining gates

Actual Pro mounting still throws the exact missing-key error from
`createProPlugin(undefined, inputs)` on localhost in all three consumers.
The known historical licensed consumer is customer-forms Upperline TCM, but this
workspace has no confirmed approved bootstrap file or binding. No secrets were
retrieved, no new credentials requested, and no licensing path bypassed. This is
a coverage gap, not a claim that the user must buy anything. All 14 Pro controls,
their keyboard/popover/repeater behavior, and customer-specific integration remain
unverified. Core screenshots cannot establish that coverage.

The three independent baseline reviews drove this repair round. The supplemental
Astra source re-review of exact `3a170e5` against `68ee900f` found no confirmed
must-fix issue. It was read-only, without independent execution or browser use.
It raised one unverified candidate: a pre-submit `submitAttrs.disabled: false`
could defeat pending disabling. The writer's focused [browser probe](pro-01301-repair/submit-override.json)
set that public prop before submitting and observed disabled buttons in all three
stacks, with one native callback after two requestSubmit attempts. That proposed
failure did not reproduce; reference callback counts were again two. The probe
tests a Core prop write before submission, not constructor-only configuration.
Parent-coordinated final re-review remains pending. Do not treat these receipts
as integration approval. No PR, merge, npm
publication, deployment or unrelated core/router/security change is included.
