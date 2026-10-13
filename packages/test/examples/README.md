# Runnable @mnjs/test examples

Use these examples to connect `@mnjs/test` to your runner and browser tools. They
import public package exports with Marionette 5.0.0. See the
[package guide](../readme.md) for mounting, ownership and cleanup contracts.

## Run the examples

From the Marionette repository root:

```sh
npm run build
npm --prefix packages/test/examples ci --ignore-scripts --install-links
npm --prefix packages/test/examples test
npm --prefix packages/test/examples run test:browser
npm --prefix packages/test/examples run test:playwright
```

The private example project has its own dependency lock. `--install-links` installs
a copy of the built helper package. Browser checks require an installed Chromium;
set `MNJS_TEST_CHROMIUM_EXECUTABLE` to use an existing executable.

| Example | What it demonstrates |
| --- | --- |
| [Vitest form tests](form.spec.js) | Testing Library queries and user-event interactions, validation, focus, saves, readiness and cancellation. The same tests run in JSDOM and Vitest Browser Mode. |
| [Playwright tests](playwright/profile.spec.js) | Browser interaction through Locators and the [story gallery](gallery/gallery.js). Playwright 1.63.0 supplies the gallery mount fixture. |
| [Cypress component tests](cypress/component/profile.cy.js) | Native Marionette mounting through a custom command. This example has not yet been executed in Cypress. |
| [ESM](consumer.mjs) / [CommonJS](consumer.cjs) consumers | Public package imports, lifecycle behavior and cleanup; matching TypeScript consumers check declarations. Run with `npm --prefix packages/test/examples run test:consumer`. |

## Use the Cypress example

Copy the [config](cypress.config.js), [support file](cypress/support/component.js)
and [component HTML](cypress/support/component-index.html) into your Cypress project.
The config uses Cypress's custom Vite dev-server function; the support file mounts
Marionette directly into the Cypress container with `@cypress/mount-utils`.

The support file registers `cy.mountMarionette(() => new MyView())` and yields the
actual helper mount handle. This command belongs to the example; installing
`@mnjs/test` alone does not register it. Each test owns one mount. Use the returned
`mounted.region.show(nextView)` for intentional replacement. A single `afterEach`
hook clears the stored handle and returns its cleanup Promise so failures reach
the runner. The [spec](cypress/component/profile.cy.js) shows replacement and form
interaction. With Cypress and its browser binary available, the example's command is:

```sh
npm --prefix packages/test/examples run test:cypress
```
