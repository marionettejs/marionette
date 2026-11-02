# Isolated FormKit Pro comparison

This fixture installs Pro 0.130.1 into independent native, Vue, and React consumers.
The native consumer uses freshly packed local packages. Reference consumers use
FormKit 2.1.2, Vue 3.5.44 or React/ReactDOM 19.2.0. Each install captures a lock,
reinstalls with `npm ci`, checks the dependency graph and ESM/CommonJS imports,
and builds with Vite 8.3.0. Vue packages are forbidden in native and React installs.

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

Pro bootstrap follows the documented keyless localhost claim with the unmodified
`createProPlugin(undefined, inputs)` call. The fixture contains no license key and
does not register premium definitions around the plugin. If that invocation is
blocked, paid-control keyboard, popover, repeater, ARIA, and lifecycle cases remain
unverified. An existing authorized bootstrap can be assessed separately without
putting credentials or proprietary bundle output into Git.

This is a bounded comparison, not a full Vue/React/Pro parity certificate. The
schema currently covers grouped text/email and seven intended Pro control types.
All control-specific Pro interaction cases require successful authorized mounting
before extending the collector. Pointer/keyboard behavior, async options, all 14
Pro inputs, shadow roots, alternate themes, Firefox and WebKit are not certified.
