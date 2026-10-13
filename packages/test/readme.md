# @mnjs/test

Mount real Marionette **5.x** Views and Applications, then release resources your
test owns. The package exports `mountView`, `mountApplication`, and
`createTestScope`. Use your runner's assertions and hooks, Testing Library queries,
or browser Locators alongside them. Mounting requires a DOM; importing the package
and creating a cleanup scope do not. Production Marionette does not depend on it.

This initial `0.1.0` package is unpublished. From this repository, run `npm run build`
and `npm pack ./packages/test --ignore-scripts`, then install the resulting tarball
as a development dependency alongside Marionette 5.

## Mount a View

```js
import { View } from 'marionette';
import { mountView } from '@mnjs/test';

const Greeting = View.extend({ template: () => '<h1>Hello</h1>' });
const mounted = mountView(new Greeting());
try {
  console.log(mounted.view.isAttached(), mounted.el.textContent);
} finally {
  await mounted.cleanup();
}
```

`mountView(view, options?)` transfers a live, unowned View to a new Region. The
handle exposes the original `view`, `region`, `container`, and `slot`. Its live `el`
getter follows `region.currentView`, including replacements, and is `undefined`
when empty. Handle identities are readonly in TypeScript; the actual View and
Region retain their public methods. Use `mounted.region.show(nextView)` to replace
the root. Cleanup destroys the current View and its owned children. Calling
`region.detachView()` transfers that View back to you to destroy or adopt elsewhere.

| Mount option | Behavior |
| --- | --- |
| `container` | Borrow this Element; append a slot and preserve the host and siblings. Takes precedence over `attachTo`. |
| `attachTo` | Append a helper-created host to this Element; `null` keeps it detached. Defaults to the chosen document's body. |
| `document` | Fallback Document, after `container.ownerDocument` and `attachTo.ownerDocument`, before the global document. |
| `regionClass` | Defaults to Marionette's Region. Pass `runtime.Region` for an isolated `createMarionette()` runtime. |
| `showOptions` | View-only options for the initial `Region.show`, including `replaceElement`. |

`container` is the host; `slot` is the original Region placeholder, temporarily
unparented during replacement. Scope DOM queries to `container`. Ownership is
captured at mount time; later changes to options or handle properties cannot
redirect cleanup. Borrowed data, channels, providers and destination elements
remain borrowed.

## Mount an Application

```js
import { Application, View } from 'marionette';
import { mountApplication } from '@mnjs/test';

const Feature = Application.extend({
  async prepareStart(options, { signal }) {
    const response = await fetch('/profile.json', { signal });
    return response.json();
  },
  onStart(app, options, profile) {
    this.showView(new View({ template: () => profile.name }));
  },
});
const mounted = mountApplication(region => new Feature({ region }));
try {
  if (!await mounted.ready) throw new Error('Startup was cancelled');
  console.log(mounted.app.getView(), mounted.el);
} finally {
  await mounted.cleanup();
}
```

The factory must return a **fresh, unstarted Application**. The helper passes its
Region to the factory and initial `start()`; `startOptions` forwards other startup
options. The returned handle adds `app` and `ready` to the mount fields above.

`ready` is the actual initial start Promise: `true` for success, `false` for
cancellation, rejection for failure. It remains the initial attempt after restart;
await `app.restart()` explicitly. Cleanup begins in the calling turn and cancels
pending preparation before destroying the Application and helper Region. You can
also call `app.stop()` while preparation is pending.

Readiness covers preparation, including children that preparation explicitly awaits.
It does not await asynchronous notification hooks, later saves or every future task.
Observe those operations' own completion boundaries. Coordinate cancellation of
required child startup explicitly; a preparation signal is not a lifetime signal
after startup succeeds.

## Own a test's resources

```js
import { afterEach, beforeEach } from 'vitest';
import { createTestScope } from '@mnjs/test';

let scope;
beforeEach(() => { scope = createTestScope(); });
afterEach(() => {
  const previous = scope;
  scope = undefined;
  return previous?.cleanup();
});

// In a test: scope.own(mountView(new MyView()));
// scope.defer(() => controller.abort());
```

`own(resource)` registers `resource.cleanup()` and returns the same resource.
`defer(callback)` registers a disposer. Returned values are ignored and promises
are awaited, one callback at a time in reverse registration order. Cleanup returns
the same Promise on every call. Registration after cleanup begins throws; create
a fresh scope for the next test. A disposer must not await its own scope's cleanup.

Always await or return cleanup so failures reach your runner. An
`AggregateError.errors` array preserves encountered failures in execution order
while other registered disposers run. Application and Region destruction form one
dependent operation: an Application teardown failure skips Region destruction;
helper-owned fixture DOM is still removed. Partial framework operations are not retried.

A synchronous mount failure removes only the helper-created slot and host, then
rethrows the original error. It does not destroy or repair partially initialized
framework objects. With a borrowed host and `replaceElement`, a failed attach
callback can leave the View's own element in that host. Async startup failure
rejects `ready`; cleanup of the returned handle remains your responsibility.
Register your own listeners, subscriptions and servers, and restore runner mocks
and timers at their chosen lifetime. There is no universal leak detector.

## Runner examples and compatibility

The [locked examples](https://github.com/marionettejs/marionette/tree/codex/mnjs-test-canonical-20261012/test/examples/test-package)
include setup and commands. Runners provide test execution and assertions;
Testing Library supplies DOM queries and simulated interactions; Playwright and
Cypress automate browsers. Those roles remain outside this package.

| Environment | Evidence and example |
| --- | --- |
| Vitest + JSDOM | Verified with Testing Library/user-event in [form.spec.js](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/form.spec.js). |
| Vitest Browser + Playwright | Same form cases verified in Chromium; [configuration](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/vitest.config.js). |
| Playwright Test | Verified browser gallery and native input/focus checks; [specs](https://github.com/marionettejs/marionette/tree/codex/mnjs-test-canonical-20261012/test/examples/test-package/playwright). |
| Cypress component tests | Native example corrected; execution is held and unverified. [Config](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/cypress.config.js), [support](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/cypress/support/component.js), [HTML](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/cypress/support/component-index.html), [specs](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/cypress/component/profile.cy.js). |
| Jest, Mocha, Node test runner and other runners | Unverified. Supply a DOM for mounting and await cleanup through your runner's hooks. |

The Cypress support file registers the example command `cy.mountMarionette()`;
this is not a package export. It mounts Marionette directly, without Vue, and uses
one mount per test with one `afterEach` cleanup owner. A duplicate command rejects;
replace Views through the returned Region. Browser instances stay in the browser;
Playwright's Node tests use Locators. See the
[verification record](https://github.com/marionettejs/marionette/blob/codex/mnjs-test-canonical-20261012/test/examples/test-package/VERIFICATION.md)
for exact versions, checks and limitations.
