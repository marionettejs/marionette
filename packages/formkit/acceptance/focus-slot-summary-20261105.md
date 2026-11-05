# Invalid focus and slot fallback verification

Tested source: `b0b16349c502c0c42b2729a88bb898234c8895ec`.
Last production change: `b94e98927a4a265dc53ef14c19ce6b32592df039`.
Baseline: `f91ccf4797778921896ca1fed8f9f9c38683573b`.

Two public regressions were reproduced before repair:

- Invalid submission focused an inactive radio whose focus handler selected an
  answer. Two unit assertions and the browser wrapper-focus assertion failed.
  The repair respects the entry point of a same-name radio-only composite and
  retains document-order fallback, external fields and ordinary input focus.
- A schema expression beginning with a slot lookup could select fallback text,
  which the renderer called as a function. All 11 initial regression cases failed.
  Evaluated non-callable fallbacks now render as text without being re-evaluated;
  callable slots retain scope, receiver and lifecycle behavior.

Independent Astra reviews examined both source and test oracles. On the exact
tested source above, build, package checks, all nine packed-consumer stages and
all 18 native Chromium journeys passed. Canonical coverage passed 2,765 tests
plus one expected failure across 184 files with unchanged thresholds; all nine
FormKit modules reached the configured 100% thresholds. Tests include two invalid
submissions preserving an unanswered value, intentional keyboard selection,
external invalid focus, hidden/disabled focus fallback and retained listener cleanup.

Toolchain: Node 24.19.0, npm 11.17.0, FormKit Core-family 2.1.2,
Playwright 1.64.1 and Chromium 154.0.8037.57. These are native/public custom-input
tests, not an execution of licensed Pro controls. Source-bundled measurements also
confirmed steep validated-form scaling in Chromium; these repairs do not address
that separate performance concern.

The initial coverage run had passing behavior but missed two new focus branches;
additional public tests covered them before the final pass. An earlier overlapping
focused run had two reset timeouts; their serial run and final canonical run passed.
The original red results and intermediate failures remain retained locally.

Actual Pro rating and togglebuttons replay is pending on this candidate. The
independently reported colorpicker `closeOnSelect` failure on the baseline also
needs exact-candidate replay. Earlier Pro touch, drag and functional passes retain
their original source/version attribution; they do not certify these controls or
establish full Vue/React, browser, device or online-license-validation parity.
