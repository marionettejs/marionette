# Isolated FormKit Pro comparison

This fixture installs Pro 0.130.4 into independent native, Vue, and React consumers.
The native consumer uses freshly packed local packages. Reference consumers use
FormKit 2.1.2, Vue 3.5.44 or React/ReactDOM 19.2.0. Each install captures a lock,
reinstalls with `npm ci`, checks the dependency graph and ESM/CommonJS imports,
and builds with Vite 8.3.0. A strict TypeScript 6.0.3 check covers the Pro plugin
and the `currencyDisplay` declaration. Vue packages are forbidden in native and React installs.

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
the chosen stack, Core 2.1.2 and Pro 0.130.4.

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
