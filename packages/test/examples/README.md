# Runnable @mnjs/test examples

Use these examples to connect `@mnjs/test` to your runner and browser tools. They
import public package exports with Marionette 5.0.0. See the
[package README](../readme.md) for installation and the [consumer reference](../guide.md)
for mounting, ownership and cleanup contracts.

## Run the examples

From the Marionette repository root:

```sh
npm run build
npm --prefix packages/test/examples ci --ignore-scripts --install-links
npm --prefix packages/test/examples test
npm --prefix packages/test/examples run test:browser
npm --prefix packages/test/examples run test:playwright
```

The example project has its own dependency lock. `--install-links` installs
a copy of the built helper package. Browser checks require an installed Chromium;
set `MNJS_TEST_CHROMIUM_EXECUTABLE` to use an existing executable. Playwright
starts a fresh gallery server on port 4187; stop an existing gallery server before
the run so it exercises the installed artifact. Playwright results go to
`test-results/playwright`; Cypress screenshots go to
`test-results/cypress/screenshots`, relative to the example project.

| Example | What it demonstrates |
| --- | --- |
| [Vitest form tests](form.spec.js) | The optional Testing Library decorator and user-event interactions, validation, focus, saves, readiness and cancellation with the per-test `mounts` fixture. The same tests run in JSDOM and Vitest Browser Mode. |
| [Gallery lifecycle](gallery.spec.js) | Fresh story ownership during asynchronous replacement, project disposal errors and superseded mounts, checked in JSDOM and Chromium. |
| [Testing Library mounts](testing-library.spec.js) | Bound queries, live replacement roots, asynchronous readiness, detached/foreign-document mounts and borrowed query scopes with existing fixture cleanup. |
| [Runtime isolation](runtime.spec.js) | Independent `createMarionette()` families and Radio channels, with cleanup registered for the resources this test owns. |
| [Playwright tests](playwright/profile.spec.js) | Browser interaction through Locators and the [story gallery](gallery/gallery.js). Playwright 1.63.0 supplies the gallery mount fixture. |
| [Cypress component tests](cypress/component/profile.cy.js) | Explicit `cy.mount` registration, awaited replacement and direct container children. |
| [ESM](consumer.mjs) / [CommonJS](consumer.cjs) consumers | Public package imports, lifecycle behavior and cleanup; matching TypeScript consumers check declarations. Run with `npm --prefix packages/test/examples run test:consumer`. |

The Cypress smoke executes the component examples and four separate expected-failure
command probes, each followed by a fresh-mount cleanup check. A separate automatic
`afterEach` failure probe checks that Cypress skips the remaining test, matching
its native hook-failure policy. It records actual runner versions
and results; declaration checks alone do not establish Cypress execution.

## Use the Cypress example

Copy the [config](cypress.config.js), [support file](cypress/support/component.js)
and [component HTML](cypress/support/component-index.html) into your Cypress project.
The config uses Cypress's custom Vite dev-server function; the support file mounts
Marionette directly into the Cypress container with `@cypress/mount-utils`.

The support file calls `setupCypress()` and registers the package's `mount` and
`mountApplication` exports as commands. Importing the package alone registers
nothing. `cy.mount(() => new MyView())` yields the actual helper handle. Repeated
mounts await previous cleanup before constructing the next View. You can also use
`mounted.region.show(nextView)` for replacement within one mount. The registered
before/after hooks return cleanup promises; the adapter never passes asynchronous
cleanup to mount-utils' non-awaiting hook callback.

`cy.mountApplication(factory, { start: true })` waits for readiness. Pass
`{ start: false }` to choose startup yourself. The runner owns the container and
uses direct-child rendering by default. The [spec](cypress/component/profile.cy.js)
shows repeated mounts, Region replacement and form interaction. Genuine Cypress
ESM/CommonJS declarations are checked separately from neutral consumers by
`test:consumer`; that check does not execute Cypress.

With Cypress and its browser binary available, the example's command is:

```sh
npm --prefix packages/test/examples run test:cypress
```

For artifact-bound runtime verification, install the Cypress binary first, then
run this from the repository root:

```sh
npm run test:helpers:consumer -- --cypress
```

To verify a previously packed archive without repacking, supply
`--artifact /absolute/path.tgz --sha256 RECORDED_SHA256` with either browser flag.
See the [helper release procedure](../RELEASING.md) for final-source certification.

The normal component examples cover mounting, Application readiness, manual startup,
configured command timeouts and awaited cleanup. The verifier also runs deliberate
startup, cancellation, timeout and cleanup failures in separate Cypress runs. It
requires the exact command error and a passing following test after teardown.
The separate automatic `afterEach` probe requires the disposer error in that hook
and a skipped following test; it does not promise recovery from a failed hook. Those
failure probes are excluded from the normal `test:cypress` command. Runner results
and screenshots are retained under the verifier's report directory. This optional
flag requires an installed Cypress binary and its Linux display dependencies;
the verifier's dependency install does not download browser binaries.

## Playwright and Vitest ownership

The [browser gallery](gallery/gallery.js) uses `createGallery` from
`@mnjs/test/playwright`. Stories acquire resources through their context and return
an updater when state should survive `component.update`. Playwright 1.63 supplies
the Node `mount` fixture and Locators. The [spec](playwright/profile.spec.js) awaits
`page.evaluate` in `afterEach` to call and await the browser-side `window.unmount()`,
because that fixture does not invoke browser cleanup automatically.

The form suite imports `test` from `@mnjs/test/vitest`. Each test receives its own
`mounts` fixture, which awaits teardown after success or failure. Queries and user
interactions still come from Testing Library. Mount cancellation begins before
project disposers are awaited.

The repository's packed-consumer verifier additionally extracts the package guide's
neutral, Vitest and Playwright reference recipes into the isolated consumer and executes them.
It also runs the shipped README's own Vitest configuration and first test.
Cypress guide command declarations are checked separately with the Cypress consumer types.
