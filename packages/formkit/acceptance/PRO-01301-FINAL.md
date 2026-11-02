# FormKit repair retest — 2026-11-02

**Tested source: `f75a0ca3606a1edc5e8764154e9523eca1390970`.** All final installs
were packed from this clean revision. This document and its artifacts may be
delivered by a later documentation commit; that does not change the tested source.
The earlier [baseline](PRO-01301.md) and [first repair](PRO-01301-REPAIR.md) receipts
retain their original revisions and results.

## Second review loop

Both parent-coordinated source reviewers found two remaining first-round gaps.
Named registrations queued their Region insertion after input mounted callbacks,
and an invalid input inside a hidden ancestor prevented focus reaching the next
visible external field. Both failures were reproduced before repair:

- Two named-registration unit cases failed on the first-round source:
  [field and ordinary View failures](pro-01301-final/named-mounted-red.txt).
- Real Chromium failed to focus the visible external field after invalid submit:
  [hidden-ancestor failure](pro-01301-final/hidden-focus-red.txt).

`7d5a4d38f0c272e596603246f715c879d341e217` queued Region placement before View render
and tried subsequent invalid controls when focus failed. A supplemental Astra
review then identified a valid factory that renders its FieldView before returning.
That case also [failed before repair](pro-01301-final/factory-rendered-red.txt).
`f75a0ca3606a1edc5e8764154e9523eca1390970` queues the same placement callback before
calling the registration factory. Existing ownership and disposal checks remain.
The four field/view × rendered/unrendered cases, plus packed and browser fixtures,
cover that path. No extra timer or polling mechanism was introduced.

Invalid-control focus excludes hidden/inert ancestors, disabled/hidden inputs and
detached controls. It attempts eligible controls in document order until the browser
accepts focus. The browser regression covers `[hidden]`, `inert`, `display:none`
and `visibility:hidden` ancestors before a visible required external FieldView.

## Final checks

[Machine-readable verification](pro-01301-final/verification.json) records versions,
source hashes and counts. Node 24.19.0, npm 11.17.0, FormKit 2.1.2, Pro 0.130.1,
Vitest 5.0.3, Playwright 1.63.0 and installed cloud Chromium 154.0.8037.57 were used.

| Check on the final source | Result | Receipt |
| --- | --- | --- |
| FormKit unit suite, one worker | 430 passed | [output](pro-01301-final/unit.txt) |
| Full build and declaration consumers | Passed | [output](pro-01301-final/build.txt) |
| Packed ESM/CommonJS runtime, declarations and boundaries | Passed | [report](pro-01301-final/package-report.json), [output](pro-01301-final/package.txt) |
| Focused ESLint / public-test boundary | Passed | Commands recorded below |
| Existing and new Chromium suite, one worker | 14 passed | [output](pro-01301-final/browser-suite.txt) |
| Fresh packed native core comparison | 14/14 passed | [comparison](pro-01301-final/comparison.json) |

The packed tests include a registration returning `new FieldView(options).render()`
and verify that mounted sees a connected input exactly once. All browser contexts
were created and closed by the writer in this cloud environment. No Mac or personal
browser was used, and the previously denied browser download was not retried.

Reproduce with the pinned toolchain:

```sh
npm run build
npm run test:formkit -- --maxWorkers=1
npm run test:formkit-package
npm --prefix examples/formkit ci --ignore-scripts
MNJS_TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser -- --config test/formkit/playwright.config.mjs --project=chromium --workers=1
npm exec -- eslint packages/formkit/src/index.ts packages/formkit/src/runtime.ts packages/formkit/src/view-components.ts test/unit/formkit-hardening.spec.js test/unit/formkit-regressions.spec.js test/formkit/formkit-fixture.js test/formkit/formkit.spec.mjs test/fixtures/formkit-package/verify.mjs test/fixtures/formkit-pro
npm run check:public-tests
```

## Portable rendered and interaction evidence

The [keyboard receipt](pro-01301-final/registered-keyboard.json) contains the exact
invalid and reset DOM, mounted lookup observations, active input ID, labels, and
unique help/error references. The passing test uses real Tab, Shift+Tab and Enter,
checks focus on invalid submit, corrects both controls, verifies the saved values,
and resets them. Correction/saved-value assertions are in the test; the attached DOM
snapshots cover invalid and reset states. The [invalid-state screenshot](pro-01301-final/registered-invalid.png)
shows the named controls and focused first input; the writer inspected this image.

The [hidden-focus receipt](pro-01301-final/hidden-invalid-focus.json) records all four
ancestor states, successful focus on the external field, `aria-invalid`, unique
correct help/error IDs, and reset markup with only its help reference remaining.
The [interaction manifest](pro-01301-final/interaction-manifest.json) binds these
artifacts to the exact source, browser version and passing test names.

The fresh native [desktop](pro-01301-final/native-core-desktop.png) and
[390px](pro-01301-final/native-core-mobile.png) screenshots and the Vue/React images
beside them accompany the independent installed comparison. All three consumers
record clean source `f75a0ca3`, their lock/package hashes and tool versions. Native
records an actual repeated `requestSubmit`: disabled button, two attempts, one
callback. All stacks recorded zero unexpected runtime/page errors.

Vue remains 11/14 and React 12/14 for these bounded routes: both retain an omitted
local class section and run two callbacks for programmatic repeated submission;
the direct Core `node.props.submitAttrs` class update also times out in Vue. These
are route-specific observations, not broad framework defect or parity claims.
The collector correctly exits **1** for these differences and unavailable Pro
bootstrap. The resolved server-error callback is accurately named; genuine
rejected-callback recovery is separately tested only for the native adapter.

Private cloud servers are native `localhost:5590`, Vue `:5591`, React `:5592`.
They are not cross-environment preview URLs. The browser lease is released. Reviewers
elsewhere should use these portable artifacts or rebuild the
[isolated fixture](../../../test/fixtures/formkit-pro/README.md) in their own cloud
environment. Their artifact inspection must not be described as independent live QA.

## Review status and remaining coverage

The three parent-coordinated baseline reviews drove the first fixes; technical and
product re-review drove the second round. A separate Astra source reviewer found
the rendered-factory residual and then confirmed its focused `f75a0ca3` delta was
resolved with no new findings. That reviewer performed no tests or browser actions.
Parent-coordinated final review of the latest source and these new artifacts remains
pending at this receipt's creation. These checks are not integration approval.

Actual Pro controls remain **unverified**. On localhost all three consumers' exact
unmodified `createProPlugin(undefined, inputs)` invocation throws the known missing-key
error. The historical customer-forms Upperline TCM setup has no confirmed approved
bootstrap file/binding in this workspace. No secret retrieval, new key request,
license workaround or private customer-source copying was attempted. The executed
bootstrap is blocked; approved existing bootstrap availability is pending. That is
a coverage gap, not evidence that the user must purchase anything.

All 14 Pro inputs, their keyboard/popover/repeater behavior, custom customer controls,
full TCM integration, alternate themes, shadow roots, SSR/hydration and Firefox/WebKit
remain outside this verification. No full Pro/TCM parity or performance claim is made.
No PR, merge, npm publication, deployment, or unrelated core/router/security change
is included in this receipt.
