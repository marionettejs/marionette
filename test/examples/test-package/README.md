# Executable @mnjs/test examples

See the [package README](../../../packages/test/readme.md) for APIs and compatibility.
These examples use real public package imports with stable Marionette 5.0.0.
The helper is installed from the local built package using npm's `--install-links`
so the consumer uses a copied distribution, not a source alias.

From the repository root:

```sh
npm run build
npm --prefix test/examples/test-package ci --ignore-scripts --install-links
npm --prefix test/examples/test-package test
npm --prefix test/examples/test-package run test:browser
npm --prefix test/examples/test-package run test:playwright
```

Browser checks need an installed Chromium. Cypress execution is currently held;
its separate `test:cypress` script is retained for a future authorized run.

`fixtures.js` owns asynchronous form saving independently from Application readiness.
`form.spec.js` runs unchanged in JSDOM and Vitest Browser Mode. Playwright uses its
1.63.0 built-in gallery `mount`; same-story updates preserve the current View.
Cypress uses its public Vite dev-server API and mounts Marionette directly into
`[data-cy-root]` with `@cypress/mount-utils`; no Vue wrapper or dependency is needed.
The fixture's [custom command](cypress/support/component.js) registers
`cy.mountMarionette(() => new MyView())`. It is loaded by the
[Cypress config](cypress.config.js), uses the [component HTML](cypress/support/component-index.html),
and yields the actual `mountView` handle. See the [component specs](cypress/component/profile.cy.js).
This command is repository example code, not an `@mnjs/test` export or subpath;
reuse these support/config files in your own project to register it.

The native container pattern follows
[app-frontend's Cypress support](https://github.com/RoundingWell/app-frontend/blob/1f5dc8a5f88253fe21144756d055a07c8aa02d55/test/support/component.js).
The pinned Cypress 16/Vite-server 8 fixture uses the custom dev-server function
instead of a named Marionette framework preset. Each test owns one mount. A second
`cy.mountMarionette()` call rejects; intentional View replacement uses the returned
`mounted.region.show(nextView)`. One `afterEach` hook captures and clears the handle,
then returns its cleanup Promise, including when cleanup rejects. There is no
before-test cleanup or automatic replacement teardown inside the command.
Cypress execution is currently held; source inspection and other runners do not
certify these component specs.

The examples do not test FormKit or migrate customer-forms. Broader compatibility
and Cypress E2E remain guidance. See the committed verification report for checks
actually executed and environment limitations.

When the pinned Playwright browser is unavailable, an already installed Chromium
can provide supplemental evidence without downloading a substitute binary:

```sh
MNJS_TEST_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:helpers:consumer -- --browser
```

Run this command from the repository root after building. The consumer report
records the actual browser version, the artifact hash, whether source has working
changes, and hashes of the authored helper/fixture files. A system-browser pass
does not certify the pinned browser profile. The verifier clears inherited
checkout tool paths and global module search, and checks consumer ancestors for
`node_modules`; runtime and type checks use the isolated installed dependencies.
