# Isolated FormKit Pro comparison

This fixture installs Pro 0.131.0 into independent native, Vue, and React consumers.
The native consumer uses freshly packed local packages. Reference consumers use
FormKit 2.1.2, Vue 3.5.44 or React/ReactDOM 19.2.0. Each install captures a lock,
reinstalls with `npm ci`, checks the dependency graph and ESM/CommonJS imports,
and builds with Vite 8.3.0. A strict TypeScript 6.0.3 check covers the Pro plugin
and the `currencyDisplay`, `popoverPosition` and month-pagination/minDate/maxDate declarations. On 0.131.0, a separate
strict fixture also checks the new `inline` declaration. Older comparison
versions retain all their existing declaration checks.
Vue packages are forbidden in native and React installs. The adapter itself has
no Pro dependency; this opt-in fixture owns its version selection in
`consumer/version.js`. Core remains pinned to 2.1.2.
For isolated release controls, pass `0.130.5`, `0.130.6` or `0.130.7` after the stack to
`prepare.mjs`. Outputs are versioned under `test/tmp/formkit-pro/<version>/<stack>`;
each generated consumer label records its selected version.

All three consumers import base Genesis (`@formkit/themes/genesis`, pinned 2.1.2)
before the Pro Genesis extension. The extension does not replace the base theme.
In particular, base Genesis makes input inners positioned containers for popovers.
The collector checks computed positioning and containment using an absolute
descendant of each core input; actual Pro popover interactions still require the
authorized development consumer. See [official styling guidance](https://formkit.com/essentials/styling).

Use the repository's pinned Node/npm toolchain. Build before packing:

```sh
npm run build
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs native'
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs vue'
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs react'
```

Each command prints a temporary consumer path and the command to start its private
localhost server. Start those three servers on the printed ports (5190–5192), then:

```sh
node test/fixtures/formkit-pro/capture.mjs
```

If those ports are already leased, start each consumer with
`npm run dev -- --port <port>` on three consecutive unused ports, then pass an
output directory and the first port to `capture.mjs`.

For a dependency-only native compatibility check, prepare only the native consumer
and pass `native` as the optional stack argument (after output directory and base port):
`node test/fixtures/formkit-pro/capture.mjs <output-directory> <base-port> native`.
The optional `vue` and `react` selections retain base-port offsets of +1 and +2.
This selection does not establish a fresh comparison against the omitted stacks.
The collector rejects served receipts with a different stack or FormKit/Pro version.
Earlier 0.130.1 receipts remain in `packages/formkit/acceptance/pro-01301-*`.

The browser collector uses the already-installed cloud `/usr/bin/chromium`.
It explicitly requests Chromium sandboxing; verify the supported sandbox-enabled
launch in the selected cloud executor before collecting actual browser evidence.
It does not download browsers, connect to an existing browser, or use a Mac.
Run only one collector at a time. Reviewers should prepare independent copies;
do not share a mutable browser context or writer checkout.

The collector reads each consumer's source/artifact receipt, captures desktop and
390px screenshots, and writes `test/tmp/formkit-pro/browser/parity-baseline.json`.
It exits nonzero for blocked Pro bootstrap, failed assertions, or unexpected page
and runtime errors. Only the exact known missing-key error is classified as a
blocked bootstrap; other bootstrap exceptions are runtime failures. Those outcomes
must not be relabeled as passes. `?mode=core` explicitly renders the core fixture;
the default Pro mode never substitutes native controls after a bootstrap failure.

The page exposes replacement, disable, server-rejection, request completion, reset,
and destroy controls. Async submission remains pending until **Finish pending
request** is pressed. Rejection uses each integration's public server-error API;
this does not compare thrown-callback recovery. Native replacement uses `setValues`,
Vue uses `modelValue` updates, and React uses controlled `modelValue` state.
The collector records a real second `requestSubmit()` while the callback is pending.
Native rejected-Promise recovery is covered separately by the public unit regressions
in `test/unit/formkit-hardening.spec.js`; the comparison fixture does not certify it
for Vue or React.

The current fixture's `createProPlugin(undefined, inputs)` call is a negative
bootstrap probe of the website's keyless-localhost claim. It does not configure
the documented free development project key and cannot establish whether that
supported configuration works. Development does not require a paid production
license. The package README, installation guide, and CLI use
`createProPlugin(projectKey, inputs)` with a free development project key; see
[the development bootstrap assessment](../../../packages/formkit/acceptance/PRO-DEVELOPMENT-BOOTSTRAP.md).
The fixture contains no project key and does not register premium definitions
around the plugin. This keyless collector does not exercise Pro-control keyboard, popover, repeater,
ARIA, or lifecycle behavior. Separate authorized vault QA used an approved
development key and passed the bounded seven-control journey; see the
[versioned receipt](../../../packages/formkit/acceptance/pro-repeater-20261103/README.md).
A new source revision still requires its own authorized Pro retest. Keep project keys and proprietary consumer code out of committed
fixtures and receipts.

This is a bounded comparison, not a full Vue/React/Pro parity certificate. The
schema currently covers grouped text/email and seven intended Pro control types.
All control-specific Pro interaction cases require successful authorized mounting
before extending the collector. Pointer/keyboard behavior, async options, all 14
Pro inputs, shadow roots, alternate themes, Firefox and WebKit are not certified.

For the separate authorized datepicker investigation, `trace-datepicker.mjs`
exports `traceDatepicker(node)`. Import it in the existing development consumer
and pass its public `getNode('date')` result before reproducing the failure.
The helper does not bootstrap Pro or read any key. It observes pointer/focus/click
events, boolean expanded state, button/icon placement, pointer-target connectivity,
and stack function names;
it records no input values, event keys, page text or URLs.

Keep one trace across Enter-open, November 15 selection, confirmed close,
pointer reopen, a 1.8-second wait, then Enter reopen. Use `trace.mark('closed')`
and `trace.mark('after-pointer-wait')` at those checkpoints. Export the JSON from
`trace.stop()` with the exact source SHA and browser version. It removes its
listeners and observer. This distinguishes absent click delivery from a true→false
expanded transition or replaced button. Do not include project configuration or
credentials in the receipt. The helper is diagnostic evidence, not a passing
datepicker assertion or license-validation check.

## Pro 0.130.3 follow-up checks

The upstream bundle changes active-option scrolling and popover resize handling;
see the [release assessment](../../../packages/formkit/acceptance/PRO-01303.md).
The existing collector exercises the core comparison and classifies keyless Pro
bootstrap. It does not certify these additional Pro interactions. In an already
authorized development consumer, retain the seven-control journey and check:

- An overflowing dropdown/autocomplete/taglist: keyboard navigation keeps the
  active option visible; moving the pointer over options does not repeatedly
  scroll the list back to the keyboard selection.
- Change options or panel content while it is open and check that its placement
  remains aligned with the control, including near the bottom of the viewport.
- Close and reopen affected popovers, then destroy the owning form while open.
  Check DOM removal, registry cleanup, and absence of subsequent page errors.

Record source SHA, Pro/Core/browser versions, actual interactions and failures.
Keep development keys out of fixtures and receipts. Local interaction success
still does not prove online license validation or broader control parity.

## Pro 0.130.4 release scenarios

This scenario reruns the 0.130.4 release regressions on the fixture's currently
selected Pro version (now 0.131.0). The collector records and checks that installed
version; its `release-01304` scenario name identifies the assertions, not a package
pin. Earlier 0.130.4 receipts retain their exact historical versions and results.

The default seven-control journey remains available. The opt-in URL
`/?mode=pro&scenario=release-01304` adds a separate grouped fixture for the new
release claims: USD/JPY/KWD currency precision without symbols, an explicit
precision override, reactive mask presentation, late dropdown-family options,
duplicate-valued draggable repeater rows, and searchable transfer-list targets.
Core stays pinned to 2.1.2; this patch does not test a Core upgrade.

In the existing authorized development consumer, run:

```sh
node test/fixtures/formkit-pro/capture-release-01304.mjs <output-directory> <actual-port> native
```

The collector requires direct `li` repeater rows and a visible, nonzero
`formkit-drag-handle`. It performs real handle drags before and after data
replacement, records each gesture's geometry and events separately, and checks
both model and DOM order. Drag events are observed in capture phase because
drag-and-drop 0.6.3 stops propagation at the row. The original native 5/8 failure,
Vue observer diagnosis and subsequent adapter repair are retained in the
[repair receipt](../../../packages/formkit/acceptance/pro-drag-01304/README.md).

The last argument may be `vue` or `react` for an independently prepared reference
consumer. Unlike the general three-stack collector, this command takes that
consumer's actual port, with no offset. The prepared source receipt must match
the chosen stack, Core 2.1.2 and the selected Pro version.

The collector has eight grouped cases. It checks visible presentation separately
from canonical values, requires real dragstart/dragend events and changed row
order, awaits whole-form replacement before dragging again, and verifies the
edited model index. Transfer search must visibly filter and restore the targets;
an option-wrapper `toJSON` counter must stay unchanged during those operations.
Submission, reset and destruction use public bridges. The fixture's synthetic
values and options contain no project configuration.

The collector neither reads nor injects a project key. The repository's default
keyless bootstrap therefore records `blocked` and exits 1 with zero executed
cases. Use the existing approved vault bootstrap for actual-control testing;
do not replace the plugin with direct premium definitions. Failed assertions and
unexpected page/runtime errors fail the collector. Network failure error text is
retained without request URLs or headers and does not establish online license
validation. This collector does not certify touch dragging, active-drag teardown,
direct Destroy-button reachability under an open popover, or all Pro behavior.
See the [versioned release assessment](../../../packages/formkit/acceptance/PRO-01304.md).

## Pro 0.130.5 release scenarios

`/?mode=pro&scenario=release-01305` supplies authored public scenarios for the
[0.130.5 release](https://github.com/formkit/docs-content/blob/master/_changelog-pro/138.v0.130.5.md).
It uses the existing bootstrap boundary; the committed fixture has no key and
requires an authorized development bootstrap kept outside source and logs.

In the existing authorized consumer, verify actual interactions:

- Single-select autocomplete with `allowNewValues`: enter new text into
  `release-newText` and blur; its canonical value must become the text. Enter
  `Alpha` into `release-exactLabel` and blur; the value must be `alpha`. Typing
  other text into `release-selected` must retain its existing `beta` selection.
  Reset and check Escape cancels uncommitted text before blur.
- For each of autocomplete, dropdown, taglist, datepicker and colorpicker,
  `window.proof.release01305.setPopoverPosition(type, position)` changes the
  public prop. Open the visible panel with room on both sides and verify actual
  above/below geometry for the explicit modes, then the normal viewport-aware
  behavior for `auto`. Keep strict placement checks while open and after
  reopening: in the historical 0.130.5 study on Core 2.1.2, changing `auto` to `above` while open currently
  leaves all five below. Reopening honors `above` for autocomplete, dropdown,
  taglist and datepicker; colorpicker still stays below. Record those failures
  and prop/context values separately rather than count a recognized prop as
  correct geometry. Native and Vue show matching behavior in the final study.
  Datepicker and colorpicker explicitly enable `popover` in this scenario.
- Open `release-month`, enter its month panel and use navigation controls.
  `paginatedPanels: ['month']` must move that panel a year at a time. Navigation
  alone must retain the canonical date; select a month/date and verify the
  resulting value, then reset and destroy while open.

Retain selection, focus, ARIA, values, error and teardown assertions from the
established controls. A configured prop or successful type/build check is not
evidence of correct panel placement, blur or calendar behavior. The current
public collector does not automate these new scenarios; independent actual-Pro
QA records them separately, without relabeling the historical 158-check suite.

Historical 0.130.5 acceptance of the exact writer fixture passed the native older-
regression collector 8/8. New scenarios pooled native plus selected Vue controls
into 19 logical groups: nine pass and ten placement groups fail, with no native-
only failure. Autocomplete and month-pagination/lifecycle checks passed in their
tested scope. This final addendum did not repeat React; an earlier separate
four-arm study established the static colorpicker limit in React too. Keep those
studies separate, retain strict failed placement outcomes, and do not report
19 cases per adapter or full 0.130.5 feature success. Exact historical 158-check
replay remains 0/158 per native arm because its helper source is unavailable.

Actual licensed collection used reviewed sanitizing wrappers; the raw public
launchers alone are not credential-safe. Keep project configuration outside committed source and use credential-safe
launch/output handling. See the qualified
[release assessment](../../../packages/formkit/acceptance/PRO-01305.md).


## Pro 0.130.7 lifecycle and whole-day bounds

The historical 0.130.7 update is recorded in the separate
[release assessment](../../../packages/formkit/acceptance/PRO-01307.md).
The earlier placement failures above remain historical 0.130.5 evidence and
must be retained as strict controls in a new release replay; this fixture does
not assume 0.130.7 fixes them. The original historical 158-check source is still
unavailable; no new collector is that suite.

`/?mode=pro&scenario=lifecycle-01307` runs the owned lifecycle probe through
`window.proof.runLifecycle()`. The native entry installs a task-local timer
bridge **before importing Pro**, because the package caches `setInterval`.
Use a fresh page for this route. Do not import Pro first and then install the
recorder: zero observed registrations is inconclusive. `lifecycle-driver.mjs`
exports `captureLifecycle(page, { origin, expectedProVersion })` for an existing
caller-owned sandbox-enabled browser and authorized development bootstrap. The caller
owns the page and must close it in `finally`, including on a deadline or blocked
bootstrap. A deadline does not cancel a page-side probe. This module neither
launches a browser nor obtains, injects or records a project key.

The probe creates a Core-only control, a surviving form, two
successive Pro child controls, and two transient forms using public Region,
FormView and FieldView APIs. It observes the intervals actually acquired while
those owners are constructed/rendered. Each Pro form cohort and explicit Pro
child must exercise a 4,000 ms interval; it does **not** assume every native
node creates one. A missing cohort or an asynchronous unscoped acquisition is
incomplete rather than a passing lifecycle result. Bootstrap interval metadata
is reported separately and does not establish owner cleanup.

Observed target intervals must tick while their owners are live, stop and cease
ticking after child/full-form destruction, and leave still-mounted survivors'
original handles ticking across teardown. The final snapshot is taken before
collector cleanup. The collector then clears remaining owned handles, detaches
recording, restores the global timer functions and leaves cached aliases as
pass-through functions. Other captured delays receive a final inactivity check;
only the target 4-second intervals receive tick/liveness assertions. This takes
about 22 seconds with the real clock. It checks programmatic Core edits,
synthetic File values, submit/reset and registry/DOM cleanup; it does not claim
trusted file-upload gestures, heap collection, listener cleanup, arbitrary async
timer ownership or universal Pro-control coverage. Synthetic unit controls
validate the probe's discrimination, not Pro implementation behavior.

`/?mode=pro&scenario=release-01307` adds three datepickers for the 0.130.6
whole-day min/max fix retained in 0.130.7. Set browser timezone UTC and fix only
Date to `2026-11-08T12:30:00Z`, keeping interval/timeout delivery live. The
minimum is November 8 at 23:59; maximum is November 10 at 00:01. Through actual
calendar and keyboard interactions, check each bound's entire day is selectable,
November 7/11 are excluded where applicable, and submitted/reset values remain
canonical. Type/build success and prop recognition do not certify this behavior.
Run the old eight-group collector and relevant new scenarios separately through
the approved sanitizing wrapper; raw launchers alone are not credential-safe.
Persist the exact helper sources, versions, failed/unrun cases and sanitized
receipts with each replay. No performance or garbage-collection claim follows.


Historical Pro 0.130.7 independent acceptance passed the
delivered lifecycle collector 113/113 on 0.130.7: five actual acquisitions,
all cleared before collector cleanup, zero forced clears and live survivors.
Matched 0.130.6 retained five; its 20 repeated failed assertions are not 20
separate leaks. The native common collector passed 8/8. Real keyboard date-bound
checks passed 12/12 total across native 0.130.6/0.130.7, Vue 0.130.7 and React
0.130.7, using Core 2.1.2 and Tempo 1.1.1. Native and Vue passed follow-on
submit/reset/invalid-focus/destruction. Two React reference follow-on failures
remain unexplained; the final targeted pass had a closed popup before Escape
and explains neither. Keep those failures, the separate Tempo 1.1.0 baseline
listener study, historical placement limits and original 158-case replay 0/158
explicit. See the release assessment for toolchain differences, source identity
and unrun online-license, heap/GC, coverage, performance and broader-control
limits. This receipt update changes no executable fixture or assertion.


## Pro 0.131.0 inline and slot scenarios

The selected version is now 0.131.0; Core and base Genesis stay at 2.1.2. The
existing Pro Genesis import picks up the shipped inline rule. This does not add
Regenesis or upgrade its version. See the separate
[release assessment](../../../packages/formkit/acceptance/PRO-01310.md).

`/?mode=pro&scenario=release-01310` provides five datepickers: ordinary inline,
inline with `sequence: ['year', 'month', 'day']`, an ordinary popup negative
control, an explicitly labeled inline+popover placement probe, and an inline
custom `panelWrapper` slot. The native named slot uses the
documented child-slot map containing schema nodes, not callback functions.
Callback slots use the separate `slots` API. Pinned Vue/React Schema parsers
expose only a default
slot for that shape, so their entries mount this one control through each
official component's named-slot API (Vue slot function, React `slots` prop).
They keep the same grouped values and datepicker props; the other controls still
use FormKitSchema. The custom slot replaces its section and is not presented as
a calendar-preserving wrapper API. Its marker must render once.

Ordinary inline, sequenced inline and custom-slot controls do not author a
`popover` prop. Only the popup control and `combination` probe author
`popover: true`; the latter is explicitly `inline: true`. Its label and
`data-release-calendar="combination"` marker keep it distinct from ordinary
inline. Native, Vue and React keep the same props and group ownership for each
case. The two ordinary inline calendars remain available for selection/focus
checks.

A fixture-owned input outside the form is focused before the adapters mount;
the inline calendar must not take that initial focus. This external anchor is
owned by the page, not destroyed as part of the form.

Pin timezone UTC and Date only to `2026-11-09T12:30:00Z`, leaving timers live.
In an authorized development consumer, check:

- The ordinary inline calendar is visible immediately, below its input, and
  stays visible after choosing a different day. Check canonical `YYYY-MM-DD`
  value, selected-day state, a second selection, replacement and reset.
- Exercise real keyboard date editing, not only `node.input` or programmatic
  DOM assignment. Independent baseline checks on Core 2.1.2 found that real
  inline day edits
  followed by Tab retained the November 9 model in all three adapters. Native/
  React displayed November 12; Vue displayed November 20, a separate display
  assertion failure. Old/new native popup controls committed November 12.
  Retain strict model and display assertions; do not count these as passes or
  certify this revised candidate from those baseline results.
- Use real keyboard navigation through year, month and day panels. Selecting a
  complete date must keep the calendar open and restart the sequence at year.
  Focus must remain usable after each transition. The independent baseline
  restarted the sequence and retained visibility, but month-to-day Enter left
  focus on BODY in all three adapters. Preserve that failed focus assertion.
  This is separate from the initial no-focus-steal check. Verify normal Tab progression without assuming
  that every calendar button has the same tab order in every adapter.
- Count `[data-release-panel-slot=custom]` after mount, canonical value changes,
  explicit replacement and reset: one custom slot instance. The default popup
  control must still open, select and close normally. The independent baseline
  places ordinary inline below the input, but the separately authored
  `inline: true, popover: true` combination at page top in all three adapters.
  Preserve that failing combination probe; do not relabel it as ordinary inline.
  Current wrapper counts were one, but the old control also had one, so that
  baseline did not reproduce the historical duplicate bug. A controlled inline-to-
  popup transition may be explored separately; the release does not establish
  an unrestricted dynamic-toggle guarantee. Retain the static popup control.
- Retain valid submit/reset, invalid-submit focus/ARIA and teardown controls,
  the `release-01307` min/max scenario, and the unchanged old eight-group and
  genuine-acquisition lifecycle collectors against the selected version.

`data-release-calendar` and `data-release-stage` markers are authored section
attributes for bounded oracles, not substitute calendars. Declared `inline` must
not leak into HTML attrs. The ordinary public inline unit case certifies the
adapter's prop/slot/update channel only. Actual Pro inline visibility, typing,
selection, sequence, focus and duplicate-slot behavior require authorized browser
acceptance. There is no new public automated inline collector in this update;
retain the exact independently authored runtime helper with its results.
Historical 0.130.7 timer/8-group/date passes do not certify 0.131.0. Both earlier
React follow-on failures, historical placement limits and missing 158-case
replay remain recorded until controlled evidence resolves them. No heap, online-
license, performance or broader device/control claim follows.
