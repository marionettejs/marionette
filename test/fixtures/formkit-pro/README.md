# Optional Pro comparison fixture

This fixture prepares independent native, Vue and React consumers with Pro
0.131.0 and a matched FormKit **2.5.0** family. Vue 3.5.44, React/ReactDOM 19.2.0,
Vite 8.3.0 and TypeScript 6.0.3 remain fixed for attribution. The adapter's public
constraints are `^2.5.0`; these comparison consumers intentionally pin the tested
floor. Each preparation captures and reinstalls a lock, checks the actual runtime
family, ESM/CommonJS Pro imports, declarations and a production build. Vue packages
are forbidden in native/React consumers. These checks do not certify Pro controls.

```sh
npm run build
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs native'
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs vue'
npm exec --call='node test/fixtures/formkit-pro/prepare.mjs react'
```

Preparation prints each owned temporary directory, server command and receipt.
Default ports are 5190/5191/5192. An optional third argument selects Pro 0.130.5,
0.130.6 or 0.130.7 for a new comparison; older receipts keep their original Core
versions. Inspect the recorded graph instead of inferring it from the Pro version.
Keep one Core instance and use the same module format within each consumer.

All stacks import base Genesis before the Pro extension. Do not substitute a
temporary positioning rule or confuse style/size checks with performance.

## Bootstrap and collection

The committed fixture uses `createProPlugin(undefined, inputs)` as a keyless
bootstrap control. It contains no project key. Actual premium-control verification
requires an existing authorized development configuration supplied privately.
Never commit keys, proprietary implementation or private runtime dumps. Raw public
launchers alone are not credential-safe; licensed collection needs sanitized
environment/output handling.

`?mode=core` is an explicit Core control. It must not be reported as successful Pro
mounting when `?mode=pro` is blocked. Record blocked bootstrap, runtime exceptions,
unexecuted cases and every failed assertion separately.

In an authorized environment with the prepared servers running:

```sh
node test/fixtures/formkit-pro/capture.mjs <output-directory> <base-port>
node test/fixtures/formkit-pro/capture-release-01304.mjs <output-directory> <actual-port> native
```

The first collector takes optional `native`, `vue` or `react` after the base port;
Vue/React retain +1/+2 offsets. The release collector takes the selected stack's
actual port. Both require matching prepared receipts. The existing launchers use
sandbox-enabled cloud Chromium. The current dependency update has not executed
browser collection; imports/types/builds and synthetic unit collectors are not
browser or licensed-Pro acceptance.

The shared page provides value replacement, disabled state, server errors, pending
submission completion, reset and destruction. Complete pending submissions with
**Finish pending request**. Preserve committed values, DOM identity, validation,
invalid-submit focus/ARIA and registry cleanup. Compare each framework's actual
public contract rather than requiring identical event counts or focus behavior.

## Retained scenarios

| URL scenario | Required behavior |
| --- | --- |
| Default | Grouped text/email and seven intended Pro controls, replacement, submit/reset and teardown. |
| `release-01304` | Currency precision/presentation, reactive masks, late options, real repeater dragging before/after replacement and transfer-list filtering without option mutation. The collector covers eight older regression groups only. |
| `release-01305` | Autocomplete novel/exact-label/retained-selection blur and Escape; five popup-position controls; month-only pagination by year. |
| `release-01307` | Whole-day inclusive min/max selection through actual keyboard/calendar interaction, canonical submit/reset. |
| `release-01310` | Ordinary inline, sequenced inline, popup control, explicit inline+popover probe and one custom panel-wrapper slot. |
| `lifecycle-01307` | Actual interval acquisition, survivor liveness and cleanup after child/form destruction. |

For `release-01305`, `window.proof.release01305.setPopoverPosition(type, position)`
sets the declared prop; it is not a geometry oracle. Verify both props/context and
actual open-panel placement, then close/reopen. Do not count HTML attr leakage,
recognized props or a passing old collector as full new-feature acceptance.

For date bounds, use UTC and fix Date only to `2026-11-08T12:30:00Z`, leaving timers
live. Minimum November 8 at 23:59 and maximum November 10 at 00:01 must allow each
bound's whole day while excluding November 7/11 where applicable.

For inline scenarios, use UTC and Date `2026-11-09T12:30:00Z`. Retain strict checks
for initial focus preservation, visible ordinary inline placement, repeated day
selection, canonical model values, actual keyboard edits followed by Tab, panel
sequence restart and usable focus after keyboard transitions. Preserve ordinary
popup behavior, replacement/reset, submission and teardown. The custom wrapper
marker must occur once after updates and reset.

Ordinary inline controls omit `popover`; only the popup and explicitly labeled
combination author `popover: true`. Do not relabel the combination as ordinary
inline. The native child-slot map contains schema nodes; callback slots use `slots`.
Vue/React mount the custom control with their official named-slot APIs while
keeping matching props and group ownership. Its replacement section is not a
calendar-preserving wrapper guarantee. `data-release-*` markers are authored
oracles, not substitute calendars. Dynamic inline-to-popup behavior is a separate
probe, not an unrestricted toggle contract.

## Lifecycle protocol

Use a fresh page for `lifecycle-01307`: the native timer bridge must install before
Pro caches timer functions. `lifecycle-driver.mjs` exports
`captureLifecycle(page, { origin, expectedProVersion })`; the caller owns the
sandbox-enabled page and private bootstrap and closes it in `finally`, including
on deadlines. A deadline does not cancel page-side work.

The collector follows actual acquired 4-second intervals across a survivor, two
successive Pro children and transient forms. It does not require one interval per
native node. Missing cohorts or unscoped asynchronous acquisition are incomplete.
Owned intervals must tick live, stop after destruction and leave original survivor
handles ticking. Snapshot before collector cleanup; report forced clears separately.
The helper restores timer APIs and tests programmatic edits, synthetic File values,
submit/reset and registry/DOM teardown. It does not establish heap collection,
listener cleanup, trusted uploads or arbitrary asynchronous ownership. Synthetic
positive/negative unit controls validate the collector, not actual Pro behavior.

`trace-datepicker.mjs` remains available to trace public datepicker events/state
without recording keys, values, page text or URLs. Preserve the complete authored
helper and sanitized receipts for any actual replay.

## Historical limits

Older Core 2.1.2 studies found open-panel placement failures, inline+popover at
page top, inline keyboard edits that did not commit models, and month-to-day focus
loss across reference adapters. Vue had an additional inline display mismatch.
Two React follow-on interaction failures remained unexplained; a targeted pass
with an already-closed popup did not resolve them. Earlier wrapper counts also
did not reproduce the historical duplicate-slot bug. Keep these as strict future
controls, not current 2.5.0 results or presumed fixes.

The original 158-case helper is unavailable and has not been replayed. Online
license validation, wider browsers/devices, heap collection and performance parity
remain unverified. Full original receipts are recoverable from
[immutable history](https://github.com/marionettejs/marionette/tree/9b031550bb2737f052896ee0a0bfe032a54d5b55/packages/formkit/acceptance).
