# @mnjs/test

A small, runner-independent test toolkit for Marionette **5.x**. It mounts actual
Views and Applications through a real Region and cleans explicitly owned resources.
It supplies no assertions, query language, event simulator, runner or global hooks.
Production Marionette has no dependency on this optional package and no added runtime cost.
Install it as a development dependency alongside stable Marionette 5.

This is an unpublished initial `0.1.0` artifact. Use the local tarball produced by
`npm pack ./packages/test --ignore-scripts` after `npm run build`; registry installation
of `@mnjs/test` has not been verified. The integration fixture uses published
Marionette `5.0.0`; lifecycle source was compared with canonical commit
`0f2284ad4bbfe8c82ce82714471697a68c2acaeb`, rather than inferred from RC docs.

## Mount a View

```js
import { View } from 'marionette';
import { mountView } from '@mnjs/test';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });
const mounted = mountView(new Greeting());
try {
  // Actual instances and elements work with your existing assertions and queries.
  console.log(mounted.view.isAttached(), mounted.el.textContent);
} finally {
  await mounted.cleanup();
}
```

`mountView(view, options?)` transfers the supplied live, unowned View to a newly
created Region, using `Region.show(view, showOptions)`. The returned `view` is the
original instance. `region.currentView` and the live `el` getter reflect replacement.
`el` is `undefined` when empty, detached through `detachView()`, or cleaned.

| Mount option | Behavior |
| --- | --- |
| `container: Element` | Borrow the existing host. Append a new slot; preserve existing siblings. Never remove or reparent the host. |
| `attachTo: Element` | Append a helper-created host to this destination. |
| `attachTo: null` | Create a detached host with a parented Region slot; replacement still works. |
| `document: Document` | Choose the document when there is no supplied container or destination. |
| `regionClass` | Use your isolated runtime's `Region`; defaults to the standard `Region`. |
| `showOptions` | View-only initial `Region.show` options, including `replaceElement`. These are not persistent Region defaults. |

Without a container, attachment defaults to the chosen document's body. The document
is inferred from `container`, then `attachTo`, then `document`, then the global document.
A container takes precedence over `attachTo`. The returned `container` is the host;
`slot` is the original Region placeholder (temporarily unparented during replacement).
Scope semantic queries to `container`, especially after replacement.

The Region destroys its current View, including its owned children, on cleanup.
Replacing a root follows normal Marionette destruction. Calling
`mounted.region.detachView()` transfers that View back to the caller; the caller
must destroy it or pass it to another owner. Borrowed model, collection, state,
channels and destination elements are not adopted by the helper.

For an isolated runtime, pass its Region explicitly:

```js
import { createMarionette } from 'marionette';
import { mountView } from '@mnjs/test';
const runtime = createMarionette();
const mounted = mountView(new runtime.View({ template: () => 'Isolated' }), {
  regionClass: runtime.Region,
  attachTo: null,
});
await mounted.cleanup();
```

## Mount an Application

```js
import { Application, View } from 'marionette';
import { mountApplication } from '@mnjs/test';

const Feature = Application.extend({
  prepareStart(options, { signal }) {
    return fetch('/profile.json', { signal }).then(response => response.json());
  },
  onStart(app, options, profile) {
    this.showView(new View({ template: () => profile.name }));
  },
});
const mounted = mountApplication(region => new Feature({ region }));
try {
  const started = await mounted.ready;
  if (!started) throw new Error('Feature startup was cancelled');
  console.log(mounted.app.getView(), mounted.el);
} finally {
  await mounted.cleanup();
}
```

The factory must return a **fresh, unstarted Application** owned by this mount.
It may use the supplied Region in its constructor. The helper also supplies that
Region through initial `start()` options. It cannot verify pending startup through
public APIs; returning an existing, active, pending or destroyed Application violates
the factory contract. `startOptions` forwards other initial startup arguments.
Pass the matching `regionClass` when creating an isolated Application.

The mount returns immediately with `app`, `region`, `container`, `slot`, `el`, `ready`
and `cleanup()`. This makes pending preparation accessible: call `app.stop()` or
`await cleanup()` to cancel it. `ready` is the **actual initial `start()` Promise**:
`true` for that attempt's successful start, `false` for cancellation, and rejection
for failure. It does not change after a later restart. Await `app.restart()` explicitly.
An `onStart` throw rejects after activation; cleanup remains explicit.

Readiness does not await child startup unless preparation explicitly awaits it.
It does not await Promises returned by notification hooks, rendering effects,
network saves or every future task. Observe your feature's own completion boundary
or wait for its user-visible result. An aborted preparation signal is not a lifetime
signal after a successful start. Required children started in preparation need
explicit cancellation coordination; stable v5's Application docs show this policy.

Cleanup starts disposal in the calling turn, cancels pending startup, then destroys
the Application and helper Region and removes its owned DOM.
Application destruction owns registered children and its prepared/displayed Views.
Resources the Application itself borrows remain borrowed. The helper does not reset
shared runtime providers, Radio channels, runners, timers or global state.

## Own a test's resources

```js
import { afterEach, beforeEach } from 'vitest';
import { createTestScope, mountView } from '@mnjs/test';
let scope;
beforeEach(() => { scope = createTestScope(); });
afterEach(async () => { await scope.cleanup(); });

// Inside a test:
// const mounted = scope.own(mountView(new MyView()));
// scope.defer(() => controller.abort());
// scope.defer(async () => server.close());
```

`own(resource)` registers its `cleanup()` and returns the same resource.
`defer(callback)` registers an explicit synchronous or asynchronous disposer.
Disposers are awaited one at a time in reverse registration order. Cleanup is
idempotent: repeated calls return the same Promise, including the same rejection;
registration after cleanup begins throws. Do not await that same scope's cleanup
from one of its own disposers.

The scope reports encountered failures in an `AggregateError.errors` array in
execution order while releasing other registered resources. This is a helper-scope
contract, **not framework rollback or recovery**. A synchronous Marionette callback
failure still aborts its individual operation. A partial framework instance is not
repaired or retried by repeated cleanup. Application and Region teardown are one
dependent group: an Application teardown failure skips subsequent Region destruction,
while independently owned fixture DOM is still removed. Render/construction callbacks must work;
failed synchronous mounting does not promise rollback or a usable partial handle.

Always await cleanup so errors fail the test. This toolkit detects no universal
leaks. Explicitly register test-owned listeners, abort controllers, mock servers,
subscriptions and connections; use runner-specific timer restoration and separate
retention tooling where appropriate.

## Executable integrations

The repository's `test/examples/test-package` directory contains the complete
locked examples. It imports public `@mnjs/test` exports and stable Marionette 5.0.0.
From the checkout, build first, then run:

```sh
npm run build
npm --prefix test/examples/test-package ci --ignore-scripts --install-links
npm --prefix test/examples/test-package test
npm --prefix test/examples/test-package exec -- playwright install chromium
npm --prefix test/examples/test-package run test:browser
npm --prefix test/examples/test-package run test:playwright
npm --prefix test/examples/test-package exec -- cypress install
npm --prefix test/examples/test-package run test:cypress
```

Browser binaries and operating-system dependencies must be available. The fixture
is development/test infrastructure; Vue and Cypress are not package dependencies.

- **Vitest DOM + Testing Library/user-event:** `form.spec.js` uses scoped semantic
  queries, validation/focus, keyboard submission, save retry, initial readiness and
  cleanup during a pending save. The same spec runs in **Vitest Browser Mode** with
  the Playwright provider. `user-event` simulates interactions; real keyboard/focus
  coverage additionally lives in the Playwright tests.
- **Playwright:** `gallery/gallery.js` implements the current framework-neutral
  `window.mount({ story, props })` / `window.unmount()` protocol. The installed
  `@playwright/test` **1.63.0** implements `mount(storyId, props)`. Same-story updates
  preserve the actual View and its draft; unknown stories reject. Browser objects
  stay in the browser, and Node tests use Locators. Older Playwright installations
  should use explicit `page.goto()` and story selection until upgraded; do not
  assume the gallery fixture exists. See the official
  [component guide](https://playwright.dev/docs/test-components).
- **Cypress component tests:** `cypress.config.js` configures Cypress **16.1.1** with
  its supported Vue/Vite dev server and `@cypress/vue` shell. The custom
  `cy.mountMarionette()` command mounts Marionette inside that shell and returns
  the actual handle; awaited hooks perform cleanup. Marionette is not a built-in
  Cypress framework configuration. A custom command alone is insufficient; reuse
  a supported host framework or provide a tested custom dev-server integration.
  This environment's Cypress binary download was blocked, so these component specs
  (including repeated mounting) have not been executed here.
  See Cypress's [mount documentation](https://docs.cypress.io/api/commands/mount).
- **Cypress E2E:** run the real application's dev/build server, `cy.visit()` it and
  assert user outcomes. E2E tests do not import live browser Views into the Cypress
  Node process. Use `cy.intercept()` for HTTP scenarios. This recipe is guidance;
  this fixture executes the component suite only.

## Broader compatibility recipes

These are **untested compatibility guidance**, not additional supported adapters:

- **Jest / Node test runner:** establish a DOM before importing Marionette, then use
  the same mount API. Register `await scope.cleanup()` in `afterEach` or `t.after`.
  Restore the DOM and runner mocks yourself. Node module import alone does not
  require a DOM; mounting does.
- **MSW:** own the mock server/worker at the suite's chosen lifetime, reset handlers
  between tests, and supply normal `fetch` to Application preparation. Await
  `ready` for initial HTTP outcomes; observe separate save outcomes independently.
- **axe-core:** run axe against the mounted host in a browser. Add actual Tab,
  Shift+Tab, Enter, Escape and focus-return assertions appropriate to the feature;
  an axe pass alone does not validate keyboard behavior.
- **Visual regression:** Playwright supplies `toHaveScreenshot()` comparisons.
  Choose deterministic story state and wait for fonts/assets/domain completion.
  Cypress screenshot capture needs a separate comparison plugin or service;
  capture alone does not compare images. No visual baseline is claimed here.

These fixtures are purpose-built local forms, **not FormKit integration** and not a
customer-forms migration. FormKit dogfooding requires an owner-approved tested
artifact transfer from its separate container, with commit/version and checksum.
